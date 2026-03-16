import { and, desc, eq, inArray, isNull, lt, or } from 'drizzle-orm'

import { runtimeInstanceSchema, runtimeIntervalSchema } from '@/lib/schemas'
import type { RuntimeInstance, RuntimeInterval } from '@/lib/types'

import { createDb, type DbClient } from '../db'
import { runtimeInstances, runtimeIntervals } from '../db/schema'

let dbClient: DbClient | null = null

function getDb() {
  dbClient ??= createDb()
  return dbClient
}

function toPublicRuntimeInstance(row: typeof runtimeInstances.$inferSelect): RuntimeInstance {
  return runtimeInstanceSchema.parse({
    id: row.id,
    runId: row.runId,
    userId: row.userId,
    orderId: row.orderId,
    providerName: row.providerName,
    providerInstanceRef: row.providerInstanceRef,
    planId: row.planId,
    runtimeMode: row.runtimeMode,
    persistenceMode: row.persistenceMode,
    state: row.state,
    stopReason: row.stopReason,
    preservedStateAvailable: row.preservedStateAvailable,
    startedAt: row.startedAt?.toISOString() ?? null,
    stoppedAt: row.stoppedAt?.toISOString() ?? null,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    deletedAt: row.deletedAt?.toISOString() ?? null,
    recoverableUntilAt: row.recoverableUntilAt?.toISOString() ?? null,
    workspaceReleasedAt: row.workspaceReleasedAt?.toISOString() ?? null,
    lastReconciledAt: row.lastReconciledAt?.toISOString() ?? null,
    metadataJson: row.metadataJson,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  })
}

function toPublicRuntimeInterval(row: typeof runtimeIntervals.$inferSelect): RuntimeInterval {
  return runtimeIntervalSchema.parse({
    id: row.id,
    runtimeInstanceId: row.runtimeInstanceId,
    runId: row.runId,
    providerInstanceRef: row.providerInstanceRef,
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt?.toISOString() ?? null,
    closeReason: row.closeReason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  })
}

function toRuntimeInstanceInsert(input: RuntimeInstance): typeof runtimeInstances.$inferInsert {
  return {
    id: input.id,
    runId: input.runId,
    userId: input.userId,
    orderId: input.orderId,
    providerName: input.providerName,
    providerInstanceRef: input.providerInstanceRef,
    planId: input.planId,
    runtimeMode: input.runtimeMode,
    persistenceMode: input.persistenceMode,
    state: input.state,
    stopReason: input.stopReason,
    preservedStateAvailable: input.preservedStateAvailable,
    startedAt: input.startedAt ? new Date(input.startedAt) : null,
    stoppedAt: input.stoppedAt ? new Date(input.stoppedAt) : null,
    archivedAt: input.archivedAt ? new Date(input.archivedAt) : null,
    deletedAt: input.deletedAt ? new Date(input.deletedAt) : null,
    recoverableUntilAt: input.recoverableUntilAt ? new Date(input.recoverableUntilAt) : null,
    workspaceReleasedAt: input.workspaceReleasedAt ? new Date(input.workspaceReleasedAt) : null,
    lastReconciledAt: input.lastReconciledAt ? new Date(input.lastReconciledAt) : null,
    metadataJson: input.metadataJson,
    createdAt: new Date(input.createdAt),
    updatedAt: new Date(input.updatedAt),
  }
}

function toRuntimeIntervalInsert(input: RuntimeInterval): typeof runtimeIntervals.$inferInsert {
  return {
    id: input.id,
    runtimeInstanceId: input.runtimeInstanceId,
    runId: input.runId,
    providerInstanceRef: input.providerInstanceRef,
    startedAt: new Date(input.startedAt),
    endedAt: input.endedAt ? new Date(input.endedAt) : null,
    closeReason: input.closeReason,
    createdAt: new Date(input.createdAt),
    updatedAt: new Date(input.updatedAt),
  }
}

export class RuntimeInstanceRepository {
  async createRuntimeInstance(input: RuntimeInstance) {
    const db = getDb()
    const [created] = await db.insert(runtimeInstances).values(toRuntimeInstanceInsert(input)).returning()
    return toPublicRuntimeInstance(created)
  }

  async findRuntimeInstanceByRunId(runId: string) {
    const db = getDb()
    const [row] = await db.select().from(runtimeInstances).where(eq(runtimeInstances.runId, runId)).limit(1)
    return row ? toPublicRuntimeInstance(row) : null
  }

  async updateRuntimeInstance(runId: string, input: Partial<RuntimeInstance>) {
    const db = getDb()
    const [updated] = await db
      .update(runtimeInstances)
      .set({
        providerName: input.providerName,
        providerInstanceRef: input.providerInstanceRef,
        planId: input.planId,
        runtimeMode: input.runtimeMode,
        persistenceMode: input.persistenceMode,
        state: input.state,
        stopReason: input.stopReason,
        preservedStateAvailable: input.preservedStateAvailable,
        startedAt: input.startedAt ? new Date(input.startedAt) : input.startedAt === null ? null : undefined,
        stoppedAt: input.stoppedAt ? new Date(input.stoppedAt) : input.stoppedAt === null ? null : undefined,
        archivedAt: input.archivedAt ? new Date(input.archivedAt) : input.archivedAt === null ? null : undefined,
        deletedAt: input.deletedAt ? new Date(input.deletedAt) : input.deletedAt === null ? null : undefined,
        recoverableUntilAt:
          input.recoverableUntilAt ? new Date(input.recoverableUntilAt) : input.recoverableUntilAt === null ? null : undefined,
        workspaceReleasedAt:
          input.workspaceReleasedAt ? new Date(input.workspaceReleasedAt) : input.workspaceReleasedAt === null ? null : undefined,
        lastReconciledAt:
          input.lastReconciledAt ? new Date(input.lastReconciledAt) : input.lastReconciledAt === null ? null : undefined,
        metadataJson: input.metadataJson,
        updatedAt: input.updatedAt ? new Date(input.updatedAt) : new Date(),
      })
      .where(eq(runtimeInstances.runId, runId))
      .returning()

    return updated ? toPublicRuntimeInstance(updated) : null
  }

  async listRuntimeInstancesNeedingReconcile(input: {
    lastReconciledBefore: string
    limit: number
    states: RuntimeInstance['state'][]
  }) {
    const db = getDb()
    const rows = await db
      .select()
      .from(runtimeInstances)
      .where(
        and(
          inArray(runtimeInstances.state, input.states),
          or(
            isNull(runtimeInstances.lastReconciledAt),
            lt(runtimeInstances.lastReconciledAt, new Date(input.lastReconciledBefore)),
          ),
        ),
      )
      .orderBy(desc(runtimeInstances.updatedAt))
      .limit(input.limit)

    return rows.map(toPublicRuntimeInstance)
  }

  async createRuntimeInterval(input: RuntimeInterval) {
    const db = getDb()
    const [created] = await db.insert(runtimeIntervals).values(toRuntimeIntervalInsert(input)).returning()
    return toPublicRuntimeInterval(created)
  }

  async findOpenRuntimeInterval(runtimeInstanceId: string) {
    const db = getDb()
    const [row] = await db
      .select()
      .from(runtimeIntervals)
      .where(and(eq(runtimeIntervals.runtimeInstanceId, runtimeInstanceId), isNull(runtimeIntervals.endedAt)))
      .orderBy(desc(runtimeIntervals.startedAt))
      .limit(1)
    return row ? toPublicRuntimeInterval(row) : null
  }

  async closeRuntimeInterval(runtimeInstanceId: string, endedAt: string, closeReason: RuntimeInterval['closeReason']) {
    const db = getDb()
    const [openInterval] = await db
      .select()
      .from(runtimeIntervals)
      .where(and(eq(runtimeIntervals.runtimeInstanceId, runtimeInstanceId), isNull(runtimeIntervals.endedAt)))
      .orderBy(desc(runtimeIntervals.startedAt))
      .limit(1)

    if (!openInterval) {
      return null
    }

    const [updated] = await db
      .update(runtimeIntervals)
      .set({
        endedAt: new Date(endedAt),
        closeReason,
        updatedAt: new Date(),
      })
      .where(eq(runtimeIntervals.id, openInterval.id))
      .returning()

    return updated ? toPublicRuntimeInterval(updated) : null
  }
}
