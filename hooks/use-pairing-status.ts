'use client'

import { useEffect, useState } from 'react'

import type { RunChannelConfig } from '@/lib/types'
import { getOrderRunChannel } from '@/services/orders.api'

export function usePairingStatus(orderId: string, enabled: boolean, intervalMs = 3000) {
  const [channelConfig, setChannelConfig] = useState<RunChannelConfig | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPolling, setIsPolling] = useState(false)

  useEffect(() => {
    if (!enabled) {
      setIsPolling(false)
      return
    }

    let isMounted = true
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    async function poll() {
      try {
        const response = await getOrderRunChannel(orderId)

        if (!isMounted) {
          return
        }

        setChannelConfig(response.channelConfig)
        setError(null)

        const isTerminal =
          response.channelConfig?.recipientBindingStatus === 'paired' ||
          response.channelConfig?.recipientBindingStatus === 'failed'

        if (!isTerminal) {
          timeoutId = setTimeout(poll, intervalMs)
        } else {
          setIsPolling(false)
        }
      } catch (nextError) {
        if (!isMounted) {
          return
        }

        setError(nextError instanceof Error ? nextError.message : 'Unable to refresh pairing status')
        timeoutId = setTimeout(poll, intervalMs)
      }
    }

    setIsPolling(true)
    void poll()

    return () => {
      isMounted = false
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [enabled, intervalMs, orderId])

  return {
    channelConfig,
    error,
    isPolling,
  }
}
