'use client'

import Link from 'next/link'
import { AlertTriangle, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface RouteErrorStateProps {
  description: string
  homeHref: string
  homeLabel: string
  onRetry: () => void
  title: string
}

export function RouteErrorState({
  description,
  homeHref,
  homeLabel,
  onRetry,
  title,
}: RouteErrorStateProps) {
  return (
    <Card className="mx-auto max-w-2xl border-red-500/20 bg-red-500/5">
      <CardHeader className="space-y-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10">
          <AlertTriangle className="h-6 w-6 text-red-400" />
        </div>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{description}</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button onClick={onRetry}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
          <Button asChild variant="outline">
            <Link href={homeHref}>{homeLabel}</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
