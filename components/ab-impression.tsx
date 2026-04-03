'use client'

import { usePostHog } from 'posthog-js/react'
import { useEffect } from 'react'
import type { HeroVariant } from '@/lib/ab-testing'
import { trackEvent } from '@/lib/analytics'

export function AbImpression({ variant }: { variant: HeroVariant }) {
  const posthog = usePostHog()

  useEffect(() => {
    trackEvent('ab_hero_impression', { variant })
    posthog?.capture('ab_hero_impression', { variant })
  }, [variant, posthog])

  return null
}
