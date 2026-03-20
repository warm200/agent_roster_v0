import { promises as fs } from 'node:fs'
import path from 'node:path'

import type { AgentRiskFinding, AgentRiskReview, AgentRiskReviewLevel, RiskLevel } from '@/lib/types'

type RawRiskReport = {
  agent_slug: string
  capability_flags?: {
    file_write?: boolean
    hidden_behavior?: boolean
    network?: boolean
    network_description?: boolean
    secrets?: boolean
    shell?: boolean
  }
  display_name?: string
  findings?: Array<{
    code?: string
    evidence?: string | null
    file_path?: string | null
    risk_driving?: boolean
    severity?: string
    title?: string
  }>
  risk_level?: AgentRiskReviewLevel
  summary?: string
}

type RawRiskReportFile = {
  reports?: RawRiskReport[]
}

const REPORT_PATH = path.resolve(process.cwd(), 'agents_file', 'agent-risk-report.json')

function normalizeEvidence(value: string | null | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) {
    return null
  }

  return trimmed.length > 220 ? `${trimmed.slice(0, 217).trimEnd()}...` : trimmed
}

function normalizeSummary(report: RawRiskReport, primaryFindings: AgentRiskFinding[]) {
  if (primaryFindings.length === 0) {
    return 'No high-confidence risky behavior detected.'
  }

  return report.summary?.trim() || 'Review recommended based on the current high-confidence findings.'
}

function toFinding(
  finding: NonNullable<RawRiskReport['findings']>[number],
): AgentRiskFinding | null {
  if (!finding.title?.trim()) {
    return null
  }

  return {
    code: finding.code?.trim() || 'UNKNOWN',
    evidenceSnippet: normalizeEvidence(finding.evidence),
    filePath: finding.file_path?.trim() || null,
    riskDriving: Boolean(finding.risk_driving),
    severity: finding.severity?.trim() || 'INFO',
    title: finding.title.trim(),
  }
}

function fallbackLevelFromStoredRisk(level: RiskLevel): AgentRiskReviewLevel {
  if (level === 'low') {
    return 'info'
  }

  return level
}

export function buildFallbackAgentRiskReview(input: {
  displayName: string
  summary: string
  storedRiskLevel: RiskLevel
  storedScanSummary: string
}) {
  return {
    additionalContext: input.storedScanSummary
      ? [
          {
            code: 'CATALOG_RISK_PROFILE',
            evidenceSnippet: input.storedScanSummary,
            filePath: null,
            riskDriving: false,
            severity: input.storedRiskLevel.toUpperCase(),
            title: 'Catalog risk profile summary',
          },
        ]
      : [],
    capabilityFlags: {
      fileWrite: false,
      network: false,
      secrets: false,
      shell: false,
    },
    displayName: input.displayName,
    level: fallbackLevelFromStoredRisk(input.storedRiskLevel),
    primaryFindings: [],
    summary:
      input.storedRiskLevel === 'low'
        ? 'No high-confidence risky behavior detected.'
        : input.summary,
  } satisfies AgentRiskReview
}

export async function loadAgentRiskReviewMap() {
  let payload: RawRiskReportFile | null = null

  try {
    payload = JSON.parse(await fs.readFile(REPORT_PATH, 'utf8')) as RawRiskReportFile
  } catch (error) {
    const candidate = error as NodeJS.ErrnoException
    if (candidate.code === 'ENOENT') {
      return new Map<string, AgentRiskReview>()
    }

    throw error
  }

  const reports = Array.isArray(payload?.reports) ? payload.reports : []
  const map = new Map<string, AgentRiskReview>()

  for (const report of reports) {
    if (!report.agent_slug) {
      continue
    }

    const findings = (report.findings ?? [])
      .map(toFinding)
      .filter((finding): finding is AgentRiskFinding => Boolean(finding))

    const primaryFindings = findings.filter((finding) => finding.riskDriving)
    const additionalContext = findings.filter((finding) => !finding.riskDriving)

    map.set(report.agent_slug, {
      additionalContext,
      capabilityFlags: {
        fileWrite: Boolean(report.capability_flags?.file_write),
        network: Boolean(report.capability_flags?.network),
        secrets: Boolean(report.capability_flags?.secrets),
        shell: Boolean(report.capability_flags?.shell),
      },
      displayName: report.display_name?.trim() || report.agent_slug,
      level: report.risk_level ?? 'info',
      primaryFindings,
      summary: normalizeSummary(report, primaryFindings),
    })
  }

  return map
}
