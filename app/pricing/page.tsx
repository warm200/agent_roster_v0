import Link from 'next/link'

import { Header } from '@/components/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  ArrowRight,
  Check,
  Flame,
  Layers3,
  Play,
  Snowflake,
  Sparkles,
  TimerReset,
} from 'lucide-react'

const plans = [
  {
    name: 'Free',
    price: '$0',
    audience: 'For browsing and preview',
    activeBundles: '0',
    agentsPerBundle: '0',
    launchStyle: 'No runtime',
    concurrentRuns: '0',
    runtimeBudget: 'No runtime budget',
    includes: [
      'Browse the catalog',
      'Preview agent behavior',
      'Claim free agents',
      'No runtime access',
    ],
    suitFor: 'Choose Free if you want to explore agents and preview how they think.',
    icon: Snowflake,
    accent: 'border-white/12 bg-white/[0.03]',
    accentText: 'text-zinc-200',
    highlight: undefined,
    cta: 'Browse Free Agents',
  },
  {
    name: 'Run',
    price: '$5',
    audience: 'For one-off manual runs',
    activeBundles: '1',
    agentsPerBundle: '3',
    launchStyle: 'Manual launch',
    concurrentRuns: '1',
    runtimeBudget: 'Includes runtime budget',
    includes: [
      'Launch 1 bundle',
      'Up to 3 agents per bundle',
      '1 concurrent run',
      'Manual trigger',
      'Best for testing a workflow end-to-end',
    ],
    suitFor: 'Choose Run if you want to test one real workflow before committing.',
    icon: Play,
    accent: 'border-amber-300/20 bg-amber-300/[0.06]',
    accentText: 'text-amber-200',
    highlight: 'Best place to start',
    cta: 'Start with Run',
  },
  {
    name: 'Warm Standby',
    price: '$19/mo',
    audience: 'For recurring workflows that should wake on demand',
    activeBundles: '2',
    agentsPerBundle: '5',
    launchStyle: 'Wakes on demand',
    concurrentRuns: '3',
    runtimeBudget: 'Usage budget included',
    includes: [
      'Up to 2 active bundles',
      'Up to 5 agents per bundle',
      'Up to 3 concurrent runs',
      'Auto-wake behavior',
      'Best for repeat use without full-time occupancy',
    ],
    suitFor: 'Choose Warm Standby if you expect to trigger the same setup repeatedly.',
    icon: TimerReset,
    accent: 'border-orange-300/25 bg-orange-300/[0.07]',
    accentText: 'text-orange-200',
    highlight: 'Core monthly plan',
    cta: 'Choose Warm Standby',
  },
  {
    name: 'Always On',
    price: '$149/mo',
    audience: 'For a persistent multi-agent workspace',
    activeBundles: '3',
    agentsPerBundle: '8',
    launchStyle: 'Always ready',
    concurrentRuns: '10',
    runtimeBudget: 'Fair-use runtime budget included',
    includes: [
      'Up to 3 active bundles',
      'Up to 8 agents per bundle',
      'Up to 10 concurrent runs',
      'Always-on workspace support',
      'Best for a dedicated long-running setup',
    ],
    suitFor: 'Choose Always On if you need a persistent workspace with more parallel capacity.',
    icon: Flame,
    accent: 'border-rose-300/25 bg-rose-300/[0.07]',
    accentText: 'text-rose-200',
    highlight: undefined,
    cta: 'See Always On',
  },
] as const

const comparisonRows = [
  { label: 'Price', values: plans.map((plan) => plan.price) },
  { label: 'Active bundles', values: plans.map((plan) => plan.activeBundles) },
  { label: 'Agents per bundle', values: plans.map((plan) => plan.agentsPerBundle) },
  { label: 'Launch style', values: plans.map((plan) => plan.launchStyle) },
  { label: 'Concurrent runs', values: plans.map((plan) => plan.concurrentRuns) },
  { label: 'Runtime budget', values: plans.map((plan) => plan.runtimeBudget) },
] as const

const planGuides = [
  {
    title: 'Choose Free if you want to explore agents and preview how they think.',
    description: 'Good for catalog browsing, persona checking, and collecting agents before you are ready to run them.',
  },
  {
    title: 'Choose Run if you want to test one real workflow before committing.',
    description: 'This is the first paid step. It is the clearest way to validate one full workflow end-to-end.',
  },
  {
    title: 'Choose Warm Standby if you expect to trigger the same setup repeatedly.',
    description: 'This is the core monthly tier when the same workflow should wake on demand without full-time occupancy.',
  },
  {
    title: 'Choose Always On if you need a persistent workspace with more parallel capacity.',
    description: 'This is the high-capacity anchor tier for a dedicated long-running setup, not the default self-serve starting point.',
  },
] as const

const faqs = [
  {
    answer:
      'Agents are free to collect and evaluate. Paid plans cover managed runtime access when you want to actually launch a bundle.',
    question: 'Why are agents free, but runs paid?',
  },
  {
    answer:
      'Runtime access, bundle size limits, concurrency, and trigger behavior vary by plan.',
    question: 'What does a runtime plan unlock?',
  },
  {
    answer:
      'No. Preview chat is available before purchase and does not require runtime access.',
    question: 'Do I need a paid plan to preview agents?',
  },
  {
    answer:
      'Yes. Agents can be collected first. Plan limits are enforced when you launch a run, not when you purchase agents.',
    question: 'Can I buy agents first and upgrade later?',
  },
  {
    answer:
      'You can upgrade when a bundle is blocked by plan limits directly from the bundle detail page.',
    question: 'What happens if I need more capacity later?',
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
                Runtime plans only
              </div>

              <h1 className="mt-6 max-w-4xl text-4xl font-semibold leading-[0.94] tracking-[-0.04em] text-foreground md:text-6xl lg:text-7xl">
                Run agents,
                <span className="text-muted-foreground"> not infrastructure.</span>
                <br />
                Buy agents for free.
                <span className="text-muted-foreground"> Pay only when you want to run them.</span>
              </h1>

              <p className="mt-6 max-w-2xl text-base leading-8 text-muted-foreground md:text-lg">
                Preview agents for free. Launch real runs with a runtime plan when you&apos;re ready.
              </p>

              <div className="mt-6 grid max-w-2xl gap-3 text-sm text-muted-foreground sm:grid-cols-3">
                <div className="rounded-2xl border border-border/60 bg-card/55 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-orange-200/80">Agent purchase</div>
                  <div className="mt-2 text-base font-medium text-foreground">$0 today</div>
                </div>
                <div className="rounded-2xl border border-border/60 bg-card/55 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-orange-200/80">Preview chat</div>
                  <div className="mt-2 text-base font-medium text-foreground">Free</div>
                </div>
                <div className="rounded-2xl border border-border/60 bg-card/55 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-orange-200/80">Paid moment</div>
                  <div className="mt-2 text-base font-medium text-foreground">When runs start</div>
                </div>
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button
                  size="lg"
                  asChild
                  className="group h-12 rounded-full px-6 text-sm font-medium shadow-[0_14px_30px_-18px_rgba(255,188,127,0.65)]"
                >
                  <Link href="/agents">
                    Browse Free Agents
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
                        What you pay for
                      </div>
                      <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-foreground">
                        Free discovery, paid execution.
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
                              {plan.launchStyle}
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

        <section className="border-b border-border/60 bg-background">
          <div className="container mx-auto px-4 py-14 md:py-16">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                  How pricing works
                </div>
                <h2 className="mt-3 max-w-xl text-3xl font-semibold tracking-[-0.03em] text-foreground md:text-4xl">
                  The catalog is free. Runtime is the paid layer.
                </h2>
              </div>

              <div className="grid gap-3">
                {[
                  'Agents are free to collect.',
                  'Preview chat is free.',
                  'You only pay when you want to run a bundle in a managed environment.',
                  'Plans unlock different runtime capabilities like bundle size, trigger mode, and concurrency.',
                ].map((line) => (
                  <div
                    key={line}
                    className="flex items-start gap-3 rounded-2xl border border-border/60 bg-card/45 px-4 py-4"
                  >
                    <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full border border-orange-200/20 bg-orange-200/10">
                      <Check className="h-3.5 w-3.5 text-orange-200" />
                    </div>
                    <p className="text-sm leading-7 text-muted-foreground md:text-base">{line}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-border/60 bg-card/30">
          <div className="container mx-auto px-4 py-18 md:py-20">
            <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Plans</div>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-foreground md:text-4xl">
                  Choose the runtime shape that matches the job.
                </h2>
              </div>
              <p className="max-w-xl text-sm leading-7 text-muted-foreground">
                Start simple. Move up only when bundle size, repeat triggering, or parallel capacity becomes the bottleneck.
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
                Plan table, minus fake precision.
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
                Runtime plans include a usage budget. Exact runtime consumption rules may evolve as the platform matures.
              </p>
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
            <div className="md:col-span-2 xl:col-span-4">
              <div className="max-w-3xl">
                <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Plan comparison</div>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-foreground md:text-4xl">
                  Which plan is right for you?
                </h2>
              </div>
            </div>
            {planGuides.map((item, index) => (
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

        <section className="border-b border-border/60 bg-background">
          <div className="container mx-auto px-4 py-18 md:py-20">
            <div className="max-w-3xl">
              <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">FAQ</div>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-foreground md:text-4xl">
                The questions this page should answer upfront.
              </h2>
            </div>

            <div className="mt-10 grid gap-4 lg:grid-cols-2">
              {faqs.map((item) => (
                <Card key={item.question} className="rounded-[1.5rem] border-border/60 bg-card/45">
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold tracking-[-0.02em] text-foreground">
                      {item.question}
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.answer}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
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
                    Browse and preview for free first. Pay only when the workflow is real enough to deserve managed runtime.
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
          <p className="mt-3 text-sm leading-7 text-muted-foreground">{plan.audience}</p>
        </div>

        <div className="mt-6">
          <div className="space-y-2">
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

        <div className="mt-5 rounded-[1.35rem] border border-border/60 bg-card/45 p-4">
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Runtime budget</div>
          <div className="mt-2 text-sm font-medium text-foreground">{plan.runtimeBudget}</div>
          <p className="mt-2 text-xs leading-6 text-muted-foreground">
            Runtime plans include a usage budget. Exact runtime consumption rules may evolve as the platform matures.
          </p>
        </div>

        <Button asChild className="mt-6 h-11 w-full rounded-full text-sm">
          <Link href={plan.name === 'Free' ? '/agents' : '/app'}>{plan.cta}</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
