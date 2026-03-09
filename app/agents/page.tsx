'use client'

import { useEffect, useMemo, useState } from 'react'
import { Header } from '@/components/header'
import { AgentCard } from '@/components/agent-card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useCart } from '@/lib/cart-context'
import { getAgents } from '@/services/catalog.api'
import { toast } from 'sonner'
import type { Agent, AgentCategory } from '@/lib/types'
import { Search, Mail, Calendar, FileText, Zap, BarChart3, LayoutGrid, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

const categoryIcons = {
  analytics: BarChart3,
  automation: Zap,
  calendar: Calendar,
  docs: FileText,
  inbox: Mail,
} as const

const categoryLabels: Record<AgentCategory, string> = {
  analytics: 'Analytics',
  automation: 'Automation',
  calendar: 'Calendar',
  docs: 'Documents',
  inbox: 'Inbox',
}

export default function AgentsPage() {
  const [selectedCategory, setSelectedCategory] = useState<AgentCategory | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [agents, setAgents] = useState<Agent[]>([])
  const [categories, setCategories] = useState<AgentCategory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const { addItem, isInCart } = useCart()

  useEffect(() => {
    let isMounted = true
    const controller = new AbortController()

    async function loadAgents() {
      setIsLoading(true)
      setLoadError(null)

      try {
        const payload = await getAgents({
          category: selectedCategory,
          search: searchQuery,
          signal: controller.signal,
        })

        if (isMounted) {
          setAgents(payload.agents)
          setCategories(payload.categories)
        }
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          return
        }

        if (isMounted) {
          setLoadError(error instanceof Error ? error.message : 'Unable to load agents')
          setAgents([])
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadAgents()

    return () => {
      isMounted = false
      controller.abort()
    }
  }, [searchQuery, selectedCategory])

  const visibleCategories = useMemo(() => {
    return categories
      .slice()
      .sort((left, right) => categoryLabels[left].localeCompare(categoryLabels[right]))
  }, [categories])

  const handleAddToCart = (agent: Agent) => {
    addItem(agent)
    toast.success(`${agent.title} added to cart`)
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <aside className="lg:w-56 shrink-0">
            <div className="sticky top-24">
              <h2 className="text-sm font-medium text-muted-foreground mb-4">Categories</h2>
              <nav className="space-y-1">
                <CategoryButton
                  icon={LayoutGrid}
                  isActive={selectedCategory === null}
                  label="All Categories"
                  onClick={() => setSelectedCategory(null)}
                />
                {visibleCategories.map((category) => (
                  <CategoryButton
                    key={category}
                    icon={categoryIcons[category]}
                    isActive={selectedCategory === category}
                    label={categoryLabels[category]}
                    onClick={() => setSelectedCategory(category)}
                  />
                ))}
              </nav>
            </div>
          </aside>

          <main className="flex-1 min-w-0">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-foreground mb-2">Agent Catalog</h1>
              <p className="text-muted-foreground">
                Browse and purchase Personal Ops agents for your workflows.
              </p>
            </div>

            <div className="relative mb-8">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search agents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-card"
              />
            </div>

            {isLoading ? (
              <CatalogSkeleton />
            ) : loadError ? (
              <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-6 text-center">
                <AlertTriangle className="mx-auto mb-3 h-6 w-6 text-red-400" />
                <p className="font-medium text-red-400">Unable to load agents</p>
                <p className="mt-1 text-sm text-muted-foreground">{loadError}</p>
              </div>
            ) : agents.length > 0 ? (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {agents.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    onAddToCart={handleAddToCart}
                    isInCart={isInCart(agent.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <p className="text-muted-foreground mb-4">No agents found matching your criteria.</p>
                <Button variant="outline" onClick={() => { setSearchQuery(''); setSelectedCategory(null) }}>
                  Clear filters
                </Button>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}

function CategoryButton({
  icon: Icon,
  isActive,
  label,
  onClick,
}: {
  icon: typeof Mail
  isActive: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors text-left',
        isActive
          ? 'bg-secondary text-foreground'
          : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
      )}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  )
}

function CatalogSkeleton() {
  return (
    <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="rounded-xl border border-border p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <Skeleton className="h-5 w-24" />
            </div>
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-4 w-12" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        </div>
      ))}
    </div>
  )
}
