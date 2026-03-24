'use client'

import { useEffect } from 'react'

const CHUNK_RELOAD_KEY = 'openroster:chunk-reload'

function shouldRecoverFromChunkError(reason: unknown) {
  const message =
    reason instanceof Error
      ? reason.message
      : typeof reason === 'string'
        ? reason
        : reason && typeof reason === 'object' && 'message' in reason && typeof reason.message === 'string'
          ? reason.message
          : ''

  return (
    message.includes('ChunkLoadError') ||
    message.includes('Failed to load chunk') ||
    message.includes('/_next/static/')
  )
}

function reloadOnceForChunkError(reason: unknown) {
  if (!shouldRecoverFromChunkError(reason) || typeof window === 'undefined') {
    return
  }

  if (window.sessionStorage.getItem(CHUNK_RELOAD_KEY) === '1') {
    window.sessionStorage.removeItem(CHUNK_RELOAD_KEY)
    return
  }

  window.sessionStorage.setItem(CHUNK_RELOAD_KEY, '1')
  window.location.reload()
}

export function ChunkReloadGuard() {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      reloadOnceForChunkError(event.error ?? event.message)
    }

    const handleRejection = (event: PromiseRejectionEvent) => {
      reloadOnceForChunkError(event.reason)
    }

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleRejection)

    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleRejection)
    }
  }, [])

  return null
}
