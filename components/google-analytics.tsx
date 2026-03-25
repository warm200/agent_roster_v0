'use client'

import { useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

import { useAuth } from '@/lib/auth-context'
import {
  ensureAnalyticsBootstrap,
  loadGoogleAnalyticsScript,
  persistAttributionFromLocation,
  trackPageView,
  trackSignupOnce,
} from '@/lib/analytics'

type AnalyticsConfigResponse = {
  measurementId?: string | null
}

export function GoogleAnalytics() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { session, status } = useAuth()
  const [measurementId, setMeasurementId] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadConfig() {
      try {
        const response = await fetch('/api/analytics/config', { cache: 'no-store' })

        if (!response.ok) {
          return
        }

        const payload = (await response.json()) as AnalyticsConfigResponse

        if (isMounted) {
          setMeasurementId(payload.measurementId ?? null)
        }
      } catch {
        if (isMounted) {
          setMeasurementId(null)
        }
      }
    }

    void loadConfig()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!measurementId) {
      return
    }

    ensureAnalyticsBootstrap(measurementId)
    loadGoogleAnalyticsScript(measurementId)
  }, [measurementId])

  useEffect(() => {
    const currentPath = searchParams.size > 0 ? `${pathname}?${searchParams.toString()}` : pathname

    persistAttributionFromLocation(searchParams, pathname)

    if (!measurementId) {
      return
    }

    trackPageView(currentPath)
  }, [measurementId, pathname, searchParams])

  useEffect(() => {
    if (!measurementId || status !== 'authenticated') {
      return
    }

    const identity = session?.user?.email ?? session?.user?.name ?? null

    if (!identity) {
      return
    }

    trackSignupOnce(identity)
  }, [measurementId, session?.user?.email, session?.user?.name, status])

  return null
}
