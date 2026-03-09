'use client'

import { useEffect } from 'react'

import { RouteErrorState } from '@/components/route-error-state'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="p-6 lg:p-8">
      <RouteErrorState
        description="The authenticated workbench hit an unexpected error. Retry this screen or return to the dashboard."
        homeHref="/app"
        homeLabel="Back to Dashboard"
        onRetry={reset}
        title="Workbench error"
      />
    </div>
  )
}
