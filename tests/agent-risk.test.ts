import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  getAgentCapabilityChips,
  getAgentRiskLevel,
  getAgentSummary,
  matchesAgentCatalogFilter,
  sortAgentsForCatalog,
} from '@/lib/agent-risk'
import type { Agent } from '@/lib/types'

function buildAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: 'agent-1',
    slug: 'ops-agent',
    title: 'Ops Agent',
    category: 'automation',
    summary: 'Catalog summary',
    descriptionMarkdown: '## What this agent does\n\n- Helps with workflows.',
    priceCents: 0,
    currency: 'USD',
    status: 'active',
    riskReview: {
      additionalContext: [],
      capabilityFlags: {
        fileWrite: false,
        network: false,
        secrets: false,
        shell: false,
      },
      displayName: 'Ops Agent',
      level: 'info',
      primaryFindings: [],
      summary: 'No high-confidence risky behavior detected.',
    },
    currentVersion: {
      id: 'version-1',
      agentId: 'agent-1',
      version: '1.0.0',
      changelogMarkdown: '',
      previewPromptSnapshot: '',
      runConfigSnapshot: '{}',
      installPackageUrl: '/download',
      installScriptMarkdown: '',
      releaseNotes: '',
      riskProfile: {
        id: 'risk-1',
        agentVersionId: 'version-1',
        chatOnly: false,
        readFiles: false,
        writeFiles: false,
        network: false,
        shell: false,
        riskLevel: 'low',
        scanSummary: 'Low',
        createdAt: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

test('agent risk helpers keep low-visible summaries calm and omit non-primary chips', () => {
  const agent = buildAgent()

  assert.equal(getAgentRiskLevel(agent), 'info')
  assert.equal(getAgentSummary(agent), 'No high-confidence risky behavior detected.')
  assert.deepEqual(getAgentCapabilityChips(agent), [])
  assert.equal(matchesAgentCatalogFilter(agent, 'low-visible'), true)
  assert.equal(matchesAgentCatalogFilter(agent, 'network'), false)
})

test('agent risk helpers sort high-risk agents first and use capability flags for filters', () => {
  const high = buildAgent({
    id: 'agent-high',
    slug: 'test-writer',
    riskReview: {
      additionalContext: [],
      capabilityFlags: {
        fileWrite: false,
        network: true,
        secrets: true,
        shell: false,
      },
      displayName: 'Test Writer',
      level: 'high',
      primaryFindings: [],
      summary: 'Review recommended.',
    },
  })
  const info = buildAgent({
    id: 'agent-info',
    slug: 'ai-engineer',
    riskReview: {
      additionalContext: [],
      capabilityFlags: {
        fileWrite: false,
        network: false,
        secrets: false,
        shell: false,
      },
      displayName: 'Ai Engineer',
      level: 'info',
      primaryFindings: [],
      summary: 'No high-confidence risky behavior detected.',
    },
  })

  const sorted = sortAgentsForCatalog([info, high])

  assert.deepEqual(
    sorted.map((agent) => agent.slug),
    ['test-writer', 'ai-engineer'],
  )
  assert.equal(matchesAgentCatalogFilter(high, 'review'), true)
  assert.equal(matchesAgentCatalogFilter(high, 'network'), true)
  assert.equal(matchesAgentCatalogFilter(high, 'credentials'), true)
})
