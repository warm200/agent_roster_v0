import Link from 'next/link'

import { Header } from '@/components/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  ArrowRight,
  Bot,
  Check,
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
    budgetBadge: 'No runtime budget',
    budgetDetail: 'Browse and preview only.',
    bestFor: 'Browse and preview',
    runtimeBehavior: 'No runtime. Collect agents, preview personas, and decide what is worth running later.',
    whyExists: 'This exists so catalog discovery stays frictionless. You should not pay to understand what an agent is.',
    whoItsFor: 'People still exploring the catalog or evaluating how an agent thinks.',
    activeBundles: '0',
    agentsPerBundle: '0',
    triggerMode: 'None',
    alwaysOnBundles: '0',
    accent: 'border-white/12 bg-white/[0.03]',
    accentText: 'text-zinc-200',
    cta: 'Browse Free Agents',
    href: '/agents',
    icon: Snowflake,
    tone: 'Discovery',
    highlight: undefined,
    hideBudget: undefined,
    includes: ['Free agents purchase', 'Free persona preview chat'],
    metrics: [
      { label: 'Runtime behavior', value: 'No runtime', icon: Zap },
      { label: 'Agents in bundle', value: '0', icon: Bot },
      { label: 'Trigger mode', value: 'None', icon: Snowflake },
    ],
    persistence: 'No runtime',
    stopBehavior: 'Not applicable',
    recoveryModel: 'Not applicable',
  },
  {
    name: 'Run',
    price: '$5',
    budgetBadge: 'Usage budget included',
    budgetDetail: 'Includes 15 runtime credits.',
    bestFor: 'Test one workflow manually',
    runtimeBehavior: 'Manual bounded session. Start it yourself, test the workflow, and let it auto-stop after inactivity.',
    whyExists: 'This is the first paid step after preview when you want one real managed run without parallel operating complexity.',
    whoItsFor: 'Solo operators validating a workflow end to end before they commit to repeat use.',
    activeBundles: '1',
    agentsPerBundle: '3',
    triggerMode: 'Manual only',
    alwaysOnBundles: '0',
    accent: 'border-amber-300/20 bg-amber-300/[0.06]',
    accentText: 'text-amber-200',
    cta: 'Start with Run',
    href: '/app/bundles',
    icon: Play,
    tone: 'Starting point',
    highlight: undefined,
    hideBudget: undefined,
    includes: ['Usage budget included', 'Manual bounded session', 'Auto-stop after inactivity'],
    metrics: [
      { label: 'Runtime behavior', value: 'Bounded manual session', icon: Zap },
      { label: 'Agents in bundle', value: '3', icon: Bot },
      { label: 'Trigger mode', value: 'Manual only', icon: Play },
    ],
    persistence: 'Ephemeral session',
    stopBehavior: 'Auto-stops after inactivity and may be fully cleaned up.',
    recoveryModel: 'New launch',
  },
  {
    name: 'Warm Standby',
    price: '$19/mo',
    budgetBadge: 'Fair-use runtime budget included',
    budgetDetail: 'Includes 10 runtime credits per month.',
    bestFor: 'Repeat Telegram-triggered workflows',
    runtimeBehavior: 'Wake on message, work, then auto-sleep when idle. Designed for recoverable runtime state without self-hosting.',
    whyExists: 'This exists for workflows that should wake repeatedly from Telegram without behaving like a permanent live workspace.',
    whoItsFor: 'Operators running recurring Telegram-triggered workflows who want wake-on-demand behavior with recoverable state.',
    activeBundles: '3',
    agentsPerBundle: '5',
    triggerMode: 'Wake on Telegram',
    alwaysOnBundles: '0',
    accent: 'border-orange-300/25 bg-orange-300/[0.07]',
    accentText: 'text-orange-200',
    cta: 'Use for repeat workflows',
    href: '/app/bundles',
    icon: TimerReset,
    tone: 'Wake on demand',
    highlight: 'Wake on demand',
    hideBudget: undefined,
    includes: ['Fair-use runtime budget included', 'Wake on message', 'Auto-sleeps when idle'],
    metrics: [
      { label: 'Runtime behavior', value: 'Wake on message', icon: Zap },
      { label: 'Agents in bundle', value: '5', icon: Bot },
      { label: 'Trigger mode', value: 'Telegram wake', icon: TimerReset },
    ],
    persistence: 'Recoverable state',
    stopBehavior: 'Auto-sleeps when idle instead of behaving like a full-time live workspace.',
    recoveryModel: 'Sleep and restore',
  },
  {
    name: 'Always On',
    price: '$149/mo',
    budgetBadge: 'Persistent managed runtime',
    budgetDetail: 'Long-running workspace support.',
    bestFor: 'One core workspace running full time',
    runtimeBehavior: 'Persistent workspace for the setups that should stay live instead of waking from zero.',
    whyExists: 'This plan exists when sleeping and waking becomes the wrong operating model.',
    whoItsFor: 'Teams or operators who need a long-running managed setup with a core workspace kept alive.',
    activeBundles: '3',
    agentsPerBundle: '8',
    triggerMode: 'Persistent workspace',
    alwaysOnBundles: '10',
    accent: 'border-rose-300/25 bg-rose-300/[0.07]',
    accentText: 'text-rose-200',
    cta: 'Use for dedicated runtime',
    href: '/app/bundles',
    icon: Flame,
    tone: 'Persistent',
    highlight: undefined,
    includes: ['Persistent managed runtime', 'Long-running workspace support', 'Persistent workspace'],
    metrics: [
      { label: 'Runtime behavior', value: 'Persistent workspace', icon: Zap },
      { label: 'Agents in bundle', value: '8', icon: Bot },
      { label: 'Runtime shape', value: 'Long-running setup', icon: Flame },
    ],
    hideBudget: true,
    persistence: 'Live persistence',
    stopBehavior: 'Stopping is not the normal model. This plan is meant to keep a core workspace alive.',
    recoveryModel: 'Already live',
  },
] as const

const comparisonRows = [
  { label: 'Price', values: plans.map((plan) => plan.price) },
  { label: 'Runtime behavior', values: ['No runtime', 'Manual bounded session', 'Wake on message', 'Persistent workspace'] },
  { label: 'Best for', values: plans.map((plan) => plan.bestFor) },
  { label: 'State after stop', values: ['Not applicable', 'May be cleaned up', 'Sleeps with recoverable state', 'Normally stays live'] },
  { label: 'Recovery model', values: ['Not applicable', 'Fresh launch', 'Wake and restore', 'Already live'] },
  { label: 'Agents per launched bundle', values: plans.map((plan) => plan.agentsPerBundle) },
  { label: 'Trigger mode', values: plans.map((plan) => plan.triggerMode) },
] as const

const pricingSteps = [
  'Agents are free to collect.',
  'Preview chat is free.',
  'You only pay when you want to run a bundle in a managed environment.',
  'Plans unlock different runtime capabilities like bundle size, trigger behavior, and operating mode.',
] as const

const workflowChoices = [
  {
    title: 'Test manually',
    plan: 'Run',
    description: 'Use this when you want one real managed run, expect it to stop when idle, and do not need recoverable warm state.',
  },
  {
    title: 'Wake on Telegram',
    plan: 'Warm Standby',
    description: 'Use this when Telegram should wake the workflow on demand and later resume from recoverable state instead of starting from zero every time.',
  },
  {
    title: 'Keep a core workspace alive',
    plan: 'Always On',
    description: 'Use this when sleeping and waking is the wrong model because the workspace itself needs to stay present.',
  },
] as const

const supportCallouts = [
  {
    title: 'Free is for browsing and preview',
    description:
      'Use it to understand agent behavior and claim free agents. It is not a runtime tier.',
  },
  {
    title: 'Run is the default paid entry',
    description:
      'Best for testing one workflow manually in a bounded session.',
  },
  {
    title: 'Warm Standby is for wake-on-message use',
    description:
      'Best when you want Telegram-triggered repeat workflows that sleep when idle, recover later, and avoid self-hosting.',
  },
  {
    title: 'Always On is for a persistent managed workspace',
    description:
      'Use it when you want a core workspace to stay alive, not wake from zero.',
  },
] as const

const decisionFaqs = [
  {
    question: 'Why are agents free, but runs paid?',
    answer:
      'Agents are free to collect and evaluate. Paid plans cover managed runtime access when you want to actually launch a bundle.',
  },
  {
    question: 'What is a runtime credit?',
    answer:
      'For Run and Warm Standby, a credit is used when a managed launch or wake successfully starts. It is an entry budget for managed runtime, not minute-by-minute billing.',
  },
  {
    question: 'What is the difference between Run and Warm Standby after a session stops?',
    answer:
      'Run is the bounded test-session tier: once it stops, you should think in terms of a fresh launch. Warm Standby is the wake-and-recover tier: it is meant to sleep when idle and later resume from preserved state instead of acting like a brand-new environment every time.',
  },
  {
    question: 'Why would I pay for Warm Standby instead of just buying Run again?',
    answer:
      'Choose Warm Standby when the same workflow keeps coming back and you care about recoverable state after idle stop. Choose Run when you only need a temporary test session and do not care about keeping warm recoverable context around between wakes.',
  },
  {
    question: 'Does stopping always mean deleting everything?',
    answer:
      'No. In this product model, stopping can mean different things depending on the plan. Run is treated as ephemeral. Warm Standby is positioned as a sleep-and-recover mode. Always On is not meant to stop as part of normal operation.',
  },
  {
    question: 'Do plans auto-stop?',
    answer:
      'Yes. Run is designed as a bounded session, Warm Standby sleeps when idle, and Always On is for a persistent workspace instead of a sleep-first model.',
  },
  {
    question: 'Why not just self-host OpenClaw?',
    answer:
      'Self-hosting trades subscription cost for operational work: sandbox lifecycle, wake behavior, persistence handling, cleanup, and environment management. These plans are for people who want the managed runtime, not another piece of infrastructure to maintain.',
  },
  {
    question: 'When do I actually need Always On?',
    answer:
      'Only when your core workspace should stay alive as an operating environment. If you are mostly testing or waking on demand, Run or Warm Standby is the better fit.',
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
                Managed runtime plans
              </div>

              <h1 className="mt-6 max-w-4xl text-4xl font-semibold leading-[0.94] tracking-[-0.04em] text-foreground md:text-6xl lg:text-7xl">
                Run agents,
                <span className="text-muted-foreground"> not infrastructure.</span>
                <br />
                Buy agents for free.
                <span className="text-muted-foreground"> Pay only when you want to run them.</span>
              </h1>

              <p className="mt-6 max-w-2xl text-base leading-8 text-muted-foreground md:text-lg">
                Free agent discovery first. Paid managed runtime when you are ready to operate:
                manual run, wake with recoverable state, or keep a persistent workspace live.
              </p>

              <div className="mt-6 grid max-w-2xl gap-3 text-sm text-muted-foreground sm:grid-cols-3">
                <FactPill label="Collect agents" value="Free" />
                <FactPill label="Preview behavior" value="Free" />
                <FactPill label="Pay for" value="Managed runtime" />
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
                  <Link href="/app/bundles">See Bundle Runtime Options</Link>
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
                        Choose by workflow
                      </div>
                      <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-foreground">
                        Pick the operating mode, not a bigger credit pack.
                      </h2>
                    </div>
                    <div className="rounded-full border border-orange-200/20 bg-orange-200/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-orange-100/75">
                      3 runtime modes
                    </div>
                  </div>

                  <div className="mt-6 space-y-3">
                    {workflowChoices.map((choice) => (
                      <div
                        key={choice.title}
                        className="rounded-[1.35rem] border border-border/60 bg-card/45 px-4 py-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-medium text-foreground">{choice.title}</div>
                            <p className="mt-1 text-sm leading-6 text-muted-foreground">
                              {choice.description}
                            </p>
                          </div>
                          <div className="rounded-full border border-white/10 bg-background/80 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-foreground">
                            {choice.plan}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 rounded-[1.35rem] border border-orange-200/15 bg-orange-200/[0.06] p-4 text-sm leading-7 text-muted-foreground">
                    Upgrade path: start with a temporary manual run, move to wake-and-recover once the
                    workflow repeats, and only choose Always On when the workspace itself should stay live.
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="border-b border-border/60 bg-card/30">
          <div className="container mx-auto px-4 py-18 md:py-20">
            <div className="max-w-3xl">
              <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">How pricing works</div>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-foreground md:text-4xl">
                The split is simple: discovery is free, managed runtime is paid.
              </h2>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {pricingSteps.map((step, index) => (
                <Card key={step} className="rounded-[1.6rem] border-border/60 bg-background/60">
                  <CardContent className="p-6">
                    <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                      0{index + 1}
                    </div>
                    <p className="mt-4 text-base leading-7 text-foreground">{step}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-border/60">
          <div className="container mx-auto px-4 py-18 md:py-20">
            <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Operating modes</div>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-foreground md:text-4xl">
                  Choose the runtime behavior that matches the workload.
                </h2>
              </div>
              <p className="max-w-xl text-sm leading-7 text-muted-foreground">
                Credits are supporting detail. The real decision is whether you need a bounded manual
                session, a wakeable recoverable runtime, or a persistent managed workspace.
              </p>
            </div>

            <div className="grid gap-5 xl:grid-cols-4">
              {plans.map((plan) => (
                <PlanCard key={plan.name} plan={plan} />
              ))}
            </div>

            <p className="mt-6 text-xs leading-6 text-muted-foreground">
              For Run and Warm Standby, 1 credit is used when a managed launch or wake successfully
              starts.
            </p>
            <p className="mt-1 text-xs leading-6 text-muted-foreground/80">
              Credits are an entry budget for managed runtime, not a full minute-by-minute metering
              model.
            </p>
          </div>
        </section>

        <section className="border-b border-border/60 bg-card/30">
          <div className="container mx-auto px-4 py-18 md:py-20">
            <div className="max-w-3xl">
              <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Plan meanings</div>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-foreground md:text-4xl">
                The four plan positions in plain language.
              </h2>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {supportCallouts.map((item) => (
                <DecisionCard
                  key={item.title}
                  title={item.title}
                  description={item.description}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-border/60">
          <div className="container mx-auto px-4 py-18 md:py-20">
            <div className="max-w-3xl">
              <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Detailed limits</div>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-foreground md:text-4xl">
                For operators who already know what runtime behavior they need.
              </h2>
            </div>

            <div className="mt-8 overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0">
                <thead>
                  <tr>
                    <th className="min-w-[11rem] border-b border-border/60 px-4 py-4 text-left text-xs uppercase tracking-[0.22em] text-muted-foreground align-top">
                      Criteria
                    </th>
                    {plans.map((plan) => (
                      <th
                        key={plan.name}
                        className="min-w-[11rem] border-b border-border/60 px-4 py-4 text-left align-top"
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
                      <td className="border-b border-border/40 px-4 py-4 align-top text-sm text-muted-foreground">
                        {row.label}
                      </td>
                      {row.values.map((value, valueIndex) => (
                        <td
                          key={`${row.label}-${plans[valueIndex].name}`}
                          className={cn(
                            'border-b border-border/40 px-4 py-4 align-top text-sm leading-6 text-foreground',
                            rowIndex === comparisonRows.length - 1 && 'border-b-0',
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
          <div className="container mx-auto px-4 py-18 md:py-20">
            <div className="max-w-3xl">
              <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Decision FAQ</div>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-foreground md:text-4xl">
                The questions this page should answer before you buy.
              </h2>
            </div>

            <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {decisionFaqs.map((item, index) => (
                <Card
                  key={item.question}
                  className={cn(
                    'rounded-[1.6rem] border-border/60 bg-background/60',
                    index === 4 && 'md:col-span-2 xl:col-span-1',
                  )}
                >
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
              <CardContent className="relative p-6 md:p-8">
                <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.04),transparent_55%)]" />

                <div className="relative flex flex-col gap-8">
                  <div className="max-w-2xl">
                    <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Start here</div>
                    <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-foreground md:text-4xl">
                      Choose the runtime by how state should behave.
                    </h2>
                    <p className="mt-4 text-sm leading-7 text-muted-foreground">
                      Run is for manual tests. Warm Standby is for wake with memory. Always On is for
                      staying live.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <BottomChoice
                      title="Run = test manually"
                      description="Use it when a bounded session is enough and stopping can mean starting fresh later."
                    />
                    <BottomChoice
                      title="Warm Standby = wake with memory"
                      description="Use it when Telegram should wake the workflow and later recover state instead of restarting from zero."
                    />
                    <BottomChoice
                      title="Always On = stay live"
                      description="Use it when a core workspace should remain alive as an operating surface."
                    />
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
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
                      className="h-12 rounded-full border-border/70 bg-background/70 px-6 text-sm"
                    >
                      <Link href="/app/bundles">Choose a Plan from Bundle Detail</Link>
                    </Button>
                  </div>
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
          <div className="text-right">
            <div className="rounded-full border border-white/10 bg-background/75 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {plan.tone}
            </div>
            {plan.highlight ? (
              <div className="mt-2 rounded-full border border-orange-200/20 bg-orange-200/10 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-orange-100/75">
                {plan.highlight}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-5">
          <div className="text-lg font-semibold tracking-[-0.02em] text-foreground">{plan.name}</div>
          <div className="mt-2 text-4xl font-semibold tracking-[-0.05em] text-foreground">{plan.price}</div>
        </div>

        <div className="mt-6 space-y-5">
          <PlanSection label="Best for" value={plan.bestFor} />
          <PlanSection label="Runtime behavior" value={plan.runtimeBehavior} />
          <PlanSection label="Persistence" value={plan.persistence} />
          <PlanSection label="What happens when it stops" value={plan.stopBehavior} />
          <PlanSection label="Recovery model" value={plan.recoveryModel} />
          <PlanSection label="Why this exists" value={plan.whyExists} />
          <PlanSection label="Who it is for" value={plan.whoItsFor} />
        </div>

        {!plan.hideBudget ? (
          <div className="mt-6 rounded-[1.35rem] border border-border/60 bg-card/45 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Runtime budget
            </div>
            <div className="mt-3 text-sm font-medium text-foreground">{plan.budgetBadge}</div>
            <div className="mt-1 text-xs leading-6 text-muted-foreground">{plan.budgetDetail}</div>
          </div>
        ) : (
          <div className="mt-6 rounded-[1.35rem] border border-border/60 bg-card/45 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Managed runtime shape
            </div>
            <div className="mt-3 text-sm font-medium text-foreground">Persistent occupancy, not a launch-credit pitch.</div>
            <div className="mt-1 text-xs leading-6 text-muted-foreground">
              Always On is sold as a long-running managed setup, not as a bigger version of Run.
            </div>
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3">
          {plan.metrics.map((metric) => (
            <PlanMetric
              key={`${plan.name}-${metric.label}`}
              icon={metric.icon}
              label={metric.label}
              value={metric.value}
            />
          ))}
        </div>

        <div className="mt-5 rounded-[1.2rem] border border-border/60 bg-background/55 p-4">
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
          <Link href={plan.href}>{plan.cta}</Link>
        </Button>
      </CardContent>
    </Card>
  )
}

function BottomChoice({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="rounded-[1.35rem] border border-border/60 bg-background/55 p-4">
      <div className="text-sm font-medium text-foreground">{title}</div>
      <p className="mt-2 text-sm leading-7 text-muted-foreground">{description}</p>
    </div>
  )
}

function DecisionCard({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <Card className="rounded-[1.6rem] border-border/60 bg-background/60">
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold tracking-[-0.02em] text-foreground">{title}</h3>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}

function FactPill({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/55 px-4 py-3">
      <div className="text-[11px] uppercase tracking-[0.18em] text-orange-200/80">{label}</div>
      <div className="mt-2 text-base font-medium text-foreground">{value}</div>
    </div>
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
      <div className="mt-2 text-sm font-medium text-foreground">{value}</div>
    </div>
  )
}

function PlanSection({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <p className="mt-2 text-sm leading-7 text-muted-foreground">{value}</p>
    </div>
  )
}
