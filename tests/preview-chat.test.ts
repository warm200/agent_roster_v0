import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { PreviewChat, PreviewMessageBody } from '@/components/preview-chat'
import type { Agent } from '@/lib/types'

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

test('preview chat renders a bounded scrolling transcript', () => {
  const markup = renderToStaticMarkup(
    createElement(PreviewChat, {
      agent: buildAgent(),
      userAvatarUrl: 'https://example.com/user.png',
      userName: 'Demo User',
    }),
  )

  assert.match(markup, /aria-label="Preview conversation"/)
  assert.match(markup, /overflow-y-auto/)
  assert.match(markup, /max-h-\[min\(70vh,32rem\)\]/)
  assert.match(markup, /Send preview message/)
})

test('preview message body renders basic markdown structure', () => {
  const markup = renderToStaticMarkup(
    createElement(PreviewMessageBody, {
      content: ['## Plan', '', '- **First** item', '- second item', '', 'Use `pnpm dev`.'].join('\n'),
    }),
  )

  assert.match(markup, /<ul/)
  assert.match(markup, /<strong>First<\/strong>/)
  assert.match(markup, /<code[^>]*>pnpm dev<\/code>/)
})
