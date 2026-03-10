import { and, desc, eq, ilike, inArray, or, type SQL } from 'drizzle-orm'

import { agentSchema } from '@/lib/schemas'
import { mockAgents } from '@/lib/mock-data'
import type { Agent, AgentCategory, PreviewMessage, RiskLevel } from '@/lib/types'

import { createDb, type DbClient } from '../db'
import { agents, agentVersions, riskProfiles } from '../db/schema'
import { HttpError } from '../lib/http'

type AgentRow = typeof agents.$inferSelect
type AgentVersionRow = typeof agentVersions.$inferSelect
type RiskProfileRow = typeof riskProfiles.$inferSelect

type PreviewInterviewInput = {
  agentSlug: string
  messages: PreviewMessage[]
}

type CatalogFilters = {
  category?: AgentCategory
  featured?: boolean
  riskLevel?: RiskLevel
  search?: string
}

type VersionWithRisk = {
  version: AgentVersionRow
  riskProfile: RiskProfileRow
}

type DbAgentRecord = {
  agent: AgentRow
  versions: VersionWithRisk[]
}

type CatalogServiceDeps = {
  generatePreviewReply: (
    promptSnapshot: string,
    messages: PreviewMessage[],
  ) => Promise<string>
  getAgentRecordBySlug: (slug: string) => Promise<DbAgentRecord | null>
  listAgentRecords: (filters: CatalogFilters) => Promise<DbAgentRecord[]>
}

type PreviewResponsesMessage = {
  role: 'assistant' | 'developer' | 'system' | 'user'
  content: Array<{
    text: string
    type: 'input_text' | 'output_text'
  }>
}

function logPreviewDiagnostic(event: string, details: Record<string, unknown>) {
  if (process.env.NODE_ENV === 'test') {
    return
  }

  console.error('[preview/openai]', event, details)
}

export function buildPreviewResponsesInput(
  promptSnapshot: string,
  messages: PreviewMessage[],
): PreviewResponsesMessage[] {
  return [
    {
      role: 'system',
      content: [
        {
          type: 'input_text',
          text: [
            'You are rendering a product preview for a purchasable agent.',
            'Preview mode only.',
            'Do not use tools, files, shell, workspace access, or network access.',
            'Do not claim that you executed actions.',
            'Reply in plain text.',
          ].join(' '),
        },
      ],
    },
    {
      role: 'developer',
      content: [
        {
          type: 'input_text',
          text: `Agent preview prompt snapshot:\n${promptSnapshot}`,
        },
      ],
    },
    ...messages.map((message) => ({
      role: message.role,
      content: [
        {
          type: (message.role === 'assistant' ? 'output_text' : 'input_text') as
            | 'input_text'
            | 'output_text',
          text: message.content,
        },
      ],
    })),
  ]
}

export interface CatalogService {
  listAgents(filters?: CatalogFilters): Promise<Agent[]>
  getAgentBySlug(slug: string): Promise<Agent | null>
  previewInterview(input: PreviewInterviewInput): Promise<{ reply: string }>
}

export class AgentNotFoundError extends Error {
  constructor(slug: string) {
    super(`Agent "${slug}" not found.`)
    this.name = 'AgentNotFoundError'
  }
}

let catalogServiceOverride: CatalogService | null = null
let dbClient: DbClient | null = null

export function getCatalogService(): CatalogService {
  return catalogServiceOverride ?? createCatalogService()
}

export function setCatalogServiceForTesting(service: CatalogService | null) {
  catalogServiceOverride = service
}

export function createCatalogService(
  deps: CatalogServiceDeps = createDefaultCatalogServiceDeps(),
): CatalogService {
  return {
    async listAgents(filters = {}) {
      try {
        const records = await deps.listAgentRecords(filters)
        return filterAgents(records.map(toAgent), filters)
      } catch {
        return filterAgents(mockAgents, filters)
      }
    },

    async getAgentBySlug(slug) {
      try {
        const record = await deps.getAgentRecordBySlug(slug)
        return record ? toAgent(record) : null
      } catch {
        return mockAgents.find((agent) => agent.slug === slug) ?? null
      }
    },

    async previewInterview(input) {
      const agent = await this.getAgentBySlug(input.agentSlug)
      if (!agent) {
        throw new AgentNotFoundError(input.agentSlug)
      }

      const reply = await deps.generatePreviewReply(
        agent.currentVersion.previewPromptSnapshot,
        input.messages,
      )

      return { reply: reply.trim() }
    },
  }
}

function createDefaultCatalogServiceDeps(): CatalogServiceDeps {
  return {
    async listAgentRecords(filters) {
      const db = getDb()
      const clauses: SQL[] = [eq(agents.status, 'active')]

      if (filters.category) {
        clauses.push(eq(agents.category, filters.category))
      }

      const search = filters.search?.trim()
      if (search) {
        const pattern = `%${search}%`
        clauses.push(
          or(
            ilike(agents.slug, pattern),
            ilike(agents.title, pattern),
            ilike(agents.summary, pattern),
            ilike(agents.descriptionMarkdown, pattern),
          ) as SQL,
        )
      }

      const where = clauses.length === 1 ? clauses[0] : and(...clauses)

      const agentRows = await db.select().from(agents).where(where).orderBy(agents.title)
      return hydrateAgentRecords(agentRows)
    },

    async getAgentRecordBySlug(slug) {
      const db = getDb()
      const [agentRow] = await db
        .select()
        .from(agents)
        .where(and(eq(agents.slug, slug), eq(agents.status, 'active')))
        .limit(1)

      if (!agentRow) {
        return null
      }

      const [record] = await hydrateAgentRecords([agentRow])
      return record ?? null
    },

    generatePreviewReply: defaultGeneratePreviewReply,
  }
}

async function hydrateAgentRecords(agentRows: AgentRow[]): Promise<DbAgentRecord[]> {
  if (agentRows.length === 0) {
    return []
  }

  const db = getDb()
  const versionRows = await db
    .select({
      version: agentVersions,
      riskProfile: riskProfiles,
    })
    .from(agentVersions)
    .innerJoin(riskProfiles, eq(riskProfiles.agentVersionId, agentVersions.id))
    .where(
      inArray(
        agentVersions.agentId,
        agentRows.map((agent) => agent.id),
      ),
    )
    .orderBy(desc(agentVersions.createdAt))

  const versionsByAgentId = new Map<string, VersionWithRisk[]>()

  for (const row of versionRows) {
    const existing = versionsByAgentId.get(row.version.agentId) ?? []
    existing.push(row)
    versionsByAgentId.set(row.version.agentId, existing)
  }

  return agentRows.map((agent) => ({
    agent,
    versions: versionsByAgentId.get(agent.id) ?? [],
  }))
}

function toAgent(record: DbAgentRecord): Agent {
  const currentVersionRow = record.versions[0]
  if (!currentVersionRow) {
    throw new Error(`Agent "${record.agent.slug}" has no versions.`)
  }

  return agentSchema.parse({
    id: record.agent.id,
    slug: record.agent.slug,
    title: record.agent.title,
    category: record.agent.category,
    summary: record.agent.summary,
    descriptionMarkdown: record.agent.descriptionMarkdown,
    priceCents: record.agent.priceCents,
    currency: record.agent.currency,
    status: record.agent.status,
    currentVersion: {
      id: currentVersionRow.version.id,
      agentId: currentVersionRow.version.agentId,
      version: currentVersionRow.version.version,
      changelogMarkdown: currentVersionRow.version.changelogMarkdown,
      previewPromptSnapshot: currentVersionRow.version.previewPromptSnapshot,
      runConfigSnapshot: currentVersionRow.version.runConfigSnapshot,
      installPackageUrl: currentVersionRow.version.installPackageUrl,
      installScriptMarkdown: currentVersionRow.version.installScriptMarkdown,
      releaseNotes: currentVersionRow.version.releaseNotes,
      riskProfile: {
        id: currentVersionRow.riskProfile.id,
        agentVersionId: currentVersionRow.riskProfile.agentVersionId,
        chatOnly: currentVersionRow.riskProfile.chatOnly,
        readFiles: currentVersionRow.riskProfile.readFiles,
        writeFiles: currentVersionRow.riskProfile.writeFiles,
        network: currentVersionRow.riskProfile.network,
        shell: currentVersionRow.riskProfile.shell,
        riskLevel: currentVersionRow.riskProfile.riskLevel,
        scanSummary: currentVersionRow.riskProfile.scanSummary,
        createdAt: toIsoString(currentVersionRow.riskProfile.createdAt),
      },
      createdAt: toIsoString(currentVersionRow.version.createdAt),
    },
    createdAt: toIsoString(record.agent.createdAt),
    updatedAt: toIsoString(record.agent.updatedAt),
  })
}

function filterAgents(agentsToFilter: Agent[], filters: CatalogFilters): Agent[] {
  let result = [...agentsToFilter].filter((agent) => agent.status === 'active')

  if (filters.category) {
    result = result.filter((agent) => agent.category === filters.category)
  }

  if (filters.riskLevel) {
    result = result.filter(
      (agent) => agent.currentVersion.riskProfile.riskLevel === filters.riskLevel,
    )
  }

  const search = filters.search?.trim().toLowerCase()
  if (search) {
    result = result.filter((agent) => {
      return (
        agent.slug.toLowerCase().includes(search) ||
        agent.title.toLowerCase().includes(search) ||
        agent.summary.toLowerCase().includes(search) ||
        agent.descriptionMarkdown.toLowerCase().includes(search)
      )
    })
  }

  if (filters.featured) {
    const featuredIds = new Set(mockAgents.slice(0, 3).map((agent) => agent.id))
    result = result.filter((agent) => featuredIds.has(agent.id))
  }

  return result
}

function getDb() {
  dbClient ??= createDb()
  return dbClient
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

async function defaultGeneratePreviewReply(
  promptSnapshot: string,
  messages: PreviewMessage[],
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    return buildFallbackPreviewReply(promptSnapshot, messages)
  }

  if (apiKey.startsWith('op://')) {
    throw new HttpError(
      503,
      'OPENAI_API_KEY is still a 1Password reference. Start the app with `op run --env-file=.env -- pnpm dev` or export the resolved key first.',
    )
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15_000)
  let response: Response | null = null

  const preferredModels = [
    process.env.OPENAI_PREVIEW_MODEL,
    process.env.OPENAI_RUN_MODEL,
    'gpt-5-nano',
    'gpt-4.1-mini',
  ].filter((value, index, values): value is string => Boolean(value) && values.indexOf(value) === index)

  let payload:
    | {
        error?: { code?: string; message?: string }
        output?: Array<{
          content?: Array<{
            text?: string
            type?: string
          }>
          type?: string
        }>
        output_text?: string
      }
    | null = null
  let lastHttpError: HttpError | null = null

  try {
    for (const model of preferredModels) {
      try {
        response = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        body: JSON.stringify({
          model,
          input: buildPreviewResponsesInput(promptSnapshot, messages),
        }),
        signal: controller.signal,
      })
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw new HttpError(504, 'OpenAI preview request timed out after 15 seconds.')
        }

        throw error
      }

      payload = (await response.json()) as {
        error?: { code?: string; message?: string }
        output?: Array<{
          content?: Array<{
            text?: string
            type?: string
          }>
          type?: string
        }>
        output_text?: string
      }

      if (response.ok) {
        break
      }

      const errorMessage = payload.error?.message ?? 'Preview generation failed.'
      const isModelAccessIssue =
        response.status === 400 &&
        /model|does not exist|not found|access|unsupported/i.test(errorMessage)

      logPreviewDiagnostic('upstream_error', {
        errorCode: payload.error?.code ?? null,
        errorMessage,
        model,
        status: response.status,
      })

      lastHttpError = new HttpError(response.status >= 500 ? 502 : response.status, errorMessage)

      if (!isModelAccessIssue) {
        throw lastHttpError
      }
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new HttpError(504, 'OpenAI preview request timed out after 15 seconds.')
    }

    throw error
  } finally {
    clearTimeout(timeoutId)
  }

  if (!response || !response.ok) {
    throw lastHttpError ?? new HttpError(502, 'Preview generation failed.')
  }

  const reply =
    payload?.output_text?.trim() ||
    payload?.output
      ?.flatMap((item) => item.content ?? [])
      .filter((item) => item.type === 'output_text' || item.type === 'text' || typeof item.text === 'string')
      .map((item) => item.text?.trim() ?? '')
      .filter(Boolean)
      .join('\n')
      .trim()

  if (!reply) {
    logPreviewDiagnostic('empty_output', {
      modelTried: preferredModels,
      payload,
      status: response.status,
    })
    throw new HttpError(502, 'Preview generation returned an empty response.')
  }

  return reply
}

function buildFallbackPreviewReply(
  promptSnapshot: string,
  messages: PreviewMessage[],
): string {
  const latestUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === 'user')
    ?.content.trim()
  const promptLead = promptSnapshot.trim().replace(/\s+/g, ' ')

  if (!latestUserMessage) {
    return `Preview only. ${promptLead} I would answer with concise guidance, explicit assumptions, and no real-world actions.`
  }

  return `Preview only. ${promptLead} For your request "${latestUserMessage}", I would summarize the goal, call out constraints, and propose the safest next actions without touching tools, files, workspace, or network.`
}
