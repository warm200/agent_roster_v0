import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'

import { NextRequest } from 'next/server'

import type { Agent } from '@/lib/types'
import { POST } from '@/app/api/interviews/preview/route'
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

test('preview route returns service-backed reply', async () => {
  let receivedSlug = ''
  let receivedMessages = 0

  const stubService: CatalogService = {
    async getAgentBySlug(slug) {
      return buildAgent({ slug })
    },
    async listAgents() {
      return [buildAgent()]
    },
    async previewInterview(input) {
      receivedSlug = input.agentSlug
      receivedMessages = input.messages.length
      return { reply: 'Preview reply from service' }
    },
  }

  setCatalogServiceForTesting(stubService)

  const request = new NextRequest('http://localhost/api/interviews/preview', {
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'How do you work?' }],
      slug: 'ops-agent',
    }),
    method: 'POST',
  })

  const response = await POST(request)
  const payload = await response.json()

  assert.equal(response.status, 200)
  assert.equal(payload.reply, 'Preview reply from service')
  assert.equal(receivedSlug, 'ops-agent')
  assert.equal(receivedMessages, 1)
})

test('preview route rejects invalid payloads', async () => {
  const request = new NextRequest('http://localhost/api/interviews/preview', {
    body: JSON.stringify({ slug: 'ops-agent', messages: [] }),
    method: 'POST',
  })

  const response = await POST(request)
  const payload = await response.json()

  assert.equal(response.status, 400)
  assert.equal(payload.error, 'slug or agentId plus messages are required')
})
