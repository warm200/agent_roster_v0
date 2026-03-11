export class HttpError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
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
    message: candidate?.message ?? String(error),
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

  const candidate = error as { message?: string }
  return candidate?.message?.trim() || fallback
}
