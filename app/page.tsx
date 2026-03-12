import Link from 'next/link'

import { Header } from '@/components/header'
import { RiskBadge } from '@/components/risk-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  ArrowRight,
  Bot,
  Calendar,
  CheckCircle2,
  FileText,
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

const workflows = [
  {
    icon: Mail,
    kicker: 'Inbox',
    title: 'Triage the chaos',
    description: 'Draft replies, group urgent threads, and keep your inbox from becoming archaeology.',
  },
  {
    icon: Calendar,
    kicker: 'Calendar',
    title: 'Protect your focus blocks',
    description: 'Reschedule collisions, hold deep-work windows, and keep meetings from eating the week.',
  },
  {
    icon: FileText,
    kicker: 'Docs',
    title: 'Turn documents into action',
    description: 'Pull deadlines, summarize decisions, and compress long reads into a useful brief.',
  },
]

const steps = [
  {
    id: '01',
    title: 'Preview the agent brain',
    description: 'Chat with the agent first. Learn its style, boundaries, and whether it is worth your time.',
  },
  {
    id: '02',
    title: 'Buy once, connect once',
    description: 'Purchase the bundle, validate Telegram, and keep the handoff path consistent from checkout to run.',
  },
  {
    id: '03',
    title: 'Launch into the real workspace',
    description: 'Runs expose status, logs, results, and Control UI without hiding what the runtime is allowed to do.',
  },
]

const benefits = [
  'Curated agents reviewed for safety',
  'Risk language that normal people can read',
  'Runs, logs, and artifacts in one place',
  'Telegram setup without webhook pain in local dev',
]

const floatingTags = [
  'Preview first',
  'Risk labeled',
  'Telegram paired',
  'Run logs',
  'Control UI',
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main>
        <section className="relative overflow-hidden border-b border-border/60">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_32%),radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.06),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_60%)]" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

          <div className="container mx-auto grid gap-14 px-4 py-18 md:grid-cols-[minmax(0,1.05fr)_minmax(22rem,0.95fr)] md:items-center md:py-24 lg:gap-20 lg:py-28">
            <div className="relative z-10">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/70 px-3 py-1.5 text-xs uppercase tracking-[0.22em] text-muted-foreground backdrop-blur">
                <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
                Technical buyers, less black box
              </div>

              <h1 className="max-w-4xl text-4xl font-semibold leading-[0.95] tracking-[-0.04em] text-foreground md:text-6xl lg:text-7xl">
                Buy playful
                <span className="text-muted-foreground"> agent workflows </span>
                without giving up operational trust.
              </h1>

              <p className="mt-6 max-w-2xl text-base leading-8 text-muted-foreground md:text-lg">
                AgentRoster is for solo operators and founders who want useful automation, not an
                opaque demo. Preview the personality, inspect the risk, then launch the real run.
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
                <Button size="lg" variant="outline" asChild className="h-12 rounded-full border-border/70 bg-card/60 px-6 text-sm">
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
                Runs with receipts
              </div>
              <div className="absolute -left-4 top-20 hidden rounded-full border border-border/70 bg-card/70 px-4 py-2 text-xs uppercase tracking-[0.2em] text-muted-foreground backdrop-blur lg:block motion-safe:animate-[hero-drift_10s_ease-in-out_infinite_1s]">
                Preview before payment
              </div>

              <Card className="relative overflow-hidden rounded-[2rem] border-border/70 bg-card/85 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)] backdrop-blur">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.09),transparent_35%),linear-gradient(145deg,rgba(255,255,255,0.03),transparent_55%)]" />
                <CardContent className="relative p-5 md:p-6">
                  <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/65 px-4 py-3 backdrop-blur">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary text-foreground">
                        <Bot className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-foreground">AgentRoster</div>
                        <div className="text-xs text-muted-foreground">Control room for paid runs</div>
                      </div>
                    </div>
                    <div className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-emerald-300">
                      Ready to launch
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4">
                    <div className="rounded-[1.5rem] border border-border/60 bg-background/65 p-5 backdrop-blur">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Live bundle</div>
                          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-foreground">
                            Inbox Triage Agent
                          </h2>
                          <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                            Previewed. Paid. Telegram paired. Waiting for you to hit launch instead of
                            wondering what the runtime might do.
                          </p>
                        </div>
                        <RiskBadge level="low" />
                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-3">
                        <MetricCard label="Preview" value="Free chat first" />
                        <MetricCard label="Runtime" value="Managed workspace" />
                        <MetricCard label="Channel" value="Telegram paired" />
                        <MetricCard label="Logs" value="Readable in app" />
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-[1.1fr_0.9fr]">
                      <div className="rounded-[1.5rem] border border-border/60 bg-background/65 p-4 backdrop-blur">
                        <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-muted-foreground">
                          <Play className="h-3.5 w-3.5" />
                          Run rhythm
                        </div>
                        <div className="space-y-3">
                          {steps.map((step, index) => (
                            <div key={step.id} className="flex items-start gap-3">
                              <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border/70 bg-card text-xs text-foreground">
                                {index + 1}
                              </div>
                              <div>
                                <div className="text-sm font-medium text-foreground">{step.title}</div>
                                <div className="mt-1 text-sm leading-6 text-muted-foreground">
                                  {step.description}
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
                            Small delight, no circus
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {floatingTags.map((tag, index) => (
                              <span
                                key={tag}
                                className="inline-flex rounded-full border border-border/60 bg-background/75 px-3 py-1.5 text-xs text-foreground motion-safe:animate-[hero-drift_9s_ease-in-out_infinite]"
                                style={{ animationDelay: `${index * 0.6}s` }}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                          <p className="mt-4 text-sm leading-6 text-muted-foreground">
                            Enough motion to feel alive. Not enough to make a technical buyer close the tab.
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
                <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Workflows</div>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-foreground md:text-4xl">
                  Pick the workflow,
                  <span className="text-muted-foreground"> not the prompt engineering hobby.</span>
                </h2>
              </div>
              <p className="max-w-xl text-sm leading-7 text-muted-foreground">
                Each catalog entry is meant to feel concrete: what it helps with, what risk it carries,
                and how it fits into an actual operator’s day.
              </p>
            </div>

            <div className="grid gap-5 lg:grid-cols-3">
              {workflows.map((workflow, index) => (
                <Card
                  key={workflow.title}
                  className="group overflow-hidden rounded-[1.75rem] border-border/60 bg-background/60 transition-transform duration-300 hover:-translate-y-1 motion-reduce:transform-none"
                >
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-foreground">
                        <workflow.icon className="h-6 w-6" />
                      </div>
                      <span className="text-xs uppercase tracking-[0.22em] text-foreground/30">
                        0{index + 1}
                      </span>
                    </div>
                    <div className="mt-5 text-xs uppercase tracking-[0.22em] text-muted-foreground">
                      {workflow.kicker}
                    </div>
                    <h3 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-foreground">
                      {workflow.title}
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-muted-foreground">
                      {workflow.description}
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
                Risk is a feature here, not fine print. Every agent makes its permissions legible before
                you commit real workspace time or real money.
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
                    Browse the catalog.
                    <span className="text-muted-foreground"> Find the one that feels like cheating.</span>
                  </h2>
                  <p className="mt-4 text-sm leading-7 text-muted-foreground">
                    Preview first. Buy when the fit is obvious. Launch when the task is real.
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
                  <Button size="lg" variant="outline" asChild className="h-12 rounded-full border-border/70 bg-background/70 px-6 text-sm">
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
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-foreground text-background">
              <Bot className="h-4 w-4" />
            </div>
            AgentRoster
          </div>
          <p>Trusted Personal Ops Agents Platform</p>
        </div>
      </footer>
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
