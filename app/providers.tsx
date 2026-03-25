'use client'

import { Suspense } from 'react'
import { CartProvider } from '@/lib/cart-context'
import { AuthProvider } from '@/lib/auth-context'
import { GoogleAnalytics } from '@/components/google-analytics'
import { Toaster } from '@/components/ui/sonner'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <CartProvider>
        <Suspense fallback={null}>
          <GoogleAnalytics />
        </Suspense>
        {children}
        <Toaster />
      </CartProvider>
    </AuthProvider>
  )
}
