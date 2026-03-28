import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createCatalogService } from '@/server/services/catalog.service'
import type { Agent } from '@/lib/types'

function buildAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: 'agent-1',
    slug: 'real-agent',
    title: 'Real Agent',
    category: 'automation',
    summary: 'Backed by the real catalog.',
    descriptionMarkdown: '## What this agent does\n\n- Runs from the DB-backed catalog.',
    priceCents: 0,
    currency: 'USD',
    status: 'active',
    currentVersion: {
      id: 'version-1',
      agentId: 'agent-1',
      version: '1.0.0',
      changelogMarkdown: '',
      previewPromptSnapshot: 'Preview prompt snapshot',
      runConfigSnapshot: '{}',
      installPackageUrl: 'https://example.com/install.zip',
      installScriptMarkdown: '',
      releaseNotes: '',
      riskProfile: {
        id: 'risk-1',
        agentVersionId: 'version-1',
        chatOnly: true,
        readFiles: false,
        writeFiles: false,
        network: false,
        shell: false,
        riskLevel: 'low',
        scanSummary: 'Low risk',
        createdAt: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

test('catalog service does not fall back to mock agents when list fails', async () => {
  const service = createCatalogService({
    async generatePreviewReply() {
      return 'unused'
    },
    async getAgentRecordBySlug() {
      return null
    },
    async listAgentRecords() {
      throw new Error('db unavailable')
    },
  })

  await assert.rejects(() => service.listAgents(), /db unavailable/)
})

test('catalog service does not fall back to mock agents when slug lookup fails', async () => {
  const service = createCatalogService({
    async generatePreviewReply() {
      return 'unused'
    },
    async getAgentRecordBySlug() {
      throw new Error('db unavailable')
    },
    async listAgentRecords() {
      return []
    },
  })

  await assert.rejects(() => service.getAgentBySlug('calendar-optimizer'), /db unavailable/)
})

test('catalog service featured filter uses real ordered catalog results', async () => {
  const agents = [
    buildAgent({ id: 'agent-1', slug: 'alpha', title: 'Alpha Agent' }),
    buildAgent({ id: 'agent-2', slug: 'bravo', title: 'Bravo Agent' }),
    buildAgent({ id: 'agent-3', slug: 'charlie', title: 'Charlie Agent' }),
    buildAgent({ id: 'agent-4', slug: 'delta', title: 'Delta Agent' }),
  ]

  const service = createCatalogService({
    async generatePreviewReply() {
      return 'unused'
    },
    async getAgentRecordBySlug() {
      return null
    },
    async listAgentRecords() {
      return agents.map((agent) => ({
        agent: {
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
        },
        versions: [
          {
            riskProfile: {
              ...agent.currentVersion.riskProfile,
              createdAt: new Date(agent.currentVersion.riskProfile.createdAt),
            },
            version: {
              ...agent.currentVersion,
              createdAt: new Date(agent.currentVersion.createdAt),
            },
          },
        ],
      }))
    },
  })

  const featured = await service.listAgents({ featured: true })

  assert.deepEqual(
    featured.map((agent) => agent.slug),
    ['alpha', 'bravo', 'charlie'],
  )
})

test('catalog service prioritizes gif-backed local agent thumbnails', async () => {
  const agents = [
    buildAgent({
      id: 'agent-1',
      slug: 'still-image',
      title: 'Still Image',
      currentVersion: {
        ...buildAgent().currentVersion,
        id: 'version-1',
        agentId: 'agent-1',
        runConfigSnapshot: JSON.stringify({
          source: {
            kind: 'local-folder',
            slug: 'still-image',
            sourceRootRelativePath: 'agents_file/still-image',
            stagingRelativePath: 'still-image',
            openClawConfigRelativePath: null,
            avatarRelativePath: 'avatars/avatar.png',
            thumbnailRelativePath: 'avatars/avatar.png',
          },
        }),
      },
    }),
    buildAgent({
      id: 'agent-2',
      slug: 'animated-helper',
      title: 'Animated Helper',
      currentVersion: {
        ...buildAgent().currentVersion,
        id: 'version-2',
        agentId: 'agent-2',
        runConfigSnapshot: JSON.stringify({
          source: {
            kind: 'local-folder',
            slug: 'animated-helper',
            sourceRootRelativePath: 'agents_file/animated-helper',
            stagingRelativePath: 'animated-helper',
            openClawConfigRelativePath: null,
            avatarRelativePath: 'avatars/avatar.png',
            thumbnailRelativePath: 'thumbnail/avatar.gif',
          },
        }),
      },
    }),
  ]

  const service = createCatalogService({
    async generatePreviewReply() {
      return 'unused'
    },
    async getAgentRecordBySlug() {
      return null
    },
    async listAgentRecords() {
      return agents.map((agent) => ({
        agent: {
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
        },
        versions: [
          {
            riskProfile: {
              ...agent.currentVersion.riskProfile,
              createdAt: new Date(agent.currentVersion.riskProfile.createdAt),
            },
            version: {
              ...agent.currentVersion,
              createdAt: new Date(agent.currentVersion.createdAt),
            },
          },
        ],
      }))
    },
  })

  const results = await service.listAgents()

  assert.deepEqual(
    results.map((agent) => agent.slug),
    ['animated-helper', 'still-image'],
  )
})

test('catalog service records preview interactions with the latest user question and reply', async () => {
  let recorded:
    | {
        agentId: string
        agentSlug: string
        latestUserMessage: string
        messages: Array<{ content: string; role: 'user' | 'assistant' }>
        reply: string
        userId: string
      }
    | undefined

  const agent = buildAgent({ id: 'agent-preview-1', slug: 'preview-agent' })
  const service = createCatalogService({
    async generatePreviewReply() {
      return 'Preview reply from model'
    },
    async getAgentRecordBySlug() {
      return {
        agent: {
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
        },
        versions: [
          {
            riskProfile: {
              ...agent.currentVersion.riskProfile,
              createdAt: new Date(agent.currentVersion.riskProfile.createdAt),
            },
            version: {
              ...agent.currentVersion,
              createdAt: new Date(agent.currentVersion.createdAt),
            },
          },
        ],
      }
    },
    async listAgentRecords() {
      return []
    },
    async recordPreviewInteraction(input) {
      recorded = input
    },
  })

  const response = await service.previewInterview({
    agentSlug: 'preview-agent',
    messages: [
      { role: 'user', content: 'What do you do?' },
      { role: 'assistant', content: 'I explain the agent.' },
      { role: 'user', content: 'Can you triage urgent inbox items?' },
    ],
    userId: 'user-preview-1',
  })

  assert.equal(response.reply, 'Preview reply from model')
  assert.deepEqual(recorded, {
    agentId: 'agent-preview-1',
    agentSlug: 'preview-agent',
    latestUserMessage: 'Can you triage urgent inbox items?',
    messages: [
      { role: 'user', content: 'What do you do?' },
      { role: 'assistant', content: 'I explain the agent.' },
      { role: 'user', content: 'Can you triage urgent inbox items?' },
    ],
    reply: 'Preview reply from model',
    userId: 'user-preview-1',
  })
})
