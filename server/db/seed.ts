import { drizzle } from 'drizzle-orm/node-postgres'
import { eq } from 'drizzle-orm'

import { mockAgents } from '@/lib/mock-data'

import { createPool } from './index'
import * as schema from './schema'
import { agents, agentVersions, riskProfiles } from './schema'

async function seed() {
  const pool = createPool()
  const db = drizzle(pool, { schema })

  try {
    const agentRows = mockAgents.map((agent) => ({
      id: agent.id,
      slug: agent.slug,
      title: agent.title,
      category: agent.category,
      summary: agent.summary,
      descriptionMarkdown: agent.descriptionMarkdown,
      priceCents: agent.priceCents,
      currency: agent.currency,
      status: agent.status,
      createdAt: new Date(agent.createdAt),
      updatedAt: new Date(agent.updatedAt),
    }))

    const versionRows = mockAgents.map((agent) => ({
      id: agent.currentVersion.id,
      agentId: agent.currentVersion.agentId,
      version: agent.currentVersion.version,
      changelogMarkdown: agent.currentVersion.changelogMarkdown,
      previewPromptSnapshot: agent.currentVersion.previewPromptSnapshot,
      runConfigSnapshot: agent.currentVersion.runConfigSnapshot,
      installPackageUrl: agent.currentVersion.installPackageUrl,
      installScriptMarkdown: agent.currentVersion.installScriptMarkdown,
      releaseNotes: agent.currentVersion.releaseNotes,
      createdAt: new Date(agent.currentVersion.createdAt),
    }))

    const riskRows = mockAgents.map((agent) => ({
      id: agent.currentVersion.riskProfile.id,
      agentVersionId: agent.currentVersion.riskProfile.agentVersionId,
      chatOnly: agent.currentVersion.riskProfile.chatOnly,
      readFiles: agent.currentVersion.riskProfile.readFiles,
      writeFiles: agent.currentVersion.riskProfile.writeFiles,
      network: agent.currentVersion.riskProfile.network,
      shell: agent.currentVersion.riskProfile.shell,
      riskLevel: agent.currentVersion.riskProfile.riskLevel,
      scanSummary: agent.currentVersion.riskProfile.scanSummary,
      createdAt: new Date(agent.currentVersion.riskProfile.createdAt),
    }))

    for (const riskRow of riskRows) {
      await db.delete(riskProfiles).where(eq(riskProfiles.id, riskRow.id))
    }

    for (const versionRow of versionRows) {
      await db.delete(agentVersions).where(eq(agentVersions.id, versionRow.id))
    }

    for (const agentRow of agentRows) {
      await db.delete(agents).where(eq(agents.id, agentRow.id))
    }

    await db.insert(agents).values(agentRows)
    await db.insert(agentVersions).values(versionRows)
    await db.insert(riskProfiles).values(riskRows)

    console.log(`Seeded ${agentRows.length} agents`)
  } finally {
    await pool.end()
  }
}

seed().catch((error) => {
  console.error('Database seed failed')
  console.error(error)
  process.exit(1)
})
