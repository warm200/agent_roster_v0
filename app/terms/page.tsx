import Link from 'next/link'
import type { Metadata } from 'next'

import { Header } from '@/components/header'

export const metadata: Metadata = {
  title: 'Terms of Service - OpenRoster',
}

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="container mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-10">Effective date: March 22, 2026</p>

        <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none space-y-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-8 [&_h2]:mb-3 [&_p]:text-muted-foreground [&_li]:text-muted-foreground [&_ul]:list-disc [&_ul]:pl-5">

          <section>
            <h2>1. Agreement to Terms</h2>
            <p>
              By accessing or using OpenRoster (&quot;the Platform&quot;), operated by OpenRoster (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;), you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the Platform.
            </p>
          </section>

          <section>
            <h2>2. Description of Service</h2>
            <p>
              OpenRoster is a managed-agent marketplace and runtime platform. Users can browse, preview, and collect AI agents (&quot;Agents&quot;), assemble them into bundles, and launch them in managed sandbox environments (&quot;Runs&quot;). Agents interact with users through third-party messaging channels such as Telegram.
            </p>
            <p>
              Agents are provided free of charge. The paid product is the managed runtime environment that executes Agents on your behalf.
            </p>
          </section>

          <section>
            <h2>3. User Accounts</h2>
            <p>
              You may authenticate via third-party OAuth providers (GitHub, Google). You are responsible for maintaining the security of your account and all activity that occurs under it. You must provide accurate information during registration.
            </p>
          </section>

          <section>
            <h2>4. User Responsibilities and Assumption of Risk</h2>
            <p>
              <strong>You assume full responsibility and all risk</strong> arising from your use of the Platform, including but not limited to:
            </p>
            <ul>
              <li>All content, prompts, instructions, and data you provide to Agents</li>
              <li>All outputs, actions, and results produced by Agents acting on your behalf</li>
              <li>Any data processed, generated, stored, or transmitted within sandbox environments during Runs</li>
              <li>Any third-party API keys or credentials you provide for Agent configuration</li>
              <li>Any interactions that occur through connected messaging channels (e.g., Telegram bots)</li>
              <li>Any decisions or actions you take based on Agent outputs</li>
            </ul>
            <p>
              You acknowledge that Agents are autonomous software programs powered by third-party AI models and may produce inaccurate, incomplete, or unintended outputs. You are solely responsible for reviewing, validating, and acting upon any Agent output.
            </p>
          </section>

          <section>
            <h2>5. Prohibited Uses</h2>
            <p>You agree not to use the Platform to:</p>
            <ul>
              <li>Violate any applicable law, regulation, or third-party rights</li>
              <li>Generate, distribute, or facilitate harmful, abusive, or illegal content</li>
              <li>Attempt to gain unauthorized access to the Platform, other accounts, or connected systems</li>
              <li>Interfere with or disrupt the Platform&apos;s infrastructure or other users&apos; use</li>
              <li>Use Agents for financial trading, medical diagnosis, legal advice, or any other high-stakes decision-making without independent professional verification</li>
              <li>Reverse-engineer, decompile, or extract source code from the Platform or its Agents</li>
              <li>Resell, sublicense, or redistribute access to the Platform or its services</li>
            </ul>
          </section>

          <section>
            <h2>6. Agents and Agent Content</h2>
            <p>
              Agents available on the Platform are provided &quot;as is.&quot; Each Agent has a disclosed risk profile indicating its capabilities (chat-only, file access, network access, shell access). You should review these risk profiles before launching any Run.
            </p>
            <p>
              We do not guarantee the accuracy, reliability, safety, or fitness for any particular purpose of any Agent or its outputs. Agents may access files, make network requests, or execute commands within sandboxed environments depending on their configuration. You accept full responsibility for understanding and accepting these capabilities before use.
            </p>
          </section>

          <section>
            <h2>7. Runtime and Sandbox Environments</h2>
            <p>
              Runs execute within managed sandbox environments provided by third-party infrastructure partners. While we employ reasonable measures to isolate sandbox environments, <strong>we make no guarantees</strong> regarding the security, availability, or integrity of sandbox environments.
            </p>
            <p>
              You are solely responsible for any data, credentials, or files that you introduce into or that are generated within a sandbox environment. We are not responsible for any data loss, data exposure, corruption, or unauthorized access that may occur within or as a result of sandbox usage.
            </p>
          </section>

          <section>
            <h2>8. Payments and Subscriptions</h2>
            <p>
              Runtime plans and credit top-ups are processed through Stripe. By purchasing a subscription or credits, you agree to Stripe&apos;s terms of service. All payments are final and non-refundable except as required by applicable law.
            </p>
            <p>
              Runtime credits are consumed upon launching Runs. Unused top-up credits expire 90 days after purchase. Subscription cancellations take effect at the end of the current billing period.
            </p>
          </section>

          <section>
            <h2>9. Disclaimer of Warranties</h2>
            <p>
              THE PLATFORM, ALL AGENTS, AND ALL ASSOCIATED SERVICES ARE PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
            </p>
            <p>
              WE DO NOT WARRANT THAT THE PLATFORM WILL BE UNINTERRUPTED, ERROR-FREE, SECURE, OR FREE OF HARMFUL COMPONENTS. WE DO NOT WARRANT THE ACCURACY, COMPLETENESS, OR RELIABILITY OF ANY AGENT OUTPUT.
            </p>
          </section>

          <section>
            <h2>10. Limitation of Liability</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL OPENROSTER, ITS OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, OR AFFILIATES BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO:
            </p>
            <ul>
              <li>Loss of data, revenue, profits, or business opportunities</li>
              <li>Financial losses arising from Agent outputs or actions</li>
              <li>Damages resulting from unauthorized access to or alteration of your data</li>
              <li>Cost of procurement of substitute services</li>
              <li>Any damages arising from your use of or inability to use the Platform</li>
            </ul>
            <p>
              OUR TOTAL AGGREGATE LIABILITY SHALL NOT EXCEED THE AMOUNT YOU HAVE PAID US IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.
            </p>
          </section>

          <section>
            <h2>11. Indemnification</h2>
            <p>
              You agree to indemnify, defend, and hold harmless OpenRoster and its affiliates from any claims, damages, losses, liabilities, and expenses (including reasonable legal fees) arising from your use of the Platform, your violation of these Terms, or your violation of any third-party rights.
            </p>
          </section>

          <section>
            <h2>12. Third-Party Services</h2>
            <p>
              The Platform integrates with third-party services including but not limited to Stripe (payments), Telegram (messaging), and third-party AI model providers. Your use of these services is subject to their respective terms and privacy policies. We are not responsible for the availability, accuracy, or conduct of any third-party service.
            </p>
          </section>

          <section>
            <h2>13. Termination</h2>
            <p>
              We reserve the right to suspend or terminate your account at any time, with or without cause, with or without notice. Upon termination, your right to use the Platform ceases immediately. Any provisions that by their nature should survive termination shall survive.
            </p>
          </section>

          <section>
            <h2>14. Changes to Terms</h2>
            <p>
              We may update these Terms at any time. Changes take effect upon posting to the Platform. Your continued use of the Platform after changes constitutes acceptance of the revised Terms.
            </p>
          </section>

          <section>
            <h2>15. Contact</h2>
            <p>
              Questions about these Terms may be directed to <a href="mailto:support@openroster.ai" className="underline hover:text-foreground">support@openroster.ai</a> or through our <Link href="/contact">contact page</Link>.
            </p>
          </section>
        </div>

        <div className="mt-12 border-t border-border pt-6 text-sm text-muted-foreground">
          <Link href="/privacy" className="underline hover:text-foreground">Privacy Policy</Link>
        </div>
      </main>
    </div>
  )
}
