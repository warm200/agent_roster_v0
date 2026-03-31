import { promises as fs } from 'node:fs'
import path from 'node:path'

import type { AgentTesslReview } from '@/lib/types'

type RawTesslScores = {
  aggregate?: number | null
  evalAvg?: number | null
  evalBaseline?: number | null
  evalCount?: number | null
  evalImprovement?: number | null
  evalImprovementMultiplier?: number | null
  impact?: number | null
  lastScoredAt?: string | null
  quality?: number | null
  security?: string
  version?: string
}

type RawTesslReview = {
  createdAt?: string
  description?: string
  path?: string
  registryUrl?: string
  registrySkillName?: string
  scores?: RawTesslScores
  slug?: string
  sourceUrl?: string
  title?: string
  updatedAt?: string
  validationPassed?: boolean
}

type RawTesslReviewFile = {
  items?: RawTesslReview[]
}

const REPORT_PATH = path.resolve(process.cwd(), 'agents_file', 'tessl-evals.json')

function toIsoString(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function toReview(item: RawTesslReview): AgentTesslReview | null {
  if (!item.slug?.trim() || !item.title?.trim() || !item.sourceUrl?.trim() || !item.path?.trim()) {
    return null
  }

  const createdAt = toIsoString(item.createdAt)
  const updatedAt = toIsoString(item.updatedAt)
  if (!updatedAt) {
    return null
  }

  return {
    slug: item.slug.trim(),
    registrySkillName: item.registrySkillName?.trim() || item.slug.trim(),
    title: item.title.trim(),
    description: item.description?.trim() ?? '',
    sourceUrl: item.sourceUrl.trim(),
    path: item.path.trim(),
    createdAt: createdAt ?? updatedAt,
    updatedAt,
    validationPassed: Boolean(item.validationPassed),
    registryUrl: item.registryUrl?.trim() || 'https://tessl.io/registry',
    scores: {
      version: item.scores?.version?.trim() || 'unknown',
      aggregate: item.scores?.aggregate ?? null,
      quality: item.scores?.quality ?? null,
      impact: item.scores?.impact ?? null,
      security: item.scores?.security?.trim() || 'MEDIUM',
      evalAvg: item.scores?.evalAvg ?? null,
      evalBaseline: item.scores?.evalBaseline ?? null,
      evalImprovement: item.scores?.evalImprovement ?? null,
      evalImprovementMultiplier: item.scores?.evalImprovementMultiplier ?? null,
      evalCount:
        typeof item.scores?.evalCount === 'number' ? Math.trunc(item.scores.evalCount) : null,
      lastScoredAt: toIsoString(item.scores?.lastScoredAt) ?? null,
    },
  }
}

export async function loadAgentTesslReviewMap() {
  let payload: RawTesslReviewFile | null = null

  try {
    payload = JSON.parse(await fs.readFile(REPORT_PATH, 'utf8')) as RawTesslReviewFile
  } catch (error) {
    const candidate = error as NodeJS.ErrnoException
    if (candidate.code === 'ENOENT') {
      return new Map<string, AgentTesslReview>()
    }

    throw error
  }

  const map = new Map<string, AgentTesslReview>()

  for (const item of payload.items ?? []) {
    const review = toReview(item)
    if (!review) {
      continue
    }

    map.set(review.slug, review)
  }

  return map
}
