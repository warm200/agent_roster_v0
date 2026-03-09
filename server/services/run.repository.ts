import { desc, eq } from 'drizzle-orm'

import { runSchema } from '@/lib/schemas'
import type { Run } from '@/lib/types'

import { createDb, type DbClient } from '../db'
import { runs } from '../db/schema'

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

export class RunRepository {
  async createRun(run: Run) {
    const db = getDb()
    const [created] = await db.insert(runs).values(toInsertValues(run)).returning()
    return toPublicRun(created)
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
}
