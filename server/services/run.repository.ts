import { desc, eq } from 'drizzle-orm'

import { runSchema, runUsageSchema } from '@/lib/schemas'
import type { Run, RunUsage } from '@/lib/types'

import { createDb, type DbClient } from '../db'
import { runUsage, runs } from '../db/schema'

let dbClient: DbClient | null = null

function getDb() {
  dbClient ??= createDb()
  return dbClient
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

export class RunRepository {
  async createRun(run: Run) {
    const db = getDb()
    const [created] = await db.insert(runs).values(toInsertValues(run)).returning()
    return toPublicRun(created)
  }

  async createProvisioningRun(run: Run, usage: RunUsage) {
    const db = getDb()
    const created = await db.transaction(async (tx) => {
      const [createdRun] = await tx.insert(runs).values(toInsertValues(run)).returning()
      const [createdUsage] = await tx.insert(runUsage).values(toRunUsageInsertValues(usage)).returning()
      return {
        run: toPublicRun(createdRun),
        usage: toPublicRunUsage(createdUsage),
      }
    })

    return created
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

    return updated ? toPublicRun(updated) : null
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
    const [row] = await db.select().from(runUsage).where(eq(runUsage.runId, runId)).limit(1)
    return row ? toPublicRunUsage(row) : null
  }

  async updateRunUsage(runId: string, input: Partial<RunUsage>) {
    const db = getDb()
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
  }
}
