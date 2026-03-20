'use client'

import { useEffect, useMemo, useState } from 'react'
import { Header } from '@/components/header'
import { AgentCard } from '@/components/agent-card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useCart } from '@/lib/cart-context'
import { AGENT_FILTER_OPTIONS, matchesAgentCatalogFilter, sortAgentsForCatalog } from '@/lib/agent-risk'
import { getAgents } from '@/services/catalog.api'
import { toast } from 'sonner'
import type { Agent, AgentCategory } from '@/lib/types'
import { Search, Mail, Calendar, FileText, Zap, BarChart3, LayoutGrid } from 'lucide-react'
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
  const [selectedFilter, setSelectedFilter] = useState<(typeof AGENT_FILTER_OPTIONS)[number]['id']>('all')
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

  const visibleAgents = useMemo(() => {
    return sortAgentsForCatalog(
      agents.filter((agent) => matchesAgentCatalogFilter(agent, selectedFilter)),
    )
  }, [agents, selectedFilter])

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
              <h1 className="mb-2 text-3xl font-bold text-foreground">Agent Catalog</h1>
              <p className="max-w-3xl text-muted-foreground">
                Scan the catalog by visible risk first. Open any agent to review the evidence in full and try the preview chat there.
              </p>
            </div>

            <div className="mb-8 space-y-4 rounded-[1.5rem] border border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(10,10,12,0.92))] p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search agents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="border-border/70 bg-card pl-10"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {AGENT_FILTER_OPTIONS.map((filter) => (
                  <Button
                    key={filter.id}
                    className={cn(
                      'rounded-full',
                      selectedFilter === filter.id ? '' : 'bg-background/60',
                    )}
                    onClick={() => setSelectedFilter(filter.id)}
                    size="sm"
                    variant={selectedFilter === filter.id ? 'default' : 'outline'}
                  >
                    {filter.label}
                  </Button>
                ))}
              </div>
            </div>

            {isLoading ? (
              <CatalogSkeleton />
            ) : loadError ? (
              <div className="rounded-[1.5rem] border border-border/70 bg-card p-8 text-center">
                <p className="font-medium text-foreground">Unable to load agents</p>
                <p className="mt-2 text-sm text-muted-foreground">{loadError}</p>
              </div>
            ) : visibleAgents.length > 0 ? (
              <>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    {visibleAgents.length} agent{visibleAgents.length === 1 ? '' : 's'} shown
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {visibleAgents.map((agent) => (
                    <AgentCard
                      key={agent.id}
                      agent={agent}
                      onAddToCart={handleAddToCart}
                      isInCart={isInCart(agent.id)}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="rounded-[1.5rem] border border-border/70 bg-card px-6 py-14 text-center">
                <p className="text-base text-foreground">No agents match this view.</p>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                  Try a broader search or switch back to a calmer filter. This view only shows agents matching the selected risk criteria.
                </p>
                <Button
                  className="mt-5"
                  variant="outline"
                  onClick={() => {
                    setSearchQuery('')
                    setSelectedCategory(null)
                    setSelectedFilter('all')
                  }}
                >
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
