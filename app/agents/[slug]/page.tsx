'use client'

import { use, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AgentRiskBadge } from '@/components/agent-risk-badge'
import { AgentTesslBadge } from '@/components/agent-tessl-badge'
import { AgentTesslPanel } from '@/components/agent-tessl-panel'
import { Header } from '@/components/header'
import { PreviewChat } from '@/components/preview-chat'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getAgentCapabilityChips, getAgentRiskLevel, getAgentSummary } from '@/lib/agent-risk'
import { formatPrice } from '@/lib/mock-data'
import { useCart } from '@/lib/cart-context'
import { useAuth } from '@/lib/auth-context'
import { formatDate } from '@/lib/utils'
import { getAgentBySlug } from '@/services/catalog.api'
import { toast } from 'sonner'
import type { Agent } from '@/lib/types'
import {
  ShoppingCart,
  Download,
  MessageSquare,
  ChevronLeft,
  CheckCircle2,
  ScrollText,
  Shield,
  AlertTriangle,
  Bot,
  ChevronDown,
  FileText,
} from 'lucide-react'

interface PageProps {
  params: Promise<{ slug: string }>
}

export default function AgentDetailPage({ params }: PageProps) {
  const { slug } = use(params)
  const [agent, setAgent] = useState<Agent | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const { addItem, isInCart } = useCart()
  const { isAuthenticated, session, status } = useAuth()
  const [showChat, setShowChat] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function loadAgent() {
      setIsLoading(true)
      setLoadError(null)

      try {
        const payload = await getAgentBySlug(slug)
        if (isMounted) {
          setAgent(payload)
        }
      } catch (error) {
        if (isMounted) {
          setLoadError(error instanceof Error ? error.message : 'Agent not found')
          setAgent(null)
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadAgent()

    return () => {
      isMounted = false
    }
  }, [slug])

  const parsedSections = useMemo(() => {
    if (!agent) {
      return { whatItDoes: null as string | null, whatItDoesNot: null as string | null }
    }

    const sections = agent.descriptionMarkdown.split('## ').filter(Boolean)

    return {
      whatItDoes: sections.find((section) => section.startsWith('What this agent does')) ?? null,
      whatItDoesNot: sections.find((section) => section.startsWith('What this agent does NOT do')) ?? null,
    }
  }, [agent])

  if (isLoading) {
    return <AgentDetailSkeleton />
  }

  if (!agent) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <Link
            href="/agents"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Catalog
          </Link>
          <Card className="border-red-500/30 bg-red-500/5">
            <CardContent className="p-6 text-center">
              <AlertTriangle className="mx-auto mb-3 h-6 w-6 text-red-400" />
              <p className="font-medium text-red-400">Unable to load agent</p>
              <p className="mt-1 text-sm text-muted-foreground">{loadError ?? 'Agent not found'}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const { currentVersion } = agent
  const inCart = isInCart(agent.id)
  const riskLevel = getAgentRiskLevel(agent)
  const riskSummary = getAgentSummary(agent)
  const capabilityChips = getAgentCapabilityChips(agent, 4)
  const canUsePreviewChat = isAuthenticated
  const hasTesslReview = Boolean(agent.tesslReview)

  const handleAddToCart = () => {
    addItem(agent)
    toast.success(`${agent.title} added to cart`)
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 py-8">
        <Link
          href="/agents"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Catalog
        </Link>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <Avatar className="h-12 w-12 rounded-xl border border-border bg-secondary">
                  <AvatarImage alt={agent.title} src={agent.thumbnailUrl ?? undefined} />
                  <AvatarFallback className="rounded-xl bg-secondary text-foreground">
                    <Bot className="h-5 w-5" />
                  </AvatarFallback>
                </Avatar>
                <Badge variant="secondary">{agent.category}</Badge>
                <Badge variant="outline" className="font-mono">
                  v{currentVersion.version}
                </Badge>
                <AgentRiskBadge level={riskLevel} />
                {agent.tesslReview ? <AgentTesslBadge review={agent.tesslReview} /> : null}
              </div>
              <h1 className="text-3xl font-bold text-foreground mb-3">{agent.title}</h1>
              <p className="text-lg text-muted-foreground">{agent.summary}</p>
            </div>

            <Tabs defaultValue="overview" className="w-full">
              <TabsList className={`grid w-full ${hasTesslReview ? 'grid-cols-3' : 'grid-cols-2'}`}>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="risk">Risk Profile</TabsTrigger>
                {hasTesslReview ? <TabsTrigger value="tessl">Tessl</TabsTrigger> : null}
              </TabsList>

              <TabsContent value="overview" className="mt-6 space-y-6">
                {parsedSections.whatItDoes && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        Capabilities
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="prose prose-invert prose-sm max-w-none">
                        {parsedSections.whatItDoes
                          .replace('What this agent does\n\n', '')
                          .split('\n')
                          .filter(Boolean)
                          .map((line, index) => (
                            <p key={index} className="text-muted-foreground">
                              {line.replace(/^- \*\*/, '').replace(/\*\*/, ': ').replace(/\*\*/g, '')}
                            </p>
                          ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {parsedSections.whatItDoesNot && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <ScrollText className="w-5 h-5 text-sky-300" />
                        Rules
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="prose prose-invert prose-sm max-w-none">
                        {parsedSections.whatItDoesNot
                          .replace('What this agent does NOT do\n\n', '')
                          .split('\n')
                          .filter(Boolean)
                          .map((line, index) => (
                            <p key={index} className="text-muted-foreground">
                              {line.replace(/^- /, '')}
                            </p>
                          ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="risk" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Shield className="w-5 h-5" />
                      Risk Review
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap items-center gap-3 border-b border-border pb-4">
                      <AgentRiskBadge level={riskLevel} />
                      {capabilityChips.map((chip) => (
                        <span
                          key={chip.id}
                          className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-secondary/60 px-2.5 py-1 text-xs text-muted-foreground"
                        >
                          <chip.icon className="h-3.5 w-3.5" />
                          <span>{chip.label}</span>
                        </span>
                      ))}
                    </div>

                    <p className="text-sm leading-6 text-muted-foreground">{riskSummary}</p>

                    <div className="space-y-4 pt-2">
                      <div>
                        <h3 className="text-sm font-medium text-foreground">Key findings</h3>
                        {agent.riskReview?.primaryFindings.length ? (
                          <div className="mt-3 space-y-3">
                            {agent.riskReview.primaryFindings.slice(0, 3).map((finding) => (
                              <div key={`${finding.code}-${finding.filePath ?? 'none'}-${finding.title}`} className="rounded-xl border border-border/70 bg-secondary/30 p-4">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <p className="font-medium text-foreground">{finding.title}</p>
                                  <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[11px] tracking-[0.14em] text-red-300">
                                    {finding.severity}
                                  </span>
                                </div>
                                {finding.evidenceSnippet ? (
                                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{finding.evidenceSnippet}</p>
                                ) : null}
                                {finding.filePath ? (
                                  <div className="mt-3 inline-flex items-center gap-2 text-xs text-muted-foreground">
                                    <FileText className="h-3.5 w-3.5" />
                                    <span>{finding.filePath}</span>
                                  </div>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-3 rounded-xl border border-border/70 bg-secondary/20 p-4 text-sm text-muted-foreground">
                            No high-confidence risky behavior detected.
                          </div>
                        )}
                      </div>

                      <Collapsible defaultOpen={false}>
                        <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 rounded-xl border border-border/70 bg-secondary/20 px-4 py-3 text-left">
                          <div>
                            <p className="text-sm font-medium text-foreground">Additional context</p>
                            <p className="mt-1 text-xs text-muted-foreground">Descriptive findings that help explain the agent without driving the primary badge.</p>
                          </div>
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-3 pt-3">
                          {agent.riskReview?.additionalContext.length ? (
                            agent.riskReview.additionalContext.map((finding) => (
                              <div key={`${finding.code}-${finding.filePath ?? 'context'}-${finding.title}`} className="rounded-xl border border-border/70 bg-secondary/20 p-4">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <p className="font-medium text-foreground">{finding.title}</p>
                                  <span className="rounded-full border border-border/70 bg-background/70 px-2 py-0.5 text-[11px] tracking-[0.14em] text-muted-foreground">
                                    {finding.severity}
                                  </span>
                                </div>
                                {finding.evidenceSnippet ? (
                                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{finding.evidenceSnippet}</p>
                                ) : null}
                                {finding.filePath ? (
                                  <div className="mt-3 text-xs text-muted-foreground">{finding.filePath}</div>
                                ) : null}
                              </div>
                            ))
                          ) : (
                            <div className="rounded-xl border border-border/70 bg-secondary/20 p-4 text-sm text-muted-foreground">
                              No additional context was recorded for this agent.
                            </div>
                          )}
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {agent.tesslReview ? (
                <TabsContent value="tessl" className="mt-6">
                  <AgentTesslPanel review={agent.tesslReview} />
                </TabsContent>
              ) : null}
            </Tabs>

            <Card className="overflow-hidden">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <MessageSquare className="w-5 h-5" />
                    Preview Chat
                  </CardTitle>
                  <Badge variant="outline" className="text-xs">
                    Sandbox Only
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="min-h-0">
                {showChat && canUsePreviewChat ? (
                  <PreviewChat
                    agent={agent}
                    userAvatarUrl={session?.user?.image ?? null}
                    userName={session?.user?.name ?? null}
                  />
                ) : !isAuthenticated ? (
                  <div className="py-8 text-center">
                    <p className="mb-4 text-sm text-muted-foreground">
                      Sign in to try the preview chat for this agent.
                    </p>
                    <Button asChild disabled={status === 'loading'}>
                      <Link href={`/login?callbackUrl=${encodeURIComponent(`/agents/${agent.slug}`)}`}>
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Sign In to Preview
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground mb-4">
                      Chat with this agent to understand its approach. No real data access.
                    </p>
                    <Button onClick={() => setShowChat(true)}>
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Start Preview Chat
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-6">
              <Card className="bg-card">
                <CardContent className="p-6">
                  <div className="text-3xl font-bold text-foreground mb-2">
                    {formatPrice(agent.priceCents, agent.currency)}
                  </div>
                  <p className="text-sm text-muted-foreground mb-6">One-time purchase</p>

                  <div className="space-y-3">
                    <Button
                      className="w-full"
                      size="lg"
                      onClick={handleAddToCart}
                      disabled={inCart}
                      variant={inCart ? 'secondary' : 'default'}
                    >
                      <ShoppingCart className="w-4 h-4 mr-2" />
                      {inCart ? 'In Cart' : 'Add to Cart'}
                    </Button>

                    {inCart && (
                      <Button variant="outline" className="w-full" asChild>
                        <Link href="/cart">View Cart</Link>
                      </Button>
                    )}
                  </div>

                  <div className="mt-6 pt-6 border-t border-border space-y-3">
                    <h4 className="font-medium text-sm">After purchase you get:</h4>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        Full agent execution via Telegram
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        Run logs and results
                      </li>
                      <li className="flex items-center gap-2">
                        <Download className="w-4 h-4 text-emerald-400" />
                        Downloadable install package
                      </li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <h4 className="font-medium text-sm mb-4">Version Info</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Version</span>
                      <span className="font-mono">v{currentVersion.version}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Released</span>
                      <span>{formatDate(currentVersion.createdAt)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Category</span>
                      <span className="capitalize">{agent.category}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function AgentDetailSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="mb-6 h-5 w-32" />
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="space-y-4">
              <div className="flex gap-3">
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
              <Skeleton className="h-10 w-72" />
              <Skeleton className="h-6 w-full" />
            </div>
            <Skeleton className="h-96 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-80 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        </div>
      </div>
    </div>
  )
}
