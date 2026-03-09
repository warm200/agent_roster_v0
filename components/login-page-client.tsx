'use client'

import { useEffect, useState } from 'react'
import type { ClientSafeProvider } from 'next-auth/react'
import { getProviders } from 'next-auth/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bot, ChevronRight, Github, LogIn } from 'lucide-react'

import { Header } from '@/components/header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { useAuth } from '@/lib/auth-context'

function getProviderIcon(name: string) {
  if (name.toLowerCase().includes('github')) {
    return <Github className="h-4 w-4" />
  }

  return <LogIn className="h-4 w-4" />
}

export function LoginPageClient({ callbackUrl }: { callbackUrl: string }) {
  const router = useRouter()
  const { isAuthenticated, signIn, status } = useAuth()
  const [providers, setProviders] = useState<Record<string, ClientSafeProvider>>({})
  const [isLoadingProviders, setIsLoadingProviders] = useState(true)
  const [activeProviderId, setActiveProviderId] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadProviders() {
      try {
        const nextProviders = await getProviders()

        if (isMounted) {
          setProviders(nextProviders ?? {})
        }
      } finally {
        if (isMounted) {
          setIsLoadingProviders(false)
        }
      }
    }

    void loadProviders()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace(callbackUrl)
    }
  }, [callbackUrl, router, status])

  const providerList = Object.values(providers)

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-12">
        <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="border-border/60 bg-card/95">
            <CardHeader className="space-y-4">
              <Badge className="w-fit" variant="secondary">
                Account Access
              </Badge>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-foreground">
                    <Bot className="h-6 w-6 text-background" />
                  </div>
                  <div>
                    <CardTitle className="text-3xl">Sign in to AgentRoster</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Access your bundles, Telegram setup, and run workbench.
                    </p>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingProviders || status === 'loading' ? (
                <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary/40 px-4 py-5 text-sm text-muted-foreground">
                  <Spinner className="h-4 w-4" />
                  Loading sign-in options...
                </div>
              ) : providerList.length > 0 ? (
                <div className="space-y-3">
                  {providerList.map((provider) => (
                    <Button
                      key={provider.id}
                      className="w-full justify-between"
                      disabled={activeProviderId === provider.id || isAuthenticated}
                      onClick={async () => {
                        setActiveProviderId(provider.id)
                        try {
                          await signIn(provider.id, callbackUrl)
                        } finally {
                          setActiveProviderId(null)
                        }
                      }}
                      size="lg"
                      variant="outline"
                    >
                      <span className="flex items-center gap-2">
                        {activeProviderId === provider.id ? (
                          <Spinner className="h-4 w-4" />
                        ) : (
                          getProviderIcon(provider.name)
                        )}
                        Continue with {provider.name}
                      </span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                  <p className="font-medium text-amber-300">OAuth providers are not configured.</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Add GitHub or Google credentials to enable sign-in and `/app` protection.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-secondary/20">
            <CardHeader>
              <CardTitle className="text-xl">What opens after login</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>Your dashboard resumes where the purchase flow left off.</p>
              <div className="space-y-3">
                <div className="rounded-xl border border-border bg-background/60 p-4">
                  Review purchased bundles and package downloads.
                </div>
                <div className="rounded-xl border border-border bg-background/60 p-4">
                  Finish Telegram pairing and launch runs.
                </div>
                <div className="rounded-xl border border-border bg-background/60 p-4">
                  Monitor logs, artifacts, and results from one workbench.
                </div>
              </div>
              <p>
                Need the public catalog first?{' '}
                <Link className="text-foreground underline" href="/agents">
                  Browse agents
                </Link>
                .
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
