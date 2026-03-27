'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

import { useAuth } from '@/lib/auth-context'
import {
  persistAttributionFromLocation,
  trackPageView,
  trackSignupOnce,
} from '@/lib/analytics'

export function GoogleAnalytics({
  measurementId,
}: {
  measurementId: string | null
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { session, status } = useAuth()

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
