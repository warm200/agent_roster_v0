import type { RunChannelConfig } from '@/lib/types'

import { getJson } from './api'

type OrderRunChannelResponse = {
  orderId: string
  channelConfig: RunChannelConfig | null
}

export async function getOrderRunChannel(orderId: string) {
  return getJson<OrderRunChannelResponse>(`/api/me/orders/${orderId}/run-channel`)
}
