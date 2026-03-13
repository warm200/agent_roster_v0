import Link from 'next/link'

import { Header } from '@/components/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  ArrowRight,
  Bot,
  Check,
  Clock3,
  Flame,
  Layers3,
  Play,
  Snowflake,
  Sparkles,
  TimerReset,
  Zap,
} from 'lucide-react'

const plans = [
  {
    name: 'Free',
    price: '$0',
    includedCredits: '0',
    activeBundles: '0',
    agentsPerBundle: '0',
    triggerMode: 'None',
    concurrentRuns: '0',
    alwaysOnBundles: '0',
    includes: ['Free Agents Purchase', 'Free persona preview chat'],
    suitFor: 'Browse, preview, claim agents',
    icon: Snowflake,
    accent: 'border-white/12 bg-white/[0.03]',
    accentText: 'text-zinc-200',
    highlight: undefined,
    cta: 'Browse Free Agents',
  },
  {
    name: 'Run',
    price: '$5',
    includedCredits: '30',
    activeBundles: '1',
    agentsPerBundle: '3',
    triggerMode: 'Manual only',
    concurrentRuns: '1',
    alwaysOnBundles: '0',
    includes: ['Slower wake up'],
    suitFor: 'Occasional manual runs',
    icon: Play,
    accent: 'border-amber-300/20 bg-amber-300/[0.06]',
    accentText: 'text-amber-200',
    highlight: undefined,
    cta: 'Run On Demand',
  },
  {
    name: 'Warm Standby',
    price: '$19/mo',
    includedCredits: '50/mo',
    activeBundles: '3',
    agentsPerBundle: '5',
    triggerMode: 'Auto wake',
    concurrentRuns: '3',
    alwaysOnBundles: '0',
    includes: ['Faster wake up'],
    suitFor: 'Frequent Telegram-triggered workflows',
    icon: TimerReset,
    accent: 'border-orange-300/25 bg-orange-300/[0.07]',
    accentText: 'text-orange-200',
    highlight: 'Most practical default',
    cta: 'Keep Bundles Warm',
  },
  {
    name: 'Always On',
    price: '$149/mo',
    includedCredits: '100/mo',
    activeBundles: '3',
    agentsPerBundle: '8',
    triggerMode: 'Always active',
    concurrentRuns: '10',
    alwaysOnBundles: '10',
    includes: ['Never sleep'],
    suitFor: 'One core workspace running full time',
    icon: Flame,
    accent: 'border-rose-300/25 bg-rose-300/[0.07]',
    accentText: 'text-rose-200',
    highlight: undefined,
    cta: 'Stay Always On',
  },
] as const

const comparisonRows = [
  { label: 'Price', values: plans.map((plan) => plan.price) },
  { label: 'Included credits', values: plans.map((plan) => plan.includedCredits) },
  { label: 'Active bundles', values: plans.map((plan) => plan.activeBundles) },
  { label: 'Agents per bundle', values: plans.map((plan) => plan.agentsPerBundle) },
  { label: 'Trigger mode', values: plans.map((plan) => plan.triggerMode) },
  { label: 'Concurrent runs', values: plans.map((plan) => plan.concurrentRuns) },
  { label: 'Always-on bundles', values: plans.map((plan) => plan.alwaysOnBundles) },
  { label: 'Best for', values: plans.map((plan) => plan.suitFor) },
] as const

const callouts = [
  {
    title: 'Free is for browsing and preview',
    description:
      'Use it to understand the agent persona and claim free agents. It is not a runtime tier.',
  },
  {
    title: 'Run is the lightest paid entry',
    description:
      'Good when execution is manual and occasional. Wake speed stays slower by design.',
  },
  {
    title: 'Warm Standby is built for Telegram loops',
    description:
      'If bundles are triggered often through Telegram, this is the tier that starts making sense first.',
  },
  {
    title: 'Always On is for a pinned core workspace',
    description:
      'This is the persistent operating setup: high concurrency, many always-on bundles, no sleep cycle.',
  },
] as const

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main>
        <section className="relative overflow-hidden border-b border-border/60">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,214,170,0.14),transparent_30%),radial-gradient(circle_at_78%_18%,rgba(255,120,74,0.12),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_62%)]" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-200/35 to-transparent" />

          <div className="container mx-auto grid gap-12 px-4 py-18 md:grid-cols-[minmax(0,1.02fr)_minmax(20rem,0.98fr)] md:items-center md:py-24 lg:gap-18 lg:py-28">
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/70 px-3 py-1.5 text-xs uppercase tracking-[0.22em] text-muted-foreground backdrop-blur">
                <Sparkles className="h-3.5 w-3.5 text-orange-200" />
                Dedicated pricing
              </div>

              <h1 className="mt-6 max-w-4xl text-4xl font-semibold leading-[0.94] tracking-[-0.04em] text-foreground md:text-6xl lg:text-7xl">
                Choose the runtime tier
                <span className="text-muted-foreground"> your bundle actually needs.</span>
              </h1>

              <p className="mt-6 max-w-2xl text-base leading-8 text-muted-foreground md:text-lg">
                Pricing maps directly to wake behavior, bundle capacity, and concurrency. Start with
                preview, pay for occasional runs, keep key bundles warm, or pin a workspace into
                always-on mode.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button
                  size="lg"
                  asChild
                  className="group h-12 rounded-full px-6 text-sm font-medium shadow-[0_14px_30px_-18px_rgba(255,188,127,0.65)]"
                >
                  <Link href="/agents">
                    Browse Agents
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transform-none" />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  asChild
                  className="h-12 rounded-full border-border/70 bg-card/60 px-6 text-sm"
                >
                  <Link href="/app">Open Dashboard</Link>
                </Button>
              </div>
            </div>

            <Card className="relative overflow-hidden rounded-[2rem] border-border/70 bg-card/85 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)] backdrop-blur">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,188,127,0.12),transparent_35%),linear-gradient(145deg,rgba(255,255,255,0.03),transparent_55%)]" />
              <CardContent className="relative p-5 md:p-6">
                <div className="rounded-[1.6rem] border border-border/60 bg-background/65 p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-muted-foreground">
                        <Layers3 className="h-3.5 w-3.5" />
                        Tier ladder
                      </div>
                      <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-foreground">
                        From preview to persistent runtime.
                      </h2>
                    </div>
                    <div className="rounded-full border border-orange-200/20 bg-orange-200/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-orange-100/75">
                      4 plans
                    </div>
                  </div>

                  <div className="mt-6 space-y-3">
                    {plans.map((plan) => (
                      <div
                        key={plan.name}
                        className={cn(
                          'rounded-[1.35rem] border px-4 py-4',
                          plan.accent
                        )}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/8 bg-background/80">
                              <plan.icon className={cn('h-5 w-5', plan.accentText)} />
                            </div>
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-base font-medium text-foreground">{plan.name}</span>
                                {plan.highlight ? (
                                  <span className="rounded-full border border-orange-200/20 bg-orange-200/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-orange-100/75">
                                    {plan.highlight}
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-1 text-sm leading-6 text-muted-foreground">{plan.suitFor}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-semibold text-foreground">{plan.price}</div>
                            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                              {plan.triggerMode}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="border-b border-border/60 bg-card/30">
          <div className="container mx-auto px-4 py-18 md:py-20">
            <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Plans</div>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-foreground md:text-4xl">
                  Four tiers, four wake profiles.
                </h2>
              </div>
              <p className="max-w-xl text-sm leading-7 text-muted-foreground">
                The difference is not cosmetic. Each tier changes how many bundles can stay active, how
                many agents fit inside, and how fast the workspace is ready to move.
              </p>
            </div>

            <div className="grid gap-5 xl:grid-cols-4">
              {plans.map((plan) => (
                <PlanCard key={plan.name} plan={plan} />
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-border/60">
          <div className="container mx-auto px-4 py-18 md:py-20">
            <div className="max-w-3xl">
              <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Compare</div>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-foreground md:text-4xl">
                Exact plan limits, line by line.
              </h2>
            </div>

            <div className="mt-8 overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0">
                <thead>
                  <tr>
                    <th className="min-w-[11rem] border-b border-border/60 px-4 py-4 text-left text-xs uppercase tracking-[0.22em] text-muted-foreground">
                      Feature
                    </th>
                    {plans.map((plan) => (
                      <th
                        key={plan.name}
                        className="min-w-[10rem] border-b border-border/60 px-4 py-4 text-left"
                      >
                        <div className="flex items-center gap-2">
                          <plan.icon className={cn('h-4 w-4', plan.accentText)} />
                          <span className="text-sm font-medium text-foreground">{plan.name}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row, rowIndex) => (
                    <tr key={row.label}>
                      <td className="border-b border-border/40 px-4 py-4 text-sm text-muted-foreground">
                        {row.label}
                      </td>
                      {row.values.map((value, valueIndex) => (
                        <td
                          key={`${row.label}-${plans[valueIndex].name}`}
                          className={cn(
                            'border-b border-border/40 px-4 py-4 text-sm text-foreground',
                            rowIndex === comparisonRows.length - 1 && 'border-b-0'
                          )}
                        >
                          {value}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="border-b border-border/60 bg-card/30">
          <div className="container mx-auto grid gap-5 px-4 py-18 md:grid-cols-2 xl:grid-cols-4 md:py-20">
            {callouts.map((item, index) => (
              <Card key={item.title} className="rounded-[1.6rem] border-border/60 bg-background/60">
                <CardContent className="p-6">
                  <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                    0{index + 1}
                  </div>
                  <h3 className="mt-4 text-xl font-semibold tracking-[-0.03em] text-foreground">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,188,127,0.1),transparent_42%)]" />
          <div className="container mx-auto px-4 py-18 md:py-20">
            <Card className="overflow-hidden rounded-[2rem] border-border/70 bg-card/75 shadow-[0_24px_70px_-36px_rgba(0,0,0,0.8)]">
              <CardContent className="relative flex flex-col gap-8 p-6 md:flex-row md:items-center md:justify-between md:p-8">
                <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.04),transparent_55%)]" />
                <div className="relative max-w-2xl">
                  <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Start here</div>
                  <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-foreground md:text-4xl">
                    Start with the lightest tier that matches the job.
                  </h2>
                  <p className="mt-4 text-sm leading-7 text-muted-foreground">
                    You can browse free, pay for occasional runs, or move up once bundles become part of
                    a recurring operating loop.
                  </p>
                </div>

                <div className="relative flex flex-col gap-3 sm:flex-row">
                  <Button
                    size="lg"
                    asChild
                    className="group h-12 rounded-full px-6 text-sm font-medium shadow-[0_14px_30px_-18px_rgba(255,188,127,0.65)]"
                  >
                    <Link href="/agents">
                      Explore Agents
                      <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transform-none" />
                    </Link>
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    asChild
                    className="h-12 rounded-full border-border/70 bg-background/70 px-6 text-sm"
                  >
                    <Link href="/app">See Dashboard</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </div>
  )
}

function PlanCard({
  plan,
}: {
  plan: (typeof plans)[number]
}) {
  return (
    <Card className={cn('rounded-[1.9rem] border bg-background/70', plan.accent)}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/8 bg-background/80">
            <plan.icon className={cn('h-5 w-5', plan.accentText)} />
          </div>
          {plan.highlight ? (
            <div className="rounded-full border border-orange-200/20 bg-orange-200/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-orange-100/75">
              {plan.highlight}
            </div>
          ) : null}
        </div>

        <div className="mt-5">
          <div className="text-lg font-semibold tracking-[-0.02em] text-foreground">{plan.name}</div>
          <div className="mt-2 text-4xl font-semibold tracking-[-0.05em] text-foreground">{plan.price}</div>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">{plan.suitFor}</p>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <PlanMetric icon={Zap} label="Credits" value={plan.includedCredits} />
          <PlanMetric icon={Layers3} label="Bundles" value={plan.activeBundles} />
          <PlanMetric icon={Bot} label="Agents" value={plan.agentsPerBundle} />
          <PlanMetric icon={Clock3} label="Runs" value={plan.concurrentRuns} />
        </div>

        <div className="mt-5 rounded-[1.35rem] border border-border/60 bg-card/45 p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Trigger mode</span>
            <span className="text-sm font-medium text-foreground">{plan.triggerMode}</span>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Always-on bundles
            </span>
            <span className="text-sm font-medium text-foreground">{plan.alwaysOnBundles}</span>
          </div>
        </div>

        <div className="mt-5">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Plan includes</div>
          <div className="mt-3 space-y-2">
            {plan.includes.map((item) => (
              <div key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-200/10 text-orange-100/80">
                  <Check className="h-3.5 w-3.5" />
                </div>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <Button asChild className="mt-6 h-11 w-full rounded-full text-sm">
          <Link href="/agents">{plan.cta}</Link>
        </Button>
      </CardContent>
    </Card>
  )
}

function PlanMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Bot
  label: string
  value: string
}) {
  return (
    <div className="rounded-[1.2rem] border border-border/60 bg-card/45 p-3">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-2 text-base font-medium text-foreground">{value}</div>
    </div>
  )
}
