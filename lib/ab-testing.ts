/**
 * A/B testing utilities for landing page hero variants.
 *
 * Variants:
 *   A — "control"   (current copy)
 *   B — "workflow"   (pain → relief framing)
 *   C — "outcome"    (concrete morning result)
 *   D — "trust"      (transparency-first)
 */

export const AB_COOKIE_NAME = 'or_ab_hero'
export const AB_COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

export const HERO_VARIANTS = ['control', 'workflow', 'outcome', 'trust'] as const
export type HeroVariant = (typeof HERO_VARIANTS)[number]

export type HeroCopy = {
  kicker: string
  headline: string
  headlineAccent: string
  headlineTail: string
  subhead: string
}

export const HERO_COPY: Record<HeroVariant, HeroCopy> = {
  control: {
    kicker: 'Compose bundles, not one-off tools',
    headline: 'Build focused',
    headlineAccent: ' work bundles ',
    headlineTail: 'that run like a real workspace.',
    subhead:
      'OpenRoster is not mainly about buying a single agent. It is about composing the right combinations, running them as a bundle, and keeping the setups that actually fit your day.',
  },
  workflow: {
    kicker: 'Your morning ops, on autopilot',
    headline: 'Stop wiring agents together.',
    headlineAccent: ' Compose a bundle ',
    headlineTail: 'and launch the whole workflow.',
    subhead:
      'OpenRoster is the managed-agent marketplace where the product is the combination. Pick agents, shape a bundle, preview before you pay, and run the workspace when the job is real.',
  },
  outcome: {
    kicker: '50+ agents. Free to preview. Pay only to run.',
    headline: 'Three agents.',
    headlineAccent: ' One operating loop. ',
    headlineTail: 'Done before standup.',
    subhead:
      'OpenRoster lets you compose agent bundles that handle your daily ops — inbox triage, calendar guard, daily brief — as a single managed workspace. Preview any agent first. Risk labels upfront. No mystery permissions.',
  },
  trust: {
    kicker: 'Agent marketplace. Bundle-first. Risk-transparent.',
    headline: 'See everything',
    headlineAccent: ' before you pay ',
    headlineTail: 'for anything.',
    subhead:
      'Free preview chat with every agent. Plain-English risk labels on every bundle. Transparent pricing — agents are free, you pay only for managed runtime. No blanket permissions. No mystery behavior.',
  },
}

/** Pick a random variant with equal weight. */
export function pickVariant(): HeroVariant {
  return HERO_VARIANTS[Math.floor(Math.random() * HERO_VARIANTS.length)]
}

/** Validate a cookie value back to a known variant. */
export function parseVariant(raw: string | undefined | null): HeroVariant | null {
  if (!raw) return null
  return HERO_VARIANTS.includes(raw as HeroVariant) ? (raw as HeroVariant) : null
}
