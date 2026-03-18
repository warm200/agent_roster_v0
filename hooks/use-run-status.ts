'use client'

import { useCallback, useEffect, useState } from 'react'

import { getRun, type RunDetailResponse } from '@/services/runs.api'

const INITIAL_NOT_FOUND_RETRIES = 8
const INITIAL_NOT_FOUND_RETRY_MS = 400

function isActiveStatus(status: RunDetailResponse['status']) {
  return status === 'provisioning' || status === 'running'
}

export function useRunStatus(runId: string, intervalMs = 5000) {
  const [run, setRun] = useState<RunDetailResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    try {
      const nextRun = await getRun(runId)
      setRun(nextRun)
      setLoadError(null)
      return nextRun
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load run'
      setLoadError(message)
      throw error instanceof Error ? error : new Error(message)
    }
  }, [runId])

  useEffect(() => {
    let isMounted = true
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    async function loadRun(isInitialLoad: boolean, attempt = 0) {
      let shouldFinishInitialLoad = true

      if (isInitialLoad) {
        setIsLoading(true)
      }

      try {
        const nextRun = await getRun(runId)

        if (!isMounted) {
          return
        }

        setRun(nextRun)
        setLoadError(null)

        if (isActiveStatus(nextRun.status)) {
          timeoutId = setTimeout(() => {
            void loadRun(false)
          }, intervalMs)
        }
      } catch (error) {
        if (!isMounted) {
          return
        }

        const message = error instanceof Error ? error.message : 'Unable to load run'

        if (
          isInitialLoad &&
          message === 'Run not found' &&
          attempt < INITIAL_NOT_FOUND_RETRIES
        ) {
          shouldFinishInitialLoad = false
          timeoutId = setTimeout(() => {
            void loadRun(true, attempt + 1)
          }, INITIAL_NOT_FOUND_RETRY_MS)
          return
        }

        setLoadError(message)
      } finally {
        if (isMounted && isInitialLoad && shouldFinishInitialLoad) {
          setIsLoading(false)
        }
      }
    }

    void loadRun(true)

    return () => {
      isMounted = false
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [intervalMs, runId])

  return {
    run,
    setRun,
    refetch,
    isLoading,
    loadError,
  }
}
