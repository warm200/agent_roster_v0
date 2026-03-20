import type { Agent, AgentVersion, BundleRisk, RiskLevel } from './types'

const riskOrder: RiskLevel[] = ['low', 'medium', 'high']

const bundleSummaries: Record<RiskLevel, string> = {
  low: 'No high-risk capabilities detected across the agents in this bundle.',
  medium: 'Some agents in this bundle can read files or reach external services.',
  high: 'One or more agents in this bundle can write files or execute shell commands.',
}

function getHigherRiskLevel(left: RiskLevel, right: RiskLevel): RiskLevel {
  return riskOrder.indexOf(left) >= riskOrder.indexOf(right) ? left : right
}

function inferRiskLevelFromVersion(version: AgentVersion): RiskLevel {
  if (version.riskProfile.shell || version.riskProfile.writeFiles) {
    return 'high'
  }

  if (version.riskProfile.readFiles || version.riskProfile.network) {
    return 'medium'
  }

  return 'low'
}

export function calculateBundleRiskFromVersions(
  items: Array<{
    title: string
    version: AgentVersion
  }>,
): BundleRisk {
  if (items.length === 0) {
    return { level: 'low', highestRiskDriver: null, summary: 'No agents selected' }
  }

  let maxRisk: RiskLevel = 'low'
  let highestRiskDriver: string | null = null

  for (const item of items) {
    const level = inferRiskLevelFromVersion(item.version)
    maxRisk = getHigherRiskLevel(maxRisk, level)

    if (!highestRiskDriver && level !== 'low') {
      highestRiskDriver = item.title
    }

    if (level === 'high') {
      highestRiskDriver = item.title
    }
  }

  return {
    level: maxRisk,
    highestRiskDriver,
    summary: bundleSummaries[maxRisk],
  }
}

export function calculateBundleRiskFromAgents(agents: Agent[]): BundleRisk {
  return calculateBundleRiskFromVersions(
    agents.map((agent) => ({
      title: agent.title,
      version: agent.currentVersion,
    })),
  )
}
