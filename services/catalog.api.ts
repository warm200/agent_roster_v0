import type { Agent, AgentCategory, RiskLevel } from '@/lib/types'

import { api, getJson } from './api'

type ListAgentsResponse = {
  agents: Agent[]
  categories: AgentCategory[]
  total: number
}

export async function getAgents(input?: {
  category?: AgentCategory | null
  featured?: boolean
  riskLevel?: RiskLevel | null
  search?: string
  signal?: AbortSignal
}) {
  const response = await api.get<ListAgentsResponse>('/api/agents', {
    params: {
      category: input?.category || undefined,
      featured: input?.featured || undefined,
      riskLevel: input?.riskLevel || undefined,
      search: input?.search?.trim() || undefined,
    },
    signal: input?.signal,
  })

  return response.data
}

export async function getAgentBySlug(slug: string) {
  return getJson<Agent>(`/api/agents/${slug}`)
}
