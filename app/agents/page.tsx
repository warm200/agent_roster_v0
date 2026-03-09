'use client'

import { useState } from 'react'
import { Header } from '@/components/header'
import { AgentCard } from '@/components/agent-card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { mockAgents, getAgentsByCategory } from '@/lib/mock-data'
import { useCart } from '@/lib/cart-context'
import { toast } from 'sonner'
import type { Agent, AgentCategory } from '@/lib/types'
import { Search, Mail, Calendar, FileText, Zap, BarChart3, LayoutGrid } from 'lucide-react'
import { cn } from '@/lib/utils'

const categories: { id: AgentCategory | null; label: string; icon: typeof Mail }[] = [
  { id: null, label: 'All Categories', icon: LayoutGrid },
  { id: 'inbox', label: 'Inbox', icon: Mail },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'docs', label: 'Documents', icon: FileText },
  { id: 'automation', label: 'Automation', icon: Zap },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
]

export default function AgentsPage() {
  const [selectedCategory, setSelectedCategory] = useState<AgentCategory | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const { addItem, isInCart } = useCart()

  const filteredAgents = getAgentsByCategory(selectedCategory).filter((agent) =>
    searchQuery
      ? agent.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        agent.summary.toLowerCase().includes(searchQuery.toLowerCase())
      : true
  )

  const handleAddToCart = (agent: Agent) => {
    addItem(agent)
    toast.success(`${agent.title} added to cart`)
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <aside className="lg:w-56 shrink-0">
            <div className="sticky top-24">
              <h2 className="text-sm font-medium text-muted-foreground mb-4">Categories</h2>
              <nav className="space-y-1">
                {categories.map((cat) => (
                  <button
                    key={cat.label}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors text-left',
                      selectedCategory === cat.id
                        ? 'bg-secondary text-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                    )}
                  >
                    <cat.icon className="w-4 h-4" />
                    {cat.label}
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 min-w-0">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-foreground mb-2">Agent Catalog</h1>
              <p className="text-muted-foreground">
                Browse and purchase Personal Ops agents for your workflows.
              </p>
            </div>

            {/* Search */}
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

            {/* Results */}
            {filteredAgents.length > 0 ? (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredAgents.map((agent) => (
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
                <Button variant="outline" onClick={() => { setSearchQuery(''); setSelectedCategory(null); }}>
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
