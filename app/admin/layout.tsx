import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Internal Usage Console',
  robots: {
    follow: false,
    index: false,
  },
}

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return children
}
