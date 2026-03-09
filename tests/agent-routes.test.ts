import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'

import { NextRequest } from 'next/server'

import { GET as getAgent } from '@/app/api/agents/[slug]/route'
import { GET as listAgents } from '@/app/api/agents/route'
import type { Agent } from '@/lib/types'
import {
  setCatalogServiceForTesting,
  type CatalogService,
} from '@/server/services/catalog.service'

function buildAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: 'agent-1',
    slug: 'ops-agent',
    title: 'Ops Agent',
    category: 'automation',
    summary: 'Summarizes ops tasks.',
    descriptionMarkdown: '## What this agent does\n\n- Keeps things moving.',
    priceCents: 4900,
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

afterEach(() => {
  setCatalogServiceForTesting(null)
})

test('agents list route forwards filters to catalog service', async () => {
  let receivedFilters: Record<string, unknown> | undefined

  const stubService: CatalogService = {
    async getAgentBySlug(slug) {
      return buildAgent({ slug })
    },
    async listAgents(filters) {
      receivedFilters = filters ?? {}
      return [buildAgent()]
    },
    async previewInterview() {
      return { reply: 'unused' }
    },
  }

  setCatalogServiceForTesting(stubService)

  const request = new NextRequest(
    'http://localhost/api/agents?category=automation&riskLevel=low&search=ops&featured=true',
  )

  const response = await listAgents(request)
  const payload = await response.json()

  assert.equal(response.status, 200)
  assert.deepEqual(receivedFilters, {
    category: 'automation',
    featured: true,
    riskLevel: 'low',
    search: 'ops',
  })
  assert.equal(payload.total, 1)
  assert.equal(payload.agents[0].slug, 'ops-agent')
})

test('agent detail route returns service-backed agent and 404s missing slug', async () => {
  let receivedSlug = ''

  const stubService: CatalogService = {
    async getAgentBySlug(slug) {
      receivedSlug = slug
      return slug === 'ops-agent' ? buildAgent({ slug }) : null
    },
    async listAgents() {
      return [buildAgent()]
    },
    async previewInterview() {
      return { reply: 'unused' }
    },
  }

  setCatalogServiceForTesting(stubService)

  const detailResponse = await getAgent(
    new NextRequest('http://localhost/api/agents/ops-agent'),
    { params: Promise.resolve({ slug: 'ops-agent' }) },
  )
  const detailPayload = await detailResponse.json()

  assert.equal(detailResponse.status, 200)
  assert.equal(receivedSlug, 'ops-agent')
  assert.equal(detailPayload.title, 'Ops Agent')

  const missingResponse = await getAgent(
    new NextRequest('http://localhost/api/agents/missing-agent'),
    { params: Promise.resolve({ slug: 'missing-agent' }) },
  )
  const missingPayload = await missingResponse.json()

  assert.equal(missingResponse.status, 404)
  assert.equal(missingPayload.error, 'Agent not found')
})
