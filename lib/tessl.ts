import type { AgentTesslReview } from '@/lib/types'

export const DEFAULT_TESSL_REGISTRY_URL =
  'https://tessl.io/registry/skills/github/OpenRoster-ai/awesome-agents'

export function formatTesslScore(score: number | null | undefined) {
  if (score == null) {
    return 'N/A'
  }

  return `${Math.round(score * 100)}`
}

export function getTesslValidationLabel(review: Pick<AgentTesslReview, 'validationPassed'>) {
  return review.validationPassed ? 'Validated' : 'Needs fixes'
}

export function getTesslValidationClassName(review: Pick<AgentTesslReview, 'validationPassed'>) {
  return review.validationPassed
    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
    : 'border-orange-500/30 bg-orange-500/10 text-orange-200'
}

export function getTesslSecurityClassName(
  security: AgentTesslReview['scores']['security'],
) {
  switch (security) {
    case 'LOW':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
    case 'MEDIUM':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-200'
    case 'HIGH':
      return 'border-orange-500/30 bg-orange-500/10 text-orange-200'
    case 'CRITICAL':
      return 'border-red-500/30 bg-red-500/10 text-red-300'
    default:
      return 'border-border/70 bg-background/70 text-muted-foreground'
  }
}

export function getTesslSummary(review: AgentTesslReview) {
  const aggregate = formatTesslScore(review.scores.aggregate)
  const quality = formatTesslScore(review.scores.quality)

  if (review.validationPassed) {
    return `Tessl validated this skill with ${aggregate}/100 overall and ${quality}/100 quality.`
  }

  return `Tessl flagged this skill before validation with ${aggregate}/100 overall and ${quality}/100 quality.`
}

function encodeSkillName(skillName: string) {
  return encodeURIComponent(skillName.trim())
}

export function getTesslRegistryUrl(
  review: Pick<AgentTesslReview, 'registryUrl' | 'registrySkillName' | 'slug'>,
) {
  const registryUrl = review.registryUrl?.trim()
  const baseUrl =
    registryUrl && !registryUrl.includes('awesome-openroster')
      ? registryUrl
      : DEFAULT_TESSL_REGISTRY_URL

  const skillName = review.registrySkillName?.trim() || review.slug
  const encodedSkillName = encodeSkillName(skillName)

  return baseUrl.endsWith(`/${encodedSkillName}`)
    ? baseUrl
    : `${baseUrl.replace(/\/+$/, '')}/${encodedSkillName}`
}
