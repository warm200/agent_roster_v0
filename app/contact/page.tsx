import Link from 'next/link'
import type { Metadata } from 'next'
import { Mail } from 'lucide-react'

import { Header } from '@/components/header'

export const metadata: Metadata = {
  title: 'Contact - OpenRoster',
}

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="container mx-auto max-w-xl px-4 py-12">
        <h1 className="text-3xl font-bold mb-2">Contact</h1>
        <p className="text-sm text-muted-foreground mb-10">
          Have a question, issue, or feedback? Reach out and we&apos;ll get back to you.
        </p>

        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
              <Mail className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <a href="mailto:support@openroster.ai" className="text-sm font-medium text-foreground hover:underline">
                support@openroster.ai
              </a>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            For account, billing, or technical issues. We typically respond within 1&ndash;2 business days.
          </p>
        </div>

        <div className="mt-8 text-sm text-muted-foreground space-x-4">
          <Link href="/terms" className="underline hover:text-foreground">Terms</Link>
          <Link href="/privacy" className="underline hover:text-foreground">Privacy</Link>
        </div>
      </main>
    </div>
  )
}
