import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { ChunkReloadGuard } from '@/components/chunk-reload-guard'
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

export const metadata: Metadata = {
  title: 'OpenRoster.ai - Personal Ops Agents Marketplace',
  description: 'Discover, purchase, and run trusted Personal Ops AI agents. Browse agents for Inbox, Calendar, and Docs workflows.',
  generator: 'OpenRoster',
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

  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <Providers>
          <ChunkReloadGuard />
          {children}
        </Providers>
        {enableVercelAnalytics ? <Analytics /> : null}
      </body>
    </html>
  )
}
