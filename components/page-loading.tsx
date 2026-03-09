'use client'

import { Header } from '@/components/header'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function PublicPageLoading({
  children,
  descriptionWidth = 'w-80',
  titleWidth = 'w-56',
}: {
  children: React.ReactNode
  descriptionWidth?: string
  titleWidth?: string
}) {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          <div className="space-y-3">
            <Skeleton className={`h-10 ${titleWidth}`} />
            <Skeleton className={`h-5 ${descriptionWidth}`} />
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}

export function AppPageLoading({
  children,
  descriptionWidth = 'w-80',
  titleWidth = 'w-56',
}: {
  children: React.ReactNode
  descriptionWidth?: string
  titleWidth?: string
}) {
  return (
    <div className="space-y-8 p-6 lg:p-8">
      <div className="space-y-3">
        <Skeleton className={`h-10 ${titleWidth}`} />
        <Skeleton className={`h-5 ${descriptionWidth}`} />
      </div>
      {children}
    </div>
  )
}

export function StatGridLoading({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <Card key={index}>
          <CardContent className="space-y-3 p-6">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-4 w-24" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function CardGridLoading({
  cards = 3,
  columns = 'md:grid-cols-2 xl:grid-cols-3',
}: {
  cards?: number
  columns?: string
}) {
  return (
    <div className={`grid gap-6 ${columns}`}>
      {Array.from({ length: cards }).map((_, index) => (
        <Card key={index} className="border-border">
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <Skeleton className="h-5 w-28" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-6 w-3/4" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <div className="flex justify-between">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-16" />
            </div>
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function ListLoading({ rows = 4 }: { rows?: number }) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {Array.from({ length: rows }).map((_, index) => (
            <div
              key={index}
              className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between"
            >
              <div className="min-w-0 flex-1 space-y-3">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-64" />
                <Skeleton className="h-4 w-full" />
              </div>
              <div className="flex items-center gap-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-28" />
                </div>
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function DetailSplitLoading() {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_360px]">
      <div className="space-y-6">
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
      <div className="space-y-6">
        <Skeleton className="h-80 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  )
}
