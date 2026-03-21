import { desc, eq, sql } from 'drizzle-orm'

import { runSchema, runUsageSchema } from '@/lib/schemas'
import type { Run, RunUsage } from '@/lib/types'

import { createDb, type DbClient } from '../db'
import { runUsage, runs } from '../db/schema'

let dbClient: DbClient | null = null

type LegacyRunUsageRow = Omit<
  typeof runUsage.$inferSelect,
  'lastMeaningfulActivityAt' | 'lastOpenClawSessionActivityAt' | 'lastOpenClawSessionProbeAt' | 'openClawSessionCount'
> & {
  lastMeaningfulActivityAt?: Date | null
  lastOpenClawSessionActivityAt?: Date | null
  lastOpenClawSessionProbeAt?: Date | null
  openClawSessionCount?: number | null
}

function getDb() {
  dbClient ??= createDb()
  return dbClient
}

export function setRunRepositoryDbForTesting(client: DbClient | null) {
  dbClient = client
}

function toPublicRun(run: typeof runs.$inferSelect): Run {
  return runSchema.parse({
    id: run.id,
    userId: run.userId,
    orderId: run.orderId,
    channelConfigId: run.channelConfigId,
    status: run.status,
    combinedRiskLevel: run.combinedRiskLevel,
    usesRealWorkspace: run.usesRealWorkspace,
    usesTools: run.usesTools,
    networkEnabled: run.networkEnabled,
    resultSummary: run.resultSummary,
    resultArtifacts: run.resultArtifacts,
    createdAt: run.createdAt.toISOString(),
    startedAt: run.startedAt?.toISOString() ?? null,
    updatedAt: run.updatedAt.toISOString(),
    completedAt: run.completedAt?.toISOString() ?? null,
  })
}

function mergeTransientRunFields(base: Run, input?: Partial<Run> | null): Run {
  if (!input) {
    return base
  }

  return runSchema.parse({
    ...base,
    runtimeState: input.runtimeState ?? base.runtimeState,
    persistenceMode:
      input.persistenceMode !== undefined ? input.persistenceMode : (base.persistenceMode ?? null),
    preservedStateAvailable:
      input.preservedStateAvailable !== undefined
        ? input.preservedStateAvailable
        : (base.preservedStateAvailable ?? false),
    recoverableUntilAt:
      input.recoverableUntilAt !== undefined
        ? input.recoverableUntilAt
        : (base.recoverableUntilAt ?? null),
  })
}

function toJsonArtifacts(run: Pick<Run, 'resultArtifacts'>) {
  return run.resultArtifacts.map((artifact) => ({
    ...artifact,
  }))
}

function toPublicRunUsage(row: typeof runUsage.$inferSelect): RunUsage {
  return runUsageSchema.parse({
    id: row.id,
    runId: row.runId,
    userId: row.userId,
    orderId: row.orderId,
    planId: row.planId,
    planVersion: row.planVersion,
    triggerModeSnapshot: row.triggerModeSnapshot,
    agentCount: row.agentCount,
    usesRealWorkspace: row.usesRealWorkspace,
    usesTools: row.usesTools,
    networkEnabled: row.networkEnabled,
    provisioningStartedAt: row.provisioningStartedAt?.toISOString() ?? null,
    providerAcceptedAt: row.providerAcceptedAt?.toISOString() ?? null,
    runningStartedAt: row.runningStartedAt?.toISOString() ?? null,
    lastMeaningfulActivityAt: row.lastMeaningfulActivityAt?.toISOString() ?? null,
    lastOpenClawSessionActivityAt: row.lastOpenClawSessionActivityAt?.toISOString() ?? null,
    lastOpenClawSessionProbeAt: row.lastOpenClawSessionProbeAt?.toISOString() ?? null,
    openClawSessionCount: row.openClawSessionCount ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    workspaceReleasedAt: row.workspaceReleasedAt?.toISOString() ?? null,
    terminationReason: row.terminationReason,
    workspaceMinutes: row.workspaceMinutes,
    toolCallsCount: row.toolCallsCount,
    inputTokensEst: row.inputTokensEst,
    outputTokensEst: row.outputTokensEst,
    estimatedInternalCostCents: row.estimatedInternalCostCents,
    statusSnapshot: row.statusSnapshot,
    ttlPolicySnapshot: row.ttlPolicySnapshot,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  })
}

function toPublicLegacyRunUsage(row: LegacyRunUsageRow): RunUsage {
  return runUsageSchema.parse({
    id: row.id,
    runId: row.runId,
    userId: row.userId,
    orderId: row.orderId,
    planId: row.planId,
    planVersion: row.planVersion,
    triggerModeSnapshot: row.triggerModeSnapshot,
    agentCount: row.agentCount,
    usesRealWorkspace: row.usesRealWorkspace,
    usesTools: row.usesTools,
    networkEnabled: row.networkEnabled,
    provisioningStartedAt: row.provisioningStartedAt?.toISOString() ?? null,
    providerAcceptedAt: row.providerAcceptedAt?.toISOString() ?? null,
    runningStartedAt: row.runningStartedAt?.toISOString() ?? null,
    lastMeaningfulActivityAt: row.lastMeaningfulActivityAt?.toISOString() ?? null,
    lastOpenClawSessionActivityAt: row.lastOpenClawSessionActivityAt?.toISOString() ?? null,
    lastOpenClawSessionProbeAt: row.lastOpenClawSessionProbeAt?.toISOString() ?? null,
    openClawSessionCount: row.openClawSessionCount ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    workspaceReleasedAt: row.workspaceReleasedAt?.toISOString() ?? null,
    terminationReason: row.terminationReason,
    workspaceMinutes: row.workspaceMinutes,
    toolCallsCount: row.toolCallsCount,
    inputTokensEst: row.inputTokensEst,
    outputTokensEst: row.outputTokensEst,
    estimatedInternalCostCents: row.estimatedInternalCostCents,
    statusSnapshot: row.statusSnapshot,
    ttlPolicySnapshot: row.ttlPolicySnapshot,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  })
}

function toInsertValues(run: Run): typeof runs.$inferInsert {
  return {
    id: run.id,
    userId: run.userId,
    orderId: run.orderId,
    channelConfigId: run.channelConfigId,
    status: run.status,
    combinedRiskLevel: run.combinedRiskLevel,
    usesRealWorkspace: run.usesRealWorkspace,
    usesTools: run.usesTools,
    networkEnabled: run.networkEnabled,
    resultSummary: run.resultSummary,
    resultArtifacts: toJsonArtifacts(run),
    createdAt: new Date(run.createdAt),
    startedAt: run.startedAt ? new Date(run.startedAt) : null,
    updatedAt: new Date(run.updatedAt),
    completedAt: run.completedAt ? new Date(run.completedAt) : null,
  }
}

function toRunUsageInsertValues(usage: RunUsage): typeof runUsage.$inferInsert {
  return {
    id: usage.id,
    runId: usage.runId,
    userId: usage.userId,
    orderId: usage.orderId,
    planId: usage.planId,
    planVersion: usage.planVersion,
    triggerModeSnapshot: usage.triggerModeSnapshot,
    agentCount: usage.agentCount,
    usesRealWorkspace: usage.usesRealWorkspace,
    usesTools: usage.usesTools,
    networkEnabled: usage.networkEnabled,
    provisioningStartedAt: usage.provisioningStartedAt ? new Date(usage.provisioningStartedAt) : null,
    providerAcceptedAt: usage.providerAcceptedAt ? new Date(usage.providerAcceptedAt) : null,
    runningStartedAt: usage.runningStartedAt ? new Date(usage.runningStartedAt) : null,
    lastMeaningfulActivityAt: usage.lastMeaningfulActivityAt ? new Date(usage.lastMeaningfulActivityAt) : null,
    lastOpenClawSessionActivityAt: usage.lastOpenClawSessionActivityAt
      ? new Date(usage.lastOpenClawSessionActivityAt)
      : null,
    lastOpenClawSessionProbeAt: usage.lastOpenClawSessionProbeAt ? new Date(usage.lastOpenClawSessionProbeAt) : null,
    openClawSessionCount: usage.openClawSessionCount ?? null,
    completedAt: usage.completedAt ? new Date(usage.completedAt) : null,
    workspaceReleasedAt: usage.workspaceReleasedAt ? new Date(usage.workspaceReleasedAt) : null,
    terminationReason: usage.terminationReason,
    workspaceMinutes: usage.workspaceMinutes,
    toolCallsCount: usage.toolCallsCount,
    inputTokensEst: usage.inputTokensEst,
    outputTokensEst: usage.outputTokensEst,
    estimatedInternalCostCents: usage.estimatedInternalCostCents,
    statusSnapshot: usage.statusSnapshot,
    ttlPolicySnapshot: usage.ttlPolicySnapshot,
    createdAt: new Date(usage.createdAt),
    updatedAt: new Date(usage.updatedAt),
  }
}

function isMissingLegacyRunUsageColumn(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : ''
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : ''
  const cause =
    typeof error === 'object' && error !== null && 'cause' in error ? (error as { cause?: unknown }).cause : undefined
  const causeMessage = cause instanceof Error ? cause.message.toLowerCase() : ''
  const causeCode =
    typeof cause === 'object' && cause !== null && 'code' in cause ? String((cause as { code?: unknown }).code) : ''

  return (
    (code === '42703' || causeCode === '42703') &&
    [
      'last_meaningful_activity_at',
      'last_openclaw_session_activity_at',
      'last_openclaw_session_probe_at',
      'openclaw_session_count',
    ].some((column) => message.includes(column) || causeMessage.includes(column))
  )
}

function getFirstRow<T>(result: unknown): T | null {
  if (!result || typeof result !== 'object' || !('rows' in result)) {
    return null
  }
  const rows = (result as { rows?: T[] }).rows
  return Array.isArray(rows) && rows.length > 0 ? rows[0]! : null
}

function legacyRunUsageInsertSql(usage: RunUsage) {
  return sql<LegacyRunUsageRow>`
    insert into run_usage (
      id,
      run_id,
      user_id,
      order_id,
      plan_id,
      plan_version,
      trigger_mode_snapshot,
      agent_count,
      uses_real_workspace,
      uses_tools,
      network_enabled,
      provisioning_started_at,
      provider_accepted_at,
      running_started_at,
      last_meaningful_activity_at,
      last_openclaw_session_activity_at,
      last_openclaw_session_probe_at,
      openclaw_session_count,
      completed_at,
      workspace_released_at,
      termination_reason,
      workspace_minutes,
      tool_calls_count,
      input_tokens_est,
      output_tokens_est,
      estimated_internal_cost_cents,
      status_snapshot,
      ttl_policy_snapshot,
      created_at,
      updated_at
    ) values (
      ${usage.id},
      ${usage.runId},
      ${usage.userId},
      ${usage.orderId},
      ${usage.planId},
      ${usage.planVersion},
      ${usage.triggerModeSnapshot},
      ${usage.agentCount},
      ${usage.usesRealWorkspace},
      ${usage.usesTools},
      ${usage.networkEnabled},
      ${usage.provisioningStartedAt ? new Date(usage.provisioningStartedAt) : null},
      ${usage.providerAcceptedAt ? new Date(usage.providerAcceptedAt) : null},
      ${usage.runningStartedAt ? new Date(usage.runningStartedAt) : null},
      ${usage.lastMeaningfulActivityAt ? new Date(usage.lastMeaningfulActivityAt) : null},
      ${usage.lastOpenClawSessionActivityAt ? new Date(usage.lastOpenClawSessionActivityAt) : null},
      ${usage.lastOpenClawSessionProbeAt ? new Date(usage.lastOpenClawSessionProbeAt) : null},
      ${usage.openClawSessionCount ?? null},
      ${usage.completedAt ? new Date(usage.completedAt) : null},
      ${usage.workspaceReleasedAt ? new Date(usage.workspaceReleasedAt) : null},
      ${usage.terminationReason},
      ${usage.workspaceMinutes},
      ${usage.toolCallsCount},
      ${usage.inputTokensEst},
      ${usage.outputTokensEst},
      ${usage.estimatedInternalCostCents},
      ${usage.statusSnapshot},
      ${JSON.stringify(usage.ttlPolicySnapshot)}::jsonb,
      ${new Date(usage.createdAt)},
      ${new Date(usage.updatedAt)}
    )
    returning
      id,
      run_id as "runId",
      user_id as "userId",
      order_id as "orderId",
      plan_id as "planId",
      plan_version as "planVersion",
      trigger_mode_snapshot as "triggerModeSnapshot",
      agent_count as "agentCount",
      uses_real_workspace as "usesRealWorkspace",
      uses_tools as "usesTools",
      network_enabled as "networkEnabled",
      provisioning_started_at as "provisioningStartedAt",
      provider_accepted_at as "providerAcceptedAt",
      running_started_at as "runningStartedAt",
      last_meaningful_activity_at as "lastMeaningfulActivityAt",
      last_openclaw_session_activity_at as "lastOpenClawSessionActivityAt",
      last_openclaw_session_probe_at as "lastOpenClawSessionProbeAt",
      openclaw_session_count as "openClawSessionCount",
      completed_at as "completedAt",
      workspace_released_at as "workspaceReleasedAt",
      termination_reason as "terminationReason",
      workspace_minutes as "workspaceMinutes",
      tool_calls_count as "toolCallsCount",
      input_tokens_est as "inputTokensEst",
      output_tokens_est as "outputTokensEst",
      estimated_internal_cost_cents as "estimatedInternalCostCents",
      status_snapshot as "statusSnapshot",
      ttl_policy_snapshot as "ttlPolicySnapshot",
      created_at as "createdAt",
      updated_at as "updatedAt"
  `
}

function legacyRunUsageSelectSql(runId: string) {
  return sql<LegacyRunUsageRow>`
    select
      id,
      run_id as "runId",
      user_id as "userId",
      order_id as "orderId",
      plan_id as "planId",
      plan_version as "planVersion",
      trigger_mode_snapshot as "triggerModeSnapshot",
      agent_count as "agentCount",
      uses_real_workspace as "usesRealWorkspace",
      uses_tools as "usesTools",
      network_enabled as "networkEnabled",
      provisioning_started_at as "provisioningStartedAt",
      provider_accepted_at as "providerAcceptedAt",
      running_started_at as "runningStartedAt",
      null::timestamptz as "lastMeaningfulActivityAt",
      null::timestamptz as "lastOpenClawSessionActivityAt",
      null::timestamptz as "lastOpenClawSessionProbeAt",
      null::integer as "openClawSessionCount",
      completed_at as "completedAt",
      workspace_released_at as "workspaceReleasedAt",
      termination_reason as "terminationReason",
      workspace_minutes as "workspaceMinutes",
      tool_calls_count as "toolCallsCount",
      input_tokens_est as "inputTokensEst",
      output_tokens_est as "outputTokensEst",
      estimated_internal_cost_cents as "estimatedInternalCostCents",
      status_snapshot as "statusSnapshot",
      ttl_policy_snapshot as "ttlPolicySnapshot",
      created_at as "createdAt",
      updated_at as "updatedAt"
    from run_usage
    where run_id = ${runId}
    limit 1
  `
}

function legacyRunUsageUpdateSql(runId: string, input: Partial<RunUsage>) {
  return sql<LegacyRunUsageRow>`
    update run_usage set
      provider_accepted_at = coalesce(${input.providerAcceptedAt ? new Date(input.providerAcceptedAt) : null}, provider_accepted_at),
      running_started_at = coalesce(${input.runningStartedAt ? new Date(input.runningStartedAt) : null}, running_started_at),
      completed_at = ${
        input.completedAt ? new Date(input.completedAt) : input.completedAt === null ? null : sql`completed_at`
      },
      workspace_released_at = ${
        input.workspaceReleasedAt
          ? new Date(input.workspaceReleasedAt)
          : input.workspaceReleasedAt === null
            ? null
            : sql`workspace_released_at`
      },
      termination_reason = ${input.terminationReason ?? sql`termination_reason`},
      workspace_minutes = ${input.workspaceMinutes ?? sql`workspace_minutes`},
      tool_calls_count = ${input.toolCallsCount ?? sql`tool_calls_count`},
      input_tokens_est = ${input.inputTokensEst ?? sql`input_tokens_est`},
      output_tokens_est = ${input.outputTokensEst ?? sql`output_tokens_est`},
      estimated_internal_cost_cents = ${input.estimatedInternalCostCents ?? sql`estimated_internal_cost_cents`},
      status_snapshot = ${input.statusSnapshot ?? sql`status_snapshot`},
      ttl_policy_snapshot = ${
        input.ttlPolicySnapshot ? sql`${JSON.stringify(input.ttlPolicySnapshot)}::jsonb` : sql`ttl_policy_snapshot`
      },
      updated_at = ${input.updatedAt ? new Date(input.updatedAt) : new Date()}
    where run_id = ${runId}
    returning
      id,
      run_id as "runId",
      user_id as "userId",
      order_id as "orderId",
      plan_id as "planId",
      plan_version as "planVersion",
      trigger_mode_snapshot as "triggerModeSnapshot",
      agent_count as "agentCount",
      uses_real_workspace as "usesRealWorkspace",
      uses_tools as "usesTools",
      network_enabled as "networkEnabled",
      provisioning_started_at as "provisioningStartedAt",
      provider_accepted_at as "providerAcceptedAt",
      running_started_at as "runningStartedAt",
      null::timestamptz as "lastMeaningfulActivityAt",
      null::timestamptz as "lastOpenClawSessionActivityAt",
      null::timestamptz as "lastOpenClawSessionProbeAt",
      null::integer as "openClawSessionCount",
      completed_at as "completedAt",
      workspace_released_at as "workspaceReleasedAt",
      termination_reason as "terminationReason",
      workspace_minutes as "workspaceMinutes",
      tool_calls_count as "toolCallsCount",
      input_tokens_est as "inputTokensEst",
      output_tokens_est as "outputTokensEst",
      estimated_internal_cost_cents as "estimatedInternalCostCents",
      status_snapshot as "statusSnapshot",
      ttl_policy_snapshot as "ttlPolicySnapshot",
      created_at as "createdAt",
      updated_at as "updatedAt"
  `
}

export class RunRepository {
  async createRun(run: Run) {
    const db = getDb()
    const [created] = await db.insert(runs).values(toInsertValues(run)).returning()
    return mergeTransientRunFields(toPublicRun(created), run)
  }

  async createProvisioningRun(run: Run, usage: RunUsage) {
    const db = getDb()
    try {
      const created = await db.transaction(async (tx) => {
        const [createdRun] = await tx.insert(runs).values(toInsertValues(run)).returning()
        const [createdUsage] = await tx.insert(runUsage).values(toRunUsageInsertValues(usage)).returning()
        return {
          run: mergeTransientRunFields(toPublicRun(createdRun), run),
          usage: toPublicRunUsage(createdUsage),
        }
      })

      return created
    } catch (error) {
      if (!isMissingLegacyRunUsageColumn(error)) {
        throw error
      }

      const created = await db.transaction(async (tx) => {
        const [createdRun] = await tx.insert(runs).values(toInsertValues(run)).returning()
        const usageResult = await tx.execute(legacyRunUsageInsertSql(usage))
        const createdUsage = getFirstRow<LegacyRunUsageRow>(usageResult)
        if (!createdUsage) {
          throw new Error('Failed to create legacy run_usage row.')
        }
        return {
          run: mergeTransientRunFields(toPublicRun(createdRun), run),
          usage: toPublicLegacyRunUsage(createdUsage),
        }
      })

      return created
    }
  }

  async updateRun(runId: string, input: Partial<Run>) {
    const db = getDb()
    const [updated] = await db
      .update(runs)
      .set({
        status: input.status,
        combinedRiskLevel: input.combinedRiskLevel,
        usesRealWorkspace: input.usesRealWorkspace,
        usesTools: input.usesTools,
        networkEnabled: input.networkEnabled,
        resultSummary: input.resultSummary,
        resultArtifacts: input.resultArtifacts ? toJsonArtifacts({ resultArtifacts: input.resultArtifacts }) : undefined,
        startedAt: input.startedAt ? new Date(input.startedAt) : undefined,
        updatedAt: input.updatedAt ? new Date(input.updatedAt) : new Date(),
        completedAt: input.completedAt ? new Date(input.completedAt) : input.completedAt === null ? null : undefined,
      })
      .where(eq(runs.id, runId))
      .returning()

    return updated ? mergeTransientRunFields(toPublicRun(updated), input) : null
  }

  async listRunsForUser(userId: string) {
    const db = getDb()
    const rows = await db
      .select()
      .from(runs)
      .where(eq(runs.userId, userId))
      .orderBy(desc(runs.createdAt))

    return rows.map(toPublicRun)
  }

  async listRunsForOrder(orderId: string) {
    const db = getDb()
    const rows = await db
      .select()
      .from(runs)
      .where(eq(runs.orderId, orderId))
      .orderBy(desc(runs.createdAt))

    return rows.map(toPublicRun)
  }

  async findRunForUser(runId: string, userId: string) {
    const db = getDb()
    const [row] = await db
      .select()
      .from(runs)
      .where(eq(runs.id, runId))
      .limit(1)

    if (!row || row.userId !== userId) {
      return null
    }

    return toPublicRun(row)
  }

  async findRunUsage(runId: string) {
    const db = getDb()
    try {
      const [row] = await db.select().from(runUsage).where(eq(runUsage.runId, runId)).limit(1)
      return row ? toPublicRunUsage(row) : null
    } catch (error) {
      if (!isMissingLegacyRunUsageColumn(error)) {
        throw error
      }

      const result = await db.execute(legacyRunUsageSelectSql(runId))
      const row = getFirstRow<LegacyRunUsageRow>(result)
      return row ? toPublicLegacyRunUsage(row) : null
    }
  }

  async updateRunUsage(runId: string, input: Partial<RunUsage>) {
    const db = getDb()
    try {
      const [updated] = await db
        .update(runUsage)
        .set({
          providerAcceptedAt: input.providerAcceptedAt ? new Date(input.providerAcceptedAt) : undefined,
          runningStartedAt: input.runningStartedAt ? new Date(input.runningStartedAt) : undefined,
          lastMeaningfulActivityAt:
            input.lastMeaningfulActivityAt
              ? new Date(input.lastMeaningfulActivityAt)
              : input.lastMeaningfulActivityAt === null
                ? null
                : undefined,
          lastOpenClawSessionActivityAt:
            input.lastOpenClawSessionActivityAt
              ? new Date(input.lastOpenClawSessionActivityAt)
              : input.lastOpenClawSessionActivityAt === null
                ? null
                : undefined,
          lastOpenClawSessionProbeAt:
            input.lastOpenClawSessionProbeAt
              ? new Date(input.lastOpenClawSessionProbeAt)
              : input.lastOpenClawSessionProbeAt === null
                ? null
                : undefined,
          openClawSessionCount:
            Object.hasOwn(input, 'openClawSessionCount') ? (input.openClawSessionCount ?? null) : undefined,
          completedAt: input.completedAt ? new Date(input.completedAt) : input.completedAt === null ? null : undefined,
          workspaceReleasedAt:
            input.workspaceReleasedAt ? new Date(input.workspaceReleasedAt) : input.workspaceReleasedAt === null ? null : undefined,
          terminationReason: input.terminationReason,
          workspaceMinutes: input.workspaceMinutes,
          toolCallsCount: input.toolCallsCount,
          inputTokensEst: input.inputTokensEst,
          outputTokensEst: input.outputTokensEst,
          estimatedInternalCostCents: input.estimatedInternalCostCents,
          statusSnapshot: input.statusSnapshot,
          ttlPolicySnapshot: input.ttlPolicySnapshot,
          updatedAt: input.updatedAt ? new Date(input.updatedAt) : new Date(),
        })
        .where(eq(runUsage.runId, runId))
        .returning()

      return updated ? toPublicRunUsage(updated) : null
    } catch (error) {
      if (!isMissingLegacyRunUsageColumn(error)) {
        throw error
      }

      const result = await db.execute(legacyRunUsageUpdateSql(runId, input))
      const updated = getFirstRow<LegacyRunUsageRow>(result)
      return updated ? toPublicLegacyRunUsage(updated) : null
    }
  }
}
