import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import Script from 'next/script'
import { ChunkReloadGuard } from '@/components/chunk-reload-guard'
import { buildGoogleAnalyticsInlineScript } from '@/lib/google-analytics'
import './globals.css'
import { Providers } from './providers'

const inter = Inter({
  subsets: ["latin"],
  variable: '--font-inter',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: '--font-mono',
})

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://openroster.ai'

export const metadata: Metadata = {
  title: 'OpenRoster.ai - Personal Ops Agents Marketplace',
  description: 'Compose agent bundles that run like a real workspace. Preview behavior before you buy. Transparent risk labels. Telegram handoff. No mystery permissions.',
  generator: 'OpenRoster',
  metadataBase: new URL(siteUrl),
  openGraph: {
    type: 'website',
    siteName: 'OpenRoster',
    title: 'OpenRoster — Compose bundles, not one-off tools',
    description: 'Build focused agent bundles that run like a real workspace. Preview before you buy. Risk labels upfront. Telegram handoff built in.',
    url: siteUrl,
    images: [
      {
        url: `${siteUrl}/og-image.png`,
        width: 1200,
        height: 630,
        alt: 'OpenRoster — Personal Ops Agent Bundles',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OpenRoster — Compose bundles, not one-off tools',
    description: 'Agent bundles that run like a real workspace. Preview behavior first. Risk labels upfront. No mystery permissions.',
    images: [`${siteUrl}/og-image.png`],
  },
  icons: {
    apple: '/logo.png',
    icon: [
      { url: '/logo.png', media: '(prefers-color-scheme: light)' },
      { url: '/logo-light.png', media: '(prefers-color-scheme: dark)' },
    ],
    shortcut: '/logo.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#171717',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const enableVercelAnalytics = process.env.VERCEL === '1'
  const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || null

  return (
    <html lang="en" className="dark">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@graph': [
                {
                  '@type': 'Organization',
                  name: 'OpenRoster',
                  url: 'https://openroster.ai',
                  logo: 'https://openroster.ai/logo.png',
                  description: 'Managed-agent marketplace and runtime platform for personal ops workflows.',
                  sameAs: ['https://github.com/OpenRoster-ai/awesome-agents'],
                },
                {
                  '@type': 'SoftwareApplication',
                  name: 'OpenRoster',
                  url: 'https://openroster.ai',
                  applicationCategory: 'BusinessApplication',
                  operatingSystem: 'Web',
                  description: 'Compose agent bundles that run like a real workspace. Preview before you buy. Transparent risk labels. Telegram handoff built in.',
                  offers: {
                    '@type': 'Offer',
                    price: '0',
                    priceCurrency: 'USD',
                    description: 'Free to browse and collect agents. Pay only for managed runtime.',
                  },
                },
              ],
            }),
          }}
        />
        {gaMeasurementId ? (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaMeasurementId)}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {buildGoogleAnalyticsInlineScript(gaMeasurementId)}
            </Script>
          </>
        ) : null}
      </head>
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <Providers gaMeasurementId={gaMeasurementId}>
          <ChunkReloadGuard />
          {children}
        </Providers>
        {enableVercelAnalytics ? <Analytics /> : null}
      </body>
    </html>
  )
}
