import Link from 'next/link'
import type { Metadata } from 'next'

import { Header } from '@/components/header'

export const metadata: Metadata = {
  title: 'Privacy Policy - OpenRoster',
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="container mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-10">Effective date: March 22, 2026</p>

        <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none space-y-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-8 [&_h2]:mb-3 [&_p]:text-muted-foreground [&_li]:text-muted-foreground [&_ul]:list-disc [&_ul]:pl-5">

          <section>
            <h2>1. Overview</h2>
            <p>
              This Privacy Policy describes how OpenRoster (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) collects, uses, and handles your information when you use the OpenRoster platform (&quot;the Platform&quot;). By using the Platform, you agree to the practices described in this policy.
            </p>
          </section>

          <section>
            <h2>2. Information We Collect</h2>

            <p><strong>Account information</strong></p>
            <p>
              When you sign in via GitHub or Google OAuth, we receive and store your name, email address, and authentication provider identifier. We do not store your OAuth provider password.
            </p>

            <p><strong>Order and subscription data</strong></p>
            <p>
              We store records of your agent purchases, bundle configurations, subscription plan, credit balance, and payment references. Payment processing is handled entirely by Stripe; we do not store credit card numbers or full payment details.
            </p>

            <p><strong>Runtime and run data</strong></p>
            <p>
              When you launch Runs, we record run metadata including status, duration, resource usage estimates, and sanitized logs. Run outputs and artifacts generated within sandbox environments are stored temporarily and made available for download.
            </p>

            <p><strong>Telegram channel data</strong></p>
            <p>
              If you connect a Telegram bot, we store an encrypted reference to the bot token and the paired recipient chat ID. Bot tokens are encrypted at rest using AES-256-GCM.
            </p>

            <p><strong>API keys you provide</strong></p>
            <p>
              If you provide third-party API keys for Agent configuration (e.g., OpenAI, Anthropic), these are encrypted at rest using AES-256-GCM and stored only as encrypted references. We do not access or use your API keys for any purpose other than configuring your Agents.
            </p>

            <p><strong>Client-side storage</strong></p>
            <p>
              We use browser localStorage to store your shopping cart contents. We use cookies for session management (authentication) and UI preferences (sidebar state). We do not use third-party tracking cookies.
            </p>
          </section>

          <section>
            <h2>3. How We Use Your Information</h2>
            <p>We use collected information to:</p>
            <ul>
              <li>Authenticate you and maintain your session</li>
              <li>Process purchases and manage your subscription</li>
              <li>Provision and manage sandbox runtime environments</li>
              <li>Configure and launch Agents on your behalf</li>
              <li>Display run status, logs, and results</li>
              <li>Monitor platform health and usage (aggregate, internal metrics only)</li>
            </ul>
          </section>

          <section>
            <h2>4. Third-Party Services</h2>
            <p>The Platform shares data with the following categories of third-party services:</p>
            <ul>
              <li><strong>Authentication providers</strong> (GitHub, Google) &mdash; to verify your identity during sign-in</li>
              <li><strong>Payment processor</strong> (Stripe) &mdash; to process payments and manage subscriptions</li>
              <li><strong>Messaging platform</strong> (Telegram) &mdash; to deliver Agent interactions to your connected bot</li>
              <li><strong>Runtime infrastructure providers</strong> &mdash; to provision and manage sandbox environments where Agents execute</li>
              <li><strong>AI model providers</strong> &mdash; to power Agent preview conversations and runtime execution</li>
              <li><strong>Analytics</strong> (Vercel Analytics) &mdash; to collect anonymous, aggregate usage metrics</li>
            </ul>
            <p>
              Each third-party service operates under its own privacy policy. We encourage you to review their policies.
            </p>
          </section>

          <section>
            <h2>5. Your Data in Sandbox Environments</h2>
            <p>
              <strong>You bear full responsibility for any data you send to, process within, or receive from sandbox environments.</strong> This includes but is not limited to:
            </p>
            <ul>
              <li>Prompts, instructions, and files you provide to Agents</li>
              <li>Data generated, modified, or accessed by Agents during Runs</li>
              <li>Third-party API keys or credentials entered for Agent configuration</li>
              <li>Any personal, financial, or sensitive data you introduce into a sandbox</li>
            </ul>
            <p>
              Sandbox environments are managed by third-party infrastructure providers. While we employ reasonable security measures, <strong>we are not responsible for any data loss, data exposure, unauthorized access, or financial loss</strong> that may occur within or as a result of sandbox usage. You should not introduce data into the Platform that you are not prepared to lose or have exposed.
            </p>
          </section>

          <section>
            <h2>6. Data Security</h2>
            <p>
              We implement reasonable security measures to protect your information, including:
            </p>
            <ul>
              <li>AES-256-GCM encryption for sensitive stored credentials (bot tokens, API keys)</li>
              <li>HTTPS for all data in transit</li>
              <li>HMAC-signed, time-limited download links for run artifacts</li>
              <li>Webhook signature verification for incoming third-party events</li>
            </ul>
            <p>
              Despite these measures, no method of electronic transmission or storage is fully secure. We cannot guarantee absolute security of your data.
            </p>
          </section>

          <section>
            <h2>7. Data Retention</h2>
            <p>
              We retain your account data for as long as your account is active. Run data (logs, artifacts, results) may be retained for a limited period after a Run completes and may be automatically cleaned up. Subscription and payment records are retained as required for accounting and legal purposes.
            </p>
          </section>

          <section>
            <h2>8. Your Rights</h2>
            <p>
              You may request access to, correction of, or deletion of your personal data by contacting us. Please note that deletion of your account may not immediately remove all data from backup systems, and certain records may be retained as required by law.
            </p>
          </section>

          <section>
            <h2>9. Children&apos;s Privacy</h2>
            <p>
              The Platform is not intended for use by anyone under the age of 18. We do not knowingly collect personal information from children. If you believe a child has provided us with personal information, please contact us and we will take steps to delete it.
            </p>
          </section>

          <section>
            <h2>10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. Changes take effect upon posting to the Platform. Your continued use of the Platform after changes constitutes acceptance of the revised policy.
            </p>
          </section>

          <section>
            <h2>11. Contact</h2>
            <p>
              Questions about this Privacy Policy may be directed to <a href="mailto:support@openroster.ai" className="underline hover:text-foreground">support@openroster.ai</a> or through our <Link href="/contact">contact page</Link>.
            </p>
          </section>
        </div>

        <div className="mt-12 border-t border-border pt-6 text-sm text-muted-foreground">
          <Link href="/terms" className="underline hover:text-foreground">Terms of Service</Link>
        </div>
      </main>
    </div>
  )
}
