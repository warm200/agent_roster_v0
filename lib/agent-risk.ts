import {
  FilePenLine,
  Globe,
  KeyRound,
  Shield,
  ShieldAlert,
  ShieldCheck,
  TerminalSquare,
  type LucideIcon,
} from 'lucide-react'

import type { Agent, AgentRiskReviewLevel } from './types'

export type AgentCatalogFilter = 'all' | 'credentials' | 'low-visible' | 'network' | 'review'

export const AGENT_RISK_BADGE_CONFIG: Record<
  AgentRiskReviewLevel,
  {
    className: string
    icon: LucideIcon
    label: string
  }
> = {
  high: {
    className: 'border-red-500/35 bg-red-500/12 text-red-200',
    icon: ShieldAlert,
    label: 'Review recommended',
  },
  info: {
    className: 'border-slate-400/20 bg-slate-400/8 text-slate-200',
    icon: ShieldCheck,
    label: 'Low visible risk',
  },
  medium: {
    className: 'border-amber-400/35 bg-amber-400/12 text-amber-200',
    icon: Shield,
    label: 'Caution',
  },
}

export const AGENT_FILTER_OPTIONS: Array<{
  id: AgentCatalogFilter
  label: string
}> = [
  { id: 'all', label: 'All' },
  { id: 'review', label: 'Review recommended' },
  { id: 'network', label: 'Has network access' },
  { id: 'credentials', label: 'Handles credentials' },
  { id: 'low-visible', label: 'Low visible risk' },
]

export const AGENT_CAPABILITY_CHIPS = {
  fileWrite: {
    icon: FilePenLine,
    label: 'Writes files',
  },
  network: {
    icon: Globe,
    label: 'Network access',
  },
  secrets: {
    icon: KeyRound,
    label: 'Handles credentials',
  },
  shell: {
    icon: TerminalSquare,
    label: 'Shell access',
  },
} as const

const riskRank: Record<AgentRiskReviewLevel, number> = {
  high: 0,
  medium: 1,
  info: 2,
}

export function getAgentDisplayName(agent: Agent) {
  return agent.riskReview?.displayName || agent.title
}

export function getAgentRiskLevel(agent: Agent): AgentRiskReviewLevel {
  return agent.riskReview?.level || 'info'
}

export function getAgentSummary(agent: Agent) {
  return agent.riskReview?.summary || agent.summary
}

export function getAgentCapabilityChips(agent: Agent, limit = 2) {
  const flags = agent.riskReview?.capabilityFlags

  if (!flags) {
    return []
  }

  return (Object.entries(AGENT_CAPABILITY_CHIPS) as Array<
    [
      keyof typeof AGENT_CAPABILITY_CHIPS,
      (typeof AGENT_CAPABILITY_CHIPS)[keyof typeof AGENT_CAPABILITY_CHIPS],
    ]
  >)
    .filter(([key]) => flags[key])
    .slice(0, limit)
    .map(([key, config]) => ({
      icon: config.icon,
      id: key,
      label: config.label,
    }))
}

export function matchesAgentCatalogFilter(agent: Agent, filter: AgentCatalogFilter) {
  const flags = agent.riskReview?.capabilityFlags
  const level = getAgentRiskLevel(agent)

  switch (filter) {
    case 'review':
      return level === 'high'
    case 'network':
      return Boolean(flags?.network)
    case 'credentials':
      return Boolean(flags?.secrets)
    case 'low-visible':
      return level === 'info'
    case 'all':
    default:
      return true
  }
}

export function sortAgentsForCatalog(agents: Agent[]) {
  return agents.slice().sort((left, right) => {
    const riskDelta = riskRank[getAgentRiskLevel(left)] - riskRank[getAgentRiskLevel(right)]
    if (riskDelta !== 0) {
      return riskDelta
    }

    return getAgentDisplayName(left).localeCompare(getAgentDisplayName(right))
  })
}
