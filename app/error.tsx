'use client'

import { useEffect } from 'react'

import { Header } from '@/components/header'
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
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-12">
        <RouteErrorState
          description="The page failed while loading. Retry the request or head back to the catalog."
          homeHref="/"
          homeLabel="Back Home"
          onRetry={reset}
          title="Something went wrong"
        />
      </div>
    </div>
  )
}
