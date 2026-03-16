import { HttpError } from '../lib/http'

type RemoteRuntimeMaintenanceInput = {
  baseUrl?: string
  limit?: number
  staleMinutes?: number
  timeoutMs?: number
  token?: string
}

function trimTrailingSlash(value: string) {
  return value.endsWith('/') ? value.slice(0, -1) : value
}

function resolveBaseUrl(explicitBaseUrl?: string) {
  const baseUrl =
    explicitBaseUrl ??
    process.env.RUNTIME_MAINTENANCE_BASE_URL ??
    process.env.NEXTAUTH_URL

  if (!baseUrl) {
    throw new HttpError(
      503,
      'RUNTIME_MAINTENANCE_BASE_URL or NEXTAUTH_URL must be set for remote runtime maintenance.',
    )
  }

  return trimTrailingSlash(baseUrl)
}

function resolveToken(explicitToken?: string) {
  const token = explicitToken ?? process.env.INTERNAL_API_TOKEN

  if (!token) {
    throw new HttpError(503, 'INTERNAL_API_TOKEN is required for remote runtime maintenance.')
  }

  return token
}

export async function runRemoteRuntimeMaintenance(input: RemoteRuntimeMaintenanceInput = {}) {
  const timeoutMs =
    input.timeoutMs ??
    Math.max(
      1_000,
      Number.parseInt(process.env.RUNTIME_MAINTENANCE_HTTP_TIMEOUT_SECONDS ?? '30', 10) * 1000,
    )
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(
      `${resolveBaseUrl(input.baseUrl)}/api/internal/runtime-maintenance/reconcile`,
      {
        body: JSON.stringify({
          limit: input.limit,
          staleMinutes: input.staleMinutes,
        }),
        headers: {
          authorization: `Bearer ${resolveToken(input.token)}`,
          'content-type': 'application/json',
        },
        method: 'POST',
        signal: controller.signal,
      },
    )

    const payload = (await response.json().catch(() => null)) as
      | {
          error?: string
          result?: unknown
        }
      | null

    if (!response.ok) {
      throw new HttpError(
        response.status,
        payload?.error ?? 'Remote runtime maintenance request failed.',
      )
    }

    return payload?.result ?? null
  } finally {
    clearTimeout(timeout)
  }
}
