'use client'

import { useEffect } from 'react'
import type { HeroVariant } from '@/lib/ab-testing'
import { trackEvent } from '@/lib/analytics'

export function AbImpression({ variant }: { variant: HeroVariant }) {
  useEffect(() => {
    trackEvent('ab_hero_impression', { variant })
  }, [variant])

  return null
}
