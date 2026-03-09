import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Header } from '@/components/header'
import { RiskBadge } from '@/components/risk-badge'
import { 
  ArrowRight, 
  Bot, 
  Mail, 
  Calendar, 
  FileText, 
  Shield, 
  Play, 
  MessageSquare,
  CheckCircle2,
  Zap
} from 'lucide-react'

const features = [
  {
    icon: Mail,
    title: 'Inbox Management',
    description: 'Triage, categorize, and draft responses for your email automatically.',
  },
  {
    icon: Calendar,
    title: 'Calendar Optimization',
    description: 'Smart scheduling that protects your focus time and resolves conflicts.',
  },
  {
    icon: FileText,
    title: 'Document Processing',
    description: 'Summarize documents, extract key points, and generate briefs.',
  },
]

const benefits = [
  'Curated agents reviewed for safety',
  'Clear risk transparency before purchase',
  'Unified Telegram integration',
  'In-app run monitoring and logs',
  'Downloadable install packages',
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-secondary/50 via-transparent to-transparent" />
        <div className="container mx-auto px-4 py-24 md:py-32 relative">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-10 h-10 rounded-xl bg-foreground flex items-center justify-center">
                <Bot className="w-6 h-6 text-background" />
              </div>
              <span className="text-sm font-medium text-muted-foreground">AgentRoster</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6 text-balance">
              Personal Ops Agents
              <br />
              <span className="text-muted-foreground">that actually work.</span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl">
              Discover, purchase, and run trusted AI agents for your daily workflows. 
              From inbox triage to calendar optimization — curated, safe, and ready to deploy.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" asChild>
                <Link href="/agents">
                  Browse Agents
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/app">
                  Go to Dashboard
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="border-t border-border bg-card/50">
        <div className="container mx-auto px-4 py-20">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
              Agents for Every Workflow
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Focus on what matters. Let agents handle the repetitive tasks across your tools.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {features.map((feature) => (
              <Card key={feature.title} className="bg-card border-border">
                <CardContent className="p-6">
                  <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center mb-4">
                    <feature.icon className="w-6 h-6 text-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Preview vs Run Section */}
      <section className="border-t border-border">
        <div className="container mx-auto px-4 py-20">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
              Try Before You Buy
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Preview any agent for free to understand its approach. 
              Purchase to unlock full execution with your real data.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <Card className="bg-card border-border">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Preview Chat</h3>
                    <span className="text-xs text-muted-foreground">Free, no account required</span>
                  </div>
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Chat with agent to understand its approach
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    No real workspace or file access
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Safe sandbox environment
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-foreground flex items-center justify-center">
                    <Play className="w-5 h-5 text-background" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Full Run</h3>
                    <span className="text-xs text-muted-foreground">After purchase</span>
                  </div>
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    Real workspace and tool access
                  </li>
                  <li className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    Telegram notifications and results
                  </li>
                  <li className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    Full run logs and artifacts
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="border-t border-border bg-card/50">
        <div className="container mx-auto px-4 py-20">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-5 h-5 text-emerald-400" />
                <span className="text-sm font-medium text-emerald-400">Trust & Safety</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
                Clear Risk Transparency
              </h2>
              <p className="text-muted-foreground mb-6">
                Every agent shows its capabilities and risk level upfront. 
                Know exactly what permissions an agent needs before you buy.
              </p>

              <div className="flex flex-wrap gap-3 mb-6">
                <RiskBadge level="low" />
                <RiskBadge level="medium" />
                <RiskBadge level="high" />
              </div>

              <ul className="space-y-3">
                {benefits.map((benefit) => (
                  <li key={benefit} className="flex items-center gap-3 text-sm text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    {benefit}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-medium text-foreground">Inbox Triage Agent</h4>
                  <span className="text-xs text-muted-foreground">v1.2.0</span>
                </div>
                <RiskBadge level="low" size="sm" className="ml-auto" />
              </div>
              
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">File Read</span>
                  <span className="text-foreground">No</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">File Write</span>
                  <span className="text-foreground">No</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Network</span>
                  <span className="text-foreground">Email API only</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-muted-foreground">Shell</span>
                  <span className="text-foreground">No</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t border-border">
        <div className="container mx-auto px-4 py-20 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
            Ready to automate your workflows?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Browse our curated collection of Personal Ops agents and start running in minutes.
          </p>
          <Button size="lg" asChild>
            <Link href="/agents">
              Explore Agents
              <ArrowRight className="ml-2 w-4 h-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card/50">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-foreground flex items-center justify-center">
                <Bot className="w-4 h-4 text-background" />
              </div>
              <span className="text-sm font-medium">AgentRoster</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Trusted Personal Ops Agents Platform
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
