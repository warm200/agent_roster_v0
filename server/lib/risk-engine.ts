import type { Agent, AgentVersion, BundleRisk, RiskLevel, RiskProfile } from '@/lib/types'

const riskOrder: RiskLevel[] = ['low', 'medium', 'high']

const bundleSummaries: Record<RiskLevel, string> = {
  low: 'This bundle has low operational risk. Agents have limited capabilities and clear boundaries.',
  medium:
    'This bundle has medium operational risk. Some agents can read files or access external services.',
  high: 'This bundle has high operational risk. One or more agents can write files or execute shell commands.',
}

export function getHigherRiskLevel(left: RiskLevel, right: RiskLevel): RiskLevel {
  return riskOrder.indexOf(left) >= riskOrder.indexOf(right) ? left : right
}

export function inferRiskLevelFromProfile(profile: RiskProfile): RiskLevel {
  if (profile.shell || profile.writeFiles) {
    return 'high'
  }

  if (profile.readFiles || profile.network) {
    return 'medium'
  }

  return 'low'
}

export function scanAgentVersion(version: AgentVersion): RiskProfile {
  const inferredRiskLevel = inferRiskLevelFromProfile(version.riskProfile)

  return {
    ...version.riskProfile,
    riskLevel: inferredRiskLevel,
  }
}

export function calculateBundleRiskFromAgents(agents: Agent[]): BundleRisk {
  if (agents.length === 0) {
    return { level: 'low', highestRiskDriver: null, summary: 'No agents selected' }
  }

  let maxRisk: RiskLevel = 'low'
  let highestRiskDriver: string | null = null

  for (const agent of agents) {
    const scannedProfile = scanAgentVersion(agent.currentVersion)
    maxRisk = getHigherRiskLevel(maxRisk, scannedProfile.riskLevel)

    if (!highestRiskDriver && scannedProfile.riskLevel !== 'low') {
      highestRiskDriver = agent.title
    }

    if (scannedProfile.riskLevel === 'high') {
      highestRiskDriver = agent.title
    }
  }

  return {
    level: maxRisk,
    highestRiskDriver,
    summary: bundleSummaries[maxRisk],
  }
}

export function calculateBundleRiskFromVersions(versions: AgentVersion[]): BundleRisk {
  if (versions.length === 0) {
    return { level: 'low', highestRiskDriver: null, summary: 'No agents selected' }
  }

  let maxRisk: RiskLevel = 'low'
  let highestRiskDriver: string | null = null

  for (const version of versions) {
    const scannedProfile = scanAgentVersion(version)
    maxRisk = getHigherRiskLevel(maxRisk, scannedProfile.riskLevel)

    if (!highestRiskDriver && scannedProfile.riskLevel !== 'low') {
      highestRiskDriver = version.agentId
    }

    if (scannedProfile.riskLevel === 'high') {
      highestRiskDriver = version.agentId
    }
  }

  return {
    level: maxRisk,
    highestRiskDriver,
    summary: bundleSummaries[maxRisk],
  }
}
