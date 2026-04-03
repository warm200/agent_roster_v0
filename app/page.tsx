import { cookies } from 'next/headers'
import Link from 'next/link'
import { cache } from 'react'

import { AbImpression } from '@/components/ab-impression'
import { BrandLogo } from '@/components/brand-logo'
import { Header } from '@/components/header'
import { RiskBadge } from '@/components/risk-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { AB_COOKIE_NAME, HERO_COPY, parseVariant } from '@/lib/ab-testing'
import type { HeroVariant } from '@/lib/ab-testing'
import {
  ArrowRight,
  Bot,
  Calendar,
  CheckCircle2,
  FileText,
  Github,
  Layers3,
  Mail,
  MessageSquare,
  Play,
  Shield,
  Sparkles,
  Zap,
} from 'lucide-react'

const highlights = [
  'Preview the voice before you buy the runtime',
  'Telegram handoff, live status, and downloadable installs',
  'Risk labels upfront. No mystery permissions after checkout.',
]

const bundleTemplates = [
  {
    icon: Sparkles,
    kicker: 'Morning Ops Bundle',
    title: 'Start the day with inbox, calendar, and context already aligned.',
    description:
      'A compact workspace for triage, schedule repair, and a usable brief before the day gets noisy.',
    agents: ['Inbox triage', 'Calendar guard', 'Daily brief'],
    outcome: 'Best for getting into execution fast',
  },
  {
    icon: Mail,
    kicker: 'Founder Inbox Bundle',
    title: 'Turn message overload into a controlled decision queue.',
    description:
      'Bundle the agents that sort priority threads, draft replies, and surface follow-ups without losing tone.',
    agents: ['Priority sorter', 'Reply drafter', 'Follow-up tracker'],
    outcome: 'Best for high-context communication loops',
  },
  {
    icon: FileText,
    kicker: 'Weekly Review Bundle',
    title: 'Close the loop on docs, decisions, and next actions in one pass.',
    description:
      'A review workspace that pulls notes, summarizes movement, and packages the next week into something actionable.',
    agents: ['Notes digester', 'Decision summary', 'Next-week planner'],
    outcome: 'Best for recurring operating rituals',
  },
] as const

const bundleReasons = [
  {
    title: 'Single agents solve one move',
    description:
      'Useful, but isolated. You still have to coordinate the handoff, remember the sequence, and stitch outputs together yourself.',
  },
  {
    title: 'Bundles behave like a workstation',
    description:
      'The value is the combination: multiple agents, one operating loop, one shared job to get done.',
  },
  {
    title: 'You keep the combinations that work',
    description:
      'Over time the product becomes less about browsing isolated agents and more about keeping a set of bundles that fit your real routines.',
  },
] as const

const supportPillars = [
  {
    icon: MessageSquare,
    title: 'Preview before commitment',
    description: 'Understand tone, logic, and boundaries first. Runtime comes later.',
  },
  {
    icon: Zap,
    title: 'Run with a real handoff',
    description: 'Telegram pairing, status, logs, and results keep the bundle operational instead of theatrical.',
  },
  {
    icon: Shield,
    title: 'Trust stays visible',
    description: 'Risk labels stay upfront so the bundle feels inspectable before money or workspace access changes hands.',
  },
] as const

const benefits = [
  'Curated agents reviewed for safety',
  'Risk language that normal people can read',
  'Runs, logs, and artifacts in one place',
  'Telegram setup without webhook pain in local dev',
]

const GITHUB_REPO_URL = 'https://github.com/OpenRoster-ai/awesome-openroster'

const getGithubStars = cache(async () => {
  try {
    const response = await fetch('https://api.github.com/repos/OpenRoster-ai/awesome-openroster', {
      cache: 'no-store',
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'OpenRoster',
      },
    })

    if (!response.ok) {
      return null
    }

    const payload = (await response.json()) as {
      stargazers_count?: number
    }

    return typeof payload.stargazers_count === 'number' ? payload.stargazers_count : null
  } catch {
    return null
  }
})

function formatGithubStars(count: number | null) {
  if (count == null) {
    return null
  }

  return new Intl.NumberFormat('en', {
    maximumFractionDigits: count >= 1000 ? 1 : 0,
    notation: count >= 1000 ? 'compact' : 'standard',
  }).format(count)
}

export default async function HomePage() {
  const githubStars = formatGithubStars(await getGithubStars())
  const cookieStore = await cookies()
  const variant: HeroVariant = parseVariant(cookieStore.get(AB_COOKIE_NAME)?.value) ?? 'control'
  const hero = HERO_COPY[variant]

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <AbImpression variant={variant} />

      <main>
        <section className="relative overflow-hidden border-b border-border/60">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_32%),radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.06),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_60%)]" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

          <div className="container mx-auto grid gap-12 px-4 pb-16 pt-8 md:grid-cols-[minmax(0,1.05fr)_minmax(22rem,0.95fr)] md:items-start md:gap-14 md:pb-20 md:pt-10 lg:gap-20 lg:pb-24 lg:pt-12">
            <div className="relative z-10">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/70 px-3 py-1.5 text-xs uppercase tracking-[0.22em] text-muted-foreground backdrop-blur">
                <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
                {hero.kicker}
              </div>

              <h1 className="max-w-4xl text-4xl font-semibold leading-[0.95] tracking-[-0.04em] text-foreground md:text-6xl lg:text-7xl">
                {hero.headline}
                <span className="text-muted-foreground">{hero.headlineAccent}</span>
                {hero.headlineTail}
              </h1>

              <p className="mt-6 max-w-2xl text-base leading-8 text-muted-foreground md:text-lg">
                {hero.subhead}
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button
                  size="lg"
                  asChild
                  className="group h-12 rounded-full px-6 text-sm font-medium shadow-[0_14px_30px_-18px_rgba(255,255,255,0.65)]"
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

              <div className="mt-8 grid gap-3 text-sm text-muted-foreground md:max-w-2xl">
                {highlights.map((item, index) => (
                  <div
                    key={item}
                    className="flex items-start gap-3 rounded-2xl border border-border/60 bg-card/55 px-4 py-3 backdrop-blur"
                  >
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-400/12 text-emerald-300">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </div>
                    <span className="leading-6">{item}</span>
                    <span className="ml-auto hidden text-[11px] uppercase tracking-[0.2em] text-foreground/35 md:inline">
                      0{index + 1}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative z-10">
              <div className="absolute -top-8 right-5 hidden rounded-full border border-border/70 bg-card/70 px-4 py-2 text-xs uppercase tracking-[0.2em] text-muted-foreground backdrop-blur md:block motion-safe:animate-[hero-drift_8s_ease-in-out_infinite]">
                Bundle first
              </div>
              <div className="absolute -left-4 top-20 hidden rounded-full border border-border/70 bg-card/70 px-4 py-2 text-xs uppercase tracking-[0.2em] text-muted-foreground backdrop-blur lg:block motion-safe:animate-[hero-drift_10s_ease-in-out_infinite_1s]">
                Keep what works
              </div>

              <Card className="relative overflow-hidden rounded-[2rem] border-border/70 bg-card/85 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)] backdrop-blur">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.09),transparent_35%),linear-gradient(145deg,rgba(255,255,255,0.03),transparent_55%)]" />
                <CardContent className="relative p-5 md:p-6">
                  <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/65 px-4 py-3 backdrop-blur">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary text-foreground">
                        <Layers3 className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-foreground">Morning Ops Bundle</div>
                        <div className="text-xs text-muted-foreground">A focused workspace, not a loose cart</div>
                      </div>
                    </div>
                    <div className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-emerald-300">
                      Ready to run
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4">
                    <div className="rounded-[1.5rem] border border-border/60 bg-background/65 p-5 backdrop-blur">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Bundle composition</div>
                          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-foreground">
                            Three agents. One operating loop.
                          </h2>
                          <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                            Inbox triage clears the queue, calendar guard protects the day, and daily
                            brief turns the output into a usable starting point.
                          </p>
                        </div>
                        <RiskBadge level="low" />
                      </div>

                      <div className="mt-5 flex flex-wrap gap-2">
                        <BundleChip icon={Mail} label="Inbox triage" />
                        <BundleChip icon={Calendar} label="Calendar guard" />
                        <BundleChip icon={FileText} label="Daily brief" />
                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-3">
                        <MetricCard label="Preview" value="Bundle voice first" />
                        <MetricCard label="Channel" value="Telegram paired" />
                        <MetricCard label="Runtime" value="Managed workspace" />
                        <MetricCard label="Output" value="One shared loop" />
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-[1.1fr_0.9fr]">
                      <div className="rounded-[1.5rem] border border-border/60 bg-background/65 p-4 backdrop-blur">
                        <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-muted-foreground">
                          <Play className="h-3.5 w-3.5" />
                          Bundle logic
                        </div>
                        <div className="space-y-3">
                          {bundleReasons.map((reason, index) => (
                            <div key={reason.title} className="flex items-start gap-3">
                              <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border/70 bg-card text-xs text-foreground">
                                {index + 1}
                              </div>
                              <div>
                                <div className="text-sm font-medium text-foreground">{reason.title}</div>
                                <div className="mt-1 text-sm leading-6 text-muted-foreground">
                                  {reason.description}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="relative overflow-hidden rounded-[1.5rem] border border-border/60 bg-secondary/35 p-4">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.09),transparent_38%)]" />
                        <div className="relative">
                          <div className="mb-3 text-xs uppercase tracking-[0.22em] text-muted-foreground">
                            What users keep
                          </div>
                          <div className="space-y-2">
                            <SavedBundleRow label="Morning routine" detail="Triage + calendar + brief" />
                            <SavedBundleRow label="Founder loop" detail="Priority inbox + draft replies" />
                            <SavedBundleRow label="Friday review" detail="Summaries + next actions" />
                          </div>
                          <p className="mt-4 text-sm leading-6 text-muted-foreground">
                            The memorable unit is the combination, not one isolated capability.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="border-b border-border/60 bg-card/35">
          <div className="container mx-auto px-4 py-18 md:py-20">
            <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Bundle Templates</div>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-foreground md:text-4xl">
                  Start from a working combination,
                  <span className="text-muted-foreground"> not a lonely agent card.</span>
                </h2>
              </div>
              <p className="max-w-xl text-sm leading-7 text-muted-foreground">
                These are examples of the mental model: you are choosing a composition for a workflow,
                then refining the bundle that earns a permanent spot in your stack.
              </p>
            </div>

            <div className="grid gap-5 lg:grid-cols-3">
              {bundleTemplates.map((bundle, index) => (
                <Card
                  key={bundle.kicker}
                  className="group overflow-hidden rounded-[1.75rem] border-border/60 bg-background/60 transition-transform duration-300 hover:-translate-y-1 motion-reduce:transform-none"
                >
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-foreground">
                        <bundle.icon className="h-6 w-6" />
                      </div>
                      <span className="text-xs uppercase tracking-[0.22em] text-foreground/30">
                        0{index + 1}
                      </span>
                    </div>
                    <div className="mt-5 text-xs uppercase tracking-[0.22em] text-muted-foreground">
                      {bundle.kicker}
                    </div>
                    <h3 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-foreground">
                      {bundle.title}
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-muted-foreground">
                      {bundle.description}
                    </p>
                    <div className="mt-5 flex flex-wrap gap-2">
                      {bundle.agents.map((agent) => (
                        <span
                          key={agent}
                          className="rounded-full border border-border/60 bg-card/65 px-3 py-1.5 text-xs text-foreground"
                        >
                          {agent}
                        </span>
                      ))}
                    </div>
                    <p className="mt-5 text-sm leading-6 text-muted-foreground">{bundle.outcome}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-border/60">
          <div className="container mx-auto grid gap-10 px-4 py-18 md:grid-cols-[0.95fr_1.05fr] md:items-center md:py-20">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/60 px-3 py-1.5 text-xs uppercase tracking-[0.22em] text-muted-foreground">
                <Layers3 className="h-3.5 w-3.5 text-emerald-300" />
                Why bundles win
              </div>
              <h2 className="mt-5 text-3xl font-semibold tracking-[-0.03em] text-foreground md:text-4xl">
                A single agent is a skill point.
                <span className="text-muted-foreground"> A bundle is a runnable workstation.</span>
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground">
                The product becomes more defensible when the user thinks in combinations. That is where
                repeatable workflows, shared context, and real operating value start to show up.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {bundleReasons.map((reason, index) => (
                <div
                  key={reason.title}
                  className="rounded-[1.4rem] border border-border/60 bg-card/55 px-4 py-4 text-sm leading-6 text-muted-foreground backdrop-blur"
                >
                  <div className="mb-4 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-400/12 text-emerald-300">
                    {index + 1}
                  </div>
                  <div className="text-base font-medium text-foreground">{reason.title}</div>
                  <p className="mt-2">{reason.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-border/60 bg-card/30">
          <div className="container mx-auto px-4 py-18 md:py-20">
            <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Support Layer</div>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-foreground md:text-4xl">
                  Preview, trust, and runtime make the bundle usable.
                </h2>
              </div>
              <p className="max-w-xl text-sm leading-7 text-muted-foreground">
                These are still core. They just work better as proof that the bundle can be understood,
                trusted, and run end to end.
              </p>
            </div>

            <div className="grid gap-5 lg:grid-cols-3">
              {supportPillars.map((pillar, index) => (
                <Card
                  key={pillar.title}
                  className="group overflow-hidden rounded-[1.75rem] border-border/60 bg-background/60"
                >
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-foreground">
                        <pillar.icon className="h-6 w-6" />
                      </div>
                      <span className="text-xs uppercase tracking-[0.22em] text-foreground/30">
                        0{index + 1}
                      </span>
                    </div>
                    <h3 className="mt-5 text-xl font-semibold tracking-[-0.02em] text-foreground">
                      {pillar.title}
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-muted-foreground">
                      {pillar.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-border/60">
          <div className="container mx-auto grid gap-10 px-4 py-18 md:grid-cols-[0.95fr_1.05fr] md:items-center md:py-20">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/60 px-3 py-1.5 text-xs uppercase tracking-[0.22em] text-muted-foreground">
                <Shield className="h-3.5 w-3.5 text-emerald-300" />
                Trust without deadening the experience
              </div>
              <h2 className="mt-5 text-3xl font-semibold tracking-[-0.03em] text-foreground md:text-4xl">
                Safety copy that doesn’t read like a compliance hostage note.
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground">
                Risk is still a feature, not fine print. Every agent in the bundle keeps its permissions
                legible before you commit real workspace time or real money.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <RiskBadge level="low" />
                <RiskBadge level="medium" />
                <RiskBadge level="high" />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {benefits.map((benefit) => (
                <div
                  key={benefit}
                  className="rounded-[1.4rem] border border-border/60 bg-card/55 px-4 py-4 text-sm leading-6 text-muted-foreground backdrop-blur"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-400/12 text-emerald-300">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <span>{benefit}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.06),transparent_42%)]" />
          <div className="container mx-auto px-4 py-18 md:py-20">
            <Card className="overflow-hidden rounded-[2rem] border-border/70 bg-card/75 shadow-[0_24px_70px_-36px_rgba(0,0,0,0.8)]">
              <CardContent className="relative flex flex-col gap-8 p-6 md:flex-row md:items-center md:justify-between md:p-8">
                <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.04),transparent_55%)]" />
                <div className="relative max-w-2xl">
                  <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Start here</div>
                  <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-foreground md:text-4xl">
                    Compose the bundle.
                    <span className="text-muted-foreground"> Keep the combinations that earn their place.</span>
                  </h2>
                  <p className="mt-4 text-sm leading-7 text-muted-foreground">
                    Browse agents, shape a focused workspace, preview before buying, then run the bundle
                    when the job is real.
                  </p>
                </div>

                <div className="relative flex flex-col gap-3 sm:flex-row">
                  <Button
                    size="lg"
                    asChild
                    className="group h-12 rounded-full px-6 text-sm font-medium shadow-[0_14px_30px_-18px_rgba(255,255,255,0.65)]"
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

      <footer className="border-t border-border/60 bg-card/35">
        <div className="container mx-auto flex flex-col gap-3 px-4 py-6 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 text-foreground">
            <BrandLogo className="h-7 w-7 rounded-xl" size={28} />
            OpenRoster
          </div>
          <div className="flex items-center gap-4">
            <Link
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/60 px-3 py-1.5 text-foreground transition-colors hover:border-foreground/25 hover:bg-background"
            >
              <Github className="h-4 w-4" />
              <span>GitHub</span>
              {githubStars ? (
                <span className="rounded-full border border-border/70 bg-card/70 px-2 py-0.5 text-xs text-muted-foreground">
                  {githubStars} stars
                </span>
              ) : null}
            </Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

function BundleChip({
  icon: Icon,
  label,
}: {
  icon: typeof Bot
  label: string
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/70 px-3 py-2 text-xs text-foreground">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </div>
  )
}

function SavedBundleRow({ label, detail }: { label: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/75 px-3 py-3">
      <div className="text-sm font-medium text-foreground">{label}</div>
      <div className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</div>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/70 p-3">
      <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium text-foreground">{value}</div>
    </div>
  )
}
