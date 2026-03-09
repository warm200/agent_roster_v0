import type { RunChannelConfig } from '@/lib/types'

import { deleteJson, postJson } from './api'

type ValidateTelegramTokenResponse = {
  botUsername?: string
  channelConfig: RunChannelConfig
}

type StartTelegramPairingResponse = {
  botUsername?: string
  pairingCommand?: string
  channelConfig: RunChannelConfig
}

export async function validateTelegramToken(orderId: string, botToken: string) {
  return postJson<ValidateTelegramTokenResponse, { botToken: string }>(
    `/api/me/orders/${orderId}/run-channel/telegram/validate`,
    { botToken },
  )
}

export async function startTelegramPairing(orderId: string) {
  return postJson<StartTelegramPairingResponse>(
    `/api/me/orders/${orderId}/run-channel/telegram/pairing/start`,
  )
}

export async function disconnectTelegramChannel(orderId: string) {
  return deleteJson<{ channelConfig: RunChannelConfig; orderId: string }>(
    `/api/me/orders/${orderId}/run-channel`,
  )
}
