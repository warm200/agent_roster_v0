import { readFile } from 'node:fs/promises'

import { DEFAULT_TESSL_REGISTRY_URL } from '@/lib/tessl'
import type { AgentTesslReview } from '@/lib/types'

type JsonObject = Record<string, unknown>

export type AgentTesslSnapshotFile = {
  count: number
  generatedAt: string
  items: AgentTesslReview[]
  sourceUrl: string
}

type LocalTesslSkillReviewPayload = {
  review?: {
    reviewScore?: unknown
  }
  validation?: {
    overallPassed?: unknown
    skillDescription?: unknown
    skillName?: unknown
  }
  descriptionJudge?: {
    normalizedScore?: unknown
  }
  contentJudge?: {
    normalizedScore?: unknown
  }
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseNullableNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function parseNullableInteger(value: unknown) {
  const parsed = parseNullableNumber(value)
  return parsed == null ? null : Math.trunc(parsed)
}

function toIsoString(value: unknown) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function readBooleanCandidate(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'boolean') {
      return value
    }
  }

  return false
}

function normalizeRepoPath(repo: string) {
  return repo
    .replace(/^https?:\/\/github\.com\//, '')
    .replace(/^github\.com\//, '')
    .replace(/\.git$/, '')
    .replace(/\/(?:tree|blob)\/.+$/, '')
    .replace(/\/+$/, '')
    .replace(/^\/+/, '')
}

function getRepoUrl(repo: string) {
  return `https://github.com/${normalizeRepoPath(repo)}`
}

function getRepoRef(repo: string) {
  return normalizeRepoPath(repo)
}

function normalizeFromCandidate(candidate: JsonObject, repoUrl: string) {
  const attributes = isObject(candidate.attributes) ? candidate.attributes : candidate
  const scores = isObject(attributes.scores) ? attributes.scores : isObject(candidate.scores) ? candidate.scores : null

  const rawPath =
    typeof attributes.path === 'string'
      ? attributes.path
      : typeof candidate.path === 'string'
        ? candidate.path
        : null

  if (!rawPath || !rawPath.endsWith('/skills/SKILL.md')) {
    return null
  }

  const slug = rawPath.replace(/\/skills\/SKILL\.md$/, '')
  const title =
    typeof attributes.title === 'string'
      ? attributes.title
      : typeof attributes.name === 'string'
        ? attributes.name
        : typeof candidate.title === 'string'
          ? candidate.title
          : typeof candidate.name === 'string'
            ? candidate.name
            : null

  if (!slug || !title) {
    return null
  }

  const updatedAt = toIsoString(attributes.updatedAt ?? candidate.updatedAt ?? scores?.lastScoredAt)
  if (!updatedAt) {
    return null
  }

  const createdAt = toIsoString(attributes.createdAt ?? candidate.createdAt) ?? updatedAt
  const validationErrors = Array.isArray(scores?.validationErrors) ? scores.validationErrors : []
  const validationPassed = readBooleanCandidate(
    attributes.validationPassed,
    candidate.validationPassed,
  ) || validationErrors.length === 0

  return {
    slug,
    registrySkillName:
      typeof attributes.name === 'string' && attributes.name.trim().length > 0
        ? attributes.name.trim()
        : typeof candidate.name === 'string' && candidate.name.trim().length > 0
          ? candidate.name.trim()
          : slug,
    title: title.trim(),
    description:
      typeof attributes.description === 'string'
        ? attributes.description.trim()
        : typeof candidate.description === 'string'
          ? candidate.description.trim()
          : '',
    sourceUrl:
      typeof attributes.sourceUrl === 'string'
        ? attributes.sourceUrl
        : typeof candidate.sourceUrl === 'string'
          ? candidate.sourceUrl
          : repoUrl,
    path: rawPath,
    createdAt,
    updatedAt,
    validationPassed,
    registryUrl:
      typeof attributes.registryUrl === 'string'
        ? attributes.registryUrl
        : typeof candidate.registryUrl === 'string'
          ? candidate.registryUrl
          : DEFAULT_TESSL_REGISTRY_URL,
    scores: {
      version:
        typeof scores?.version === 'string' && scores.version.trim().length > 0
          ? scores.version
          : 'unknown',
      aggregate: parseNullableNumber(scores?.aggregate),
      quality: parseNullableNumber(scores?.quality),
      impact: parseNullableNumber(scores?.impact),
      security:
        typeof scores?.security === 'string' && scores.security.trim().length > 0
          ? scores.security
          : 'MEDIUM',
      evalAvg: parseNullableNumber(scores?.evalAvg),
      evalBaseline: parseNullableNumber(scores?.evalBaseline),
      evalImprovement: parseNullableNumber(scores?.evalImprovement),
      evalImprovementMultiplier: parseNullableNumber(scores?.evalImprovementMultiplier),
      evalCount: parseNullableInteger(scores?.evalCount),
      lastScoredAt: toIsoString(scores?.lastScoredAt),
    },
  } satisfies AgentTesslReview
}

function walkCandidates(value: unknown, repoUrl: string, bucket: Map<string, AgentTesslReview>) {
  if (Array.isArray(value)) {
    for (const entry of value) {
      walkCandidates(entry, repoUrl, bucket)
    }
    return
  }

  if (!isObject(value)) {
    return
  }

  const normalized = normalizeFromCandidate(value, repoUrl)
  if (normalized) {
    bucket.set(normalized.slug, normalized)
  }

  for (const entry of Object.values(value)) {
    walkCandidates(entry, repoUrl, bucket)
  }
}

export function normalizeTesslSnapshotPayload(
  payload: unknown,
  options: {
    generatedAt?: string
    repo: string
  },
): AgentTesslSnapshotFile {
  const repoUrl = getRepoUrl(options.repo)
  const bucket = new Map<string, AgentTesslReview>()

  walkCandidates(payload, repoUrl, bucket)

  const items = [...bucket.values()].sort((left, right) => left.slug.localeCompare(right.slug))

  return {
    sourceUrl: repoUrl,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    count: items.length,
    items,
  }
}

export function normalizeLocalSkillReview(
  payload: LocalTesslSkillReviewPayload,
  options: {
    generatedAt?: string
    repo: string
    slug: string
    title?: string | null
  },
) {
  const reviewScore = parseNullableNumber(payload.review?.reviewScore)
  if (reviewScore == null) {
    return null
  }

  const repoUrl = getRepoUrl(options.repo)
  const updatedAt = toIsoString(options.generatedAt) ?? new Date().toISOString()
  const descriptionScore = parseNullableNumber(payload.descriptionJudge?.normalizedScore)
  const contentScore = parseNullableNumber(payload.contentJudge?.normalizedScore)
  const normalizedReviewScore = Math.max(0, Math.min(1, reviewScore / 100))
  const qualityCandidates = [contentScore, descriptionScore].filter((value): value is number => value != null)
  const quality =
    qualityCandidates.length > 0
      ? qualityCandidates.reduce((sum, value) => sum + value, 0) / qualityCandidates.length
      : normalizedReviewScore

  return {
    slug: options.slug,
    registrySkillName:
      typeof payload.validation?.skillName === 'string' && payload.validation.skillName.trim().length > 0
        ? payload.validation.skillName.trim()
        : options.slug,
    title:
      options.title?.trim() ||
      (typeof payload.validation?.skillName === 'string' ? payload.validation.skillName.trim() : options.slug),
    description:
      typeof payload.validation?.skillDescription === 'string'
        ? payload.validation.skillDescription.trim()
        : '',
    sourceUrl: repoUrl,
    path: `${options.slug}/skills/SKILL.md`,
    createdAt: updatedAt,
    updatedAt,
    validationPassed: readBooleanCandidate(payload.validation?.overallPassed),
    registryUrl: DEFAULT_TESSL_REGISTRY_URL,
    scores: {
      version: 'local-review',
      aggregate: normalizedReviewScore,
      quality,
      impact: descriptionScore,
      security: 'MEDIUM',
      evalAvg: null,
      evalBaseline: null,
      evalImprovement: null,
      evalImprovementMultiplier: null,
      evalCount: null,
      lastScoredAt: updatedAt,
    },
  } satisfies AgentTesslReview
}

export async function loadRegistrySeedAgents() {
  const file = await readFile('agents_file/agent-risk-report.json', 'utf8')
  const payload = JSON.parse(file) as { reports?: Array<{ agent_slug?: string; display_name?: string }> }

  return (payload.reports ?? [])
    .map((item) => ({
      slug: item.agent_slug?.trim() ?? '',
      title: item.display_name?.trim() ?? '',
    }))
    .filter((item) => item.slug && item.title)
}

export function extractRegistryHtmlReview(
  html: string,
  input: {
    repo: string
    slug: string
  },
) {
  const repoUrl = getRepoUrl(input.repo)
  const escapedRepoUrl = repoUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const escapedPath = `${input.slug}/skills/SKILL.md`.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = html.match(
    new RegExp(
      `type:\\"skill\\",attributes:\\$R\\[\\d+\\]=\\{name:\\"([^\\"]+)\\",description:\\"([^\\"]*)\\",sourceUrl:\\"${escapedRepoUrl}\\",path:\\"${escapedPath}\\",featured:[^,]+,createdAt:\\"([^\\"]+)\\",updatedAt:\\"([^\\"]+)\\",validationPassed:([^,]+),scores:\\$R\\[\\d+\\]=\\{version:\\"([^\\"]+)\\",aggregate:([^,]+),quality:([^,]+),impact:([^,]+),security:\\"([^\\"]+)\\",evalAvg:([^,]+),evalBaseline:([^,]+),evalImprovement:([^,]+),evalImprovementMultiplier:([^,]+),evalCount:([^,]+),validationErrors:\\$R\\[\\d+\\]=\\[(.*?)\\],lastScoredAt:\\"([^\\"]+)\\"\\}`,
    ),
  )

  if (!match) {
    return null
  }

  return normalizeFromCandidate(
    {
      createdAt: match[3],
      description: match[2],
      name: match[1],
      path: `${input.slug}/skills/SKILL.md`,
      registryUrl: DEFAULT_TESSL_REGISTRY_URL,
      sourceUrl: repoUrl,
      updatedAt: match[4],
      validationPassed: match[5] === '!0',
      scores: {
        version: match[6],
        aggregate: parseNullableNumber(match[7]),
        quality: parseNullableNumber(match[8]),
        impact: parseNullableNumber(match[9]),
        security: match[10],
        evalAvg: parseNullableNumber(match[11]),
        evalBaseline: parseNullableNumber(match[12]),
        evalImprovement: parseNullableNumber(match[13]),
        evalImprovementMultiplier: parseNullableNumber(match[14]),
        evalCount: parseNullableInteger(match[15]),
        lastScoredAt: match[17],
        validationErrors: match[16] ? [match[16]] : [],
      },
    },
    repoUrl,
  )
}

export { getRepoRef, getRepoUrl }
