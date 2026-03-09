'use client'

import { useEffect, useState } from 'react'

import { getRun, type RunDetailResponse } from '@/services/runs.api'

function isActiveStatus(status: RunDetailResponse['status']) {
  return status === 'provisioning' || status === 'running'
}

export function useRunStatus(runId: string, intervalMs = 5000) {
  const [run, setRun] = useState<RunDetailResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    async function loadRun(isInitialLoad: boolean) {
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

        setLoadError(error instanceof Error ? error.message : 'Unable to load run')
      } finally {
        if (isMounted && isInitialLoad) {
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
    isLoading,
    loadError,
  }
}
