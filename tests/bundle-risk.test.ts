import assert from 'node:assert/strict'
import { test } from 'node:test'

import { calculateBundleRiskFromAgents, calculateBundleRiskFromVersions } from '@/lib/bundle-risk'
import type { Agent, AgentVersion } from '@/lib/types'

function buildVersion(
  riskLevel: AgentVersion['riskProfile']['riskLevel'],
  overrides?: Partial<AgentVersion['riskProfile']>,
): AgentVersion {
  return {
    id: `ver-${riskLevel}`,
    agentId: `agent-${riskLevel}`,
    version: '1.0.0',
    changelogMarkdown: '',
    previewPromptSnapshot: '',
    runConfigSnapshot: '{}',
    installPackageUrl: '/download.zip',
    installScriptMarkdown: '',
    releaseNotes: '',
    riskProfile: {
      id: `risk-${riskLevel}`,
      agentVersionId: `ver-${riskLevel}`,
      chatOnly: false,
      readFiles: riskLevel === 'medium',
      writeFiles: riskLevel === 'high',
      network: false,
      shell: false,
      riskLevel,
      scanSummary: riskLevel,
      createdAt: new Date().toISOString(),
      ...overrides,
    },
    createdAt: new Date().toISOString(),
  }
}

test('bundle risk uses the current agent versions instead of a stale stored aggregate', () => {
  const bundleRisk = calculateBundleRiskFromVersions([
    { title: 'Planner', version: buildVersion('low') },
    { title: 'Test Writer', version: buildVersion('high') },
  ])

  assert.equal(bundleRisk.level, 'high')
  assert.equal(bundleRisk.highestRiskDriver, 'Test Writer')
})

test('bundle risk from agents follows the currentVersion risk profile', () => {
  const agents: Agent[] = [
    {
      id: 'agent-1',
      slug: 'planner',
      title: 'Planner',
      category: 'automation',
      summary: 'summary',
      descriptionMarkdown: 'desc',
      priceCents: 0,
      currency: 'USD',
      status: 'active',
      currentVersion: buildVersion('medium', { network: true }),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]

  const bundleRisk = calculateBundleRiskFromAgents(agents)

  assert.equal(bundleRisk.level, 'medium')
  assert.equal(bundleRisk.highestRiskDriver, 'Planner')
})
