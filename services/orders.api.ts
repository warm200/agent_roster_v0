import type {
  Agent,
  AgentProviderKeyName,
  AgentSetup,
  LaunchPolicyCheck,
  Order,
  RunChannelConfig,
} from '@/lib/types'

import { getJson, patchJson, postJson } from './api'

export interface OrderWithAgents extends Order {
  agents: Agent[]
}

type OrdersResponse = {
  orders: Order[]
  total: number
}

type DownloadsResponse = {
  downloads: Array<{
    orderItemId: string
    downloadUrl: string
    expiresAt: string
  }>
}

type OrderRunChannelResponse = {
  orderId: string
  channelConfig: RunChannelConfig | null
}

export async function listOrders() {
  return getJson<OrdersResponse>('/api/me/orders')
}

export async function getOrder(orderId: string) {
  return getJson<Order>(`/api/me/orders/${orderId}`)
}

export async function updateOrderAgentSetup(
  orderId: string,
  payload: {
    agentSetup: Omit<AgentSetup, 'providerKeyStatus'>
    vendorApiKeys?: Partial<Record<AgentProviderKeyName, string>>
  },
) {
  return patchJson<
    Order,
    {
      agentSetup: Omit<AgentSetup, 'providerKeyStatus'>
      vendorApiKeys?: Partial<Record<AgentProviderKeyName, string>>
    }
  >(`/api/me/orders/${orderId}`, {
    ...payload,
  })
}

export async function getOrderDownloads(orderId: string) {
  return getJson<DownloadsResponse>(`/api/me/orders/${orderId}/download`)
}

export async function getOrderRunChannel(orderId: string) {
  return getJson<OrderRunChannelResponse>(`/api/me/orders/${orderId}/run-channel`)
}

export async function getOrderLaunchPolicy(orderId: string) {
  return getJson<LaunchPolicyCheck>(`/api/me/orders/${orderId}/launch-policy`)
}

export async function createOrderRun(orderId: string) {
  return postJson<{ id: string }>(`/api/me/orders/${orderId}/runs`)
}
