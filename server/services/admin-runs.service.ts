import { desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'

import {
  adminRunsPage as fallbackRunsPage,
  type AdminRunRecord,
  type AdminRunsPage,
} from '@/lib/admin-runs-data'
import { resolveEstimatedInternalCostCents } from '@/lib/runtime-cost'
import type { TriggerMode } from '@/lib/types'

import { createDb } from '../db'
import {
  orders,
  runChannelConfigs,
  runUsage,
  runs,
  runtimeInstances,
  runtimeIntervals,
  userSubscriptions,
  users,
} from '../db/schema'
import { resolvePostgresConnectionString } from './admin-usage.helpers'

const DEFAULT_PAGE_SIZE = 20

function getNumberFromSnapshot(snapshot: Record<string, unknown> | null | undefined, key: string) {
  const value = snapshot?.[key]
  return typeof value === 'number' ? value : null
}

function toIso(value: Date | null | undefined) {
  return value ? value.toISOString() : null
}

function parsePage(value: string | null | undefined) {
  const parsed = Number.parseInt(value ?? '1', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

function toTriggerMode(value: string | null | undefined): TriggerMode | null {
  if (value === 'always_active' || value === 'auto_wake' || value === 'manual' || value === 'none') {
    return value
  }

  return null
}

function filterFallbackRows(rows: AdminRunRecord[], query: string) {
  if (!query) {
    return rows
  }

  const normalized = query.toLowerCase()

  return rows.filter((row) =>
    [
      row.id,
      row.orderId,
      row.userId,
      row.userName,
      row.userEmail,
      row.providerInstanceRef ?? '',
    ]
      .join(' ')
      .toLowerCase()
      .includes(normalized),
  )
}

function cloneFallbackRunsPage(input?: { page?: string | null; query?: string | null }, note?: string): AdminRunsPage {
  const query = input?.query?.trim() ?? ''
  const filteredRows = filterFallbackRows(fallbackRunsPage.rows, query)
  const totalRuns = filteredRows.length
  const totalPages = Math.max(1, Math.ceil(totalRuns / fallbackRunsPage.pageSize))
  const page = Math.min(parsePage(input?.page), totalPages)
  const offset = (page - 1) * fallbackRunsPage.pageSize

  return {
    implementationNote: note ?? fallbackRunsPage.implementationNote,
    page,
    pageSize: fallbackRunsPage.pageSize,
    query,
    rows: filteredRows.slice(offset, offset + fallbackRunsPage.pageSize),
    totalPages,
    totalRuns,
  }
}

export async function getAdminRunsPage(input?: {
  page?: string | null
  query?: string | null
}): Promise<AdminRunsPage> {
  const connectionString = resolvePostgresConnectionString()
  const query = input?.query?.trim() ?? ''

  if (!connectionString?.startsWith('postgres')) {
    return cloneFallbackRunsPage(
      input,
      'Live admin run queries are disabled because no PostgreSQL DATABASE_URL is available. Showing staged run data.',
    )
  }

  try {
    const db = createDb(connectionString)
    const pattern = query ? `%${query}%` : null
    const filter = pattern
      ? or(
          ilike(runs.id, pattern),
          ilike(runs.orderId, pattern),
          ilike(runs.userId, pattern),
          ilike(users.email, pattern),
          ilike(users.name, pattern),
          ilike(runtimeInstances.providerInstanceRef, pattern),
        )
      : undefined

    const countQuery = db
      .select({ total: sql<number>`count(*)` })
      .from(runs)
      .leftJoin(users, eq(users.id, runs.userId))
      .leftJoin(runtimeInstances, eq(runtimeInstances.runId, runs.id))

    const countRows = filter ? await countQuery.where(filter) : await countQuery
    const totalRuns = Number(countRows[0]?.total ?? 0)
    const totalPages = Math.max(1, Math.ceil(totalRuns / DEFAULT_PAGE_SIZE))
    const page = Math.min(parsePage(input?.page), totalPages)
    const offset = (page - 1) * DEFAULT_PAGE_SIZE

    const baseQuery = db
      .select({
        channel: runChannelConfigs,
        order: orders,
        run: runs,
        runtime: runtimeInstances,
        usage: runUsage,
        user: users,
      })
      .from(runs)
      .leftJoin(users, eq(users.id, runs.userId))
      .leftJoin(runUsage, eq(runUsage.runId, runs.id))
      .leftJoin(runtimeInstances, eq(runtimeInstances.runId, runs.id))
      .leftJoin(orders, eq(orders.id, runs.orderId))
      .leftJoin(runChannelConfigs, eq(runChannelConfigs.id, runs.channelConfigId))
      .orderBy(desc(runs.createdAt))
      .limit(DEFAULT_PAGE_SIZE)
      .offset(offset)

    const rows = filter ? await baseQuery.where(filter) : await baseQuery
    const runIds = rows.map((row) => row.run.id)
    const userIds = Array.from(new Set(rows.map((row) => row.run.userId)))

    const [intervalRows, subscriptionRows] = await Promise.all([
      runIds.length > 0
        ? db
            .select()
            .from(runtimeIntervals)
            .where(inArray(runtimeIntervals.runId, runIds))
            .orderBy(desc(runtimeIntervals.startedAt))
        : Promise.resolve([]),
      userIds.length > 0
        ? db
            .select()
            .from(userSubscriptions)
            .where(inArray(userSubscriptions.userId, userIds))
            .orderBy(desc(userSubscriptions.updatedAt))
        : Promise.resolve([]),
    ])

    const intervalsByRunId = new Map<string, Array<(typeof runtimeIntervals.$inferSelect)>>()
    for (const row of intervalRows) {
      const bucket = intervalsByRunId.get(row.runId) ?? []
      bucket.push(row)
      intervalsByRunId.set(row.runId, bucket)
    }

    const subscriptionsByUserPlan = new Map<string, typeof userSubscriptions.$inferSelect>()
    for (const row of subscriptionRows) {
      const key = `${row.userId}:${row.planId}`
      if (!subscriptionsByUserPlan.has(key)) {
        subscriptionsByUserPlan.set(key, row)
      }
    }

    return {
      implementationNote:
        'Runs tab is paginated directly from live admin read-model queries over runs, run_usage, runtime_instances, runtime_intervals, orders, users, and channel state.',
      page,
      pageSize: DEFAULT_PAGE_SIZE,
      query,
      rows: rows.map<AdminRunRecord>((row) => {
        const usage = row.usage
        const runtime = row.runtime
        const order = row.order
        const channel = row.channel
        const user = row.user
        const intervals = intervalsByRunId.get(row.run.id) ?? []
        const latestInterval = intervals[0]
        const activeInterval = intervals.find((interval) => !interval.endedAt) ?? null
        const subscription = usage ? subscriptionsByUserPlan.get(`${row.run.userId}:${usage.planId}`) : undefined
        const ttlPolicy = (usage?.ttlPolicySnapshot ?? null) as Record<string, unknown> | null

        return {
          activeIntervalStartedAt: toIso(activeInterval?.startedAt),
          agentCount: usage?.agentCount ?? null,
          billingInterval: subscription?.billingInterval ?? null,
          channelConfigId: row.run.channelConfigId,
          cleanupGraceMinutes: getNumberFromSnapshot(ttlPolicy, 'cleanupGraceMinutes'),
          completedAt: toIso(row.run.completedAt),
          createdAt: row.run.createdAt.toISOString(),
          estimatedInternalCostCents:
            usage == null
              ? null
              : resolveEstimatedInternalCostCents({
                  estimatedInternalCostCents: usage.estimatedInternalCostCents,
                  workspaceMinutes: usage.workspaceMinutes,
                }),
          heartbeatMissingMinutes: getNumberFromSnapshot(ttlPolicy, 'heartbeatMissingMinutes'),
          id: row.run.id,
          idleTimeoutMinutes: getNumberFromSnapshot(ttlPolicy, 'idleTimeoutMinutes'),
          inputTokensEst: usage?.inputTokensEst ?? null,
          intervalCount: intervals.length,
          lastMeaningfulActivityAt: toIso(usage?.lastMeaningfulActivityAt),
          lastOpenClawSessionActivityAt: toIso(usage?.lastOpenClawSessionActivityAt),
          lastOpenClawSessionProbeAt: toIso(usage?.lastOpenClawSessionProbeAt),
          latestIntervalCloseReason: latestInterval?.closeReason ?? null,
          latestIntervalEndedAt: toIso(latestInterval?.endedAt),
          latestIntervalStartedAt: toIso(latestInterval?.startedAt),
          maxSessionTtlMinutes: getNumberFromSnapshot(ttlPolicy, 'maxSessionTtlMinutes'),
          networkEnabled: usage?.networkEnabled ?? row.run.networkEnabled,
          openClawIdleTimeoutMinutes: getNumberFromSnapshot(ttlPolicy, 'openClawIdleTimeoutMinutes'),
          openClawSessionCount: usage?.openClawSessionCount ?? null,
          orderId: row.run.orderId,
          orderStatus: order?.status ?? 'unknown',
          outputTokensEst: usage?.outputTokensEst ?? null,
          paidAt: toIso(order?.paidAt),
          pairingStatus: channel?.recipientBindingStatus ?? 'unknown',
          persistenceMode: runtime?.persistenceMode ?? null,
          planId: usage?.planId ?? runtime?.planId ?? 'run',
          planVersion: usage?.planVersion ?? null,
          preservedStateAvailable: runtime?.preservedStateAvailable ?? false,
          providerAcceptedAt: toIso(usage?.providerAcceptedAt),
          providerInstanceRef: runtime?.providerInstanceRef ?? null,
          providerName: runtime?.providerName ?? null,
          provisioningTimeoutMinutes: getNumberFromSnapshot(ttlPolicy, 'provisioningTimeoutMinutes'),
          recipientExternalId: channel?.recipientExternalId ?? null,
          recoverableUntilAt: toIso(runtime?.recoverableUntilAt),
          resultSummary: row.run.resultSummary,
          runningStartedAt: toIso(usage?.runningStartedAt),
          runtimeMode: runtime?.runtimeMode ?? null,
          runtimeState: runtime?.state ?? null,
          runtimeStopReason: runtime?.stopReason ?? null,
          runtimeUpdatedAt: toIso(runtime?.updatedAt),
          startedAt: toIso(row.run.startedAt),
          status: row.run.status,
          terminationReason: usage?.terminationReason ?? null,
          tokenStatus: channel?.tokenStatus ?? 'unknown',
          toolCallsCount: usage?.toolCallsCount ?? null,
          triggerModeSnapshot: toTriggerMode(usage?.triggerModeSnapshot),
          unhealthyProviderTimeoutMinutes: getNumberFromSnapshot(ttlPolicy, 'unhealthyProviderTimeoutMinutes'),
          updatedAt: row.run.updatedAt.toISOString(),
          userEmail: user?.email ?? `${row.run.userId}@unknown.local`,
          userId: row.run.userId,
          userName: user?.name ?? row.run.userId,
          usesRealWorkspace: usage?.usesRealWorkspace ?? row.run.usesRealWorkspace,
          usesTools: usage?.usesTools ?? row.run.usesTools,
          workspaceMinutes: usage?.workspaceMinutes ?? null,
          workspaceReleasedAt: toIso(usage?.workspaceReleasedAt ?? runtime?.workspaceReleasedAt),
        }
      }),
      totalPages,
      totalRuns,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error'
    return cloneFallbackRunsPage(
      input,
      `Live admin run queries failed (${message}). Showing staged run data instead.`,
    )
  }
}
