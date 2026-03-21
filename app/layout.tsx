import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Providers } from './providers'
import './globals.css'

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
    apple: '/favicon.png',
    icon: '/favicon.svg',
    shortcut: '/favicon.png',
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
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <Providers>
          {children}
        </Providers>
        <Analytics />
      </body>
    </html>
  )
}
