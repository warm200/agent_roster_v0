export class HttpError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

function firstString(values: Array<unknown>) {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (trimmed.length > 0 && trimmed !== '[object Object]') {
        return trimmed
      }
    }
  }

  return null
}

export function extractErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'string') {
    return firstString([error]) ?? fallback
  }

  if (!error || typeof error !== 'object') {
    return fallback
  }

  const candidate = error as {
    cause?: unknown
    detail?: unknown
    error?: unknown
    message?: unknown
    response?: { data?: unknown; status?: number }
  }
  const responseData =
    candidate.response?.data && typeof candidate.response.data === 'object'
      ? (candidate.response.data as { detail?: unknown; error?: unknown; message?: unknown })
      : null
  const nestedError =
    candidate.error && typeof candidate.error === 'object'
      ? (candidate.error as { detail?: unknown; message?: unknown })
      : null

  return (
    firstString([
      candidate.message,
      responseData?.error,
      responseData?.message,
      responseData?.detail,
      nestedError?.message,
      nestedError?.detail,
      candidate.detail,
    ]) ?? fallback
  )
}

export function isDevelopmentServer() {
  return process.env.NODE_ENV !== 'production'
}

export function logServerError(
  scope: string,
  error: unknown,
  details?: Record<string, unknown>,
) {
  const candidate = error as {
    cause?: unknown
    message?: string
    name?: string
    response?: { data?: unknown; status?: number }
    stack?: string
    status?: number
    statusCode?: number
  }

  console.error(`[${scope}]`, {
    ...(details ?? {}),
    message: extractErrorMessage(error, 'Unexpected server error'),
    name: candidate?.name ?? 'Error',
    responseBody: candidate?.response?.data,
    responseStatus: candidate?.response?.status,
    status: candidate?.status ?? candidate?.statusCode,
    cause: candidate?.cause,
    stack: candidate?.stack,
  })
}

export function unexpectedErrorMessage(error: unknown, fallback: string) {
  if (!isDevelopmentServer()) {
    return fallback
  }

  return extractErrorMessage(error, fallback)
}
