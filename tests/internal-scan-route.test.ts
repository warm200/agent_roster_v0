import assert from 'node:assert/strict'
import { test } from 'node:test'

import { NextRequest } from 'next/server'

import { POST } from '@/app/api/internal/scan/route'

function buildVersion() {
  return {
    id: 'version-1',
    agentId: 'agent-1',
    version: '1.0.0',
    changelogMarkdown: '',
    previewPromptSnapshot: 'preview prompt',
    runConfigSnapshot: '{}',
    installPackageUrl: 'https://example.com/install.zip',
    installScriptMarkdown: '',
    releaseNotes: '',
    riskProfile: {
      id: 'risk-1',
      agentVersionId: 'version-1',
      chatOnly: false,
      readFiles: true,
      writeFiles: true,
      network: true,
      shell: false,
      riskLevel: 'low',
      scanSummary: 'Original profile',
      createdAt: new Date().toISOString(),
    },
    createdAt: new Date().toISOString(),
  }
}

test('internal scan route returns inferred risk profile', async () => {
  const request = new NextRequest('http://localhost/api/internal/scan', {
    body: JSON.stringify({
      version: buildVersion(),
    }),
    method: 'POST',
  })

  const response = await POST(request)
  const payload = await response.json()

  assert.equal(response.status, 200)
  assert.equal(payload.riskProfile.riskLevel, 'high')
  assert.equal(payload.riskProfile.writeFiles, true)
  assert.equal(payload.riskProfile.network, true)
})

test('internal scan route rejects missing version payloads', async () => {
  const request = new NextRequest('http://localhost/api/internal/scan', {
    body: JSON.stringify({}),
    method: 'POST',
  })

  const response = await POST(request)
  const payload = await response.json()

  assert.equal(response.status, 400)
  assert.equal(payload.error, 'version is required')
})
