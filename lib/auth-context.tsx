'use client'

import { createContext, useContext } from 'react'
import type { Session } from 'next-auth'
import { SessionProvider, signIn as nextAuthSignIn, signOut as nextAuthSignOut, useSession } from 'next-auth/react'

type AuthContextValue = {
  isAuthenticated: boolean
  session: Session | null
  status: 'authenticated' | 'loading' | 'unauthenticated'
  signIn: (providerId?: string, callbackUrl?: string) => Promise<void>
  signOut: (callbackUrl?: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function AuthContextInner({ children }: { children: React.ReactNode }) {
  const { data, status } = useSession()

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: status === 'authenticated',
        session: data ?? null,
        status,
        async signIn(providerId, callbackUrl = '/app') {
          await nextAuthSignIn(providerId, { callbackUrl })
        },
        async signOut(callbackUrl = '/') {
          await nextAuthSignOut({ callbackUrl })
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus={false}>
      <AuthContextInner>{children}</AuthContextInner>
    </SessionProvider>
  )
}

export function useAuth() {
  const value = useContext(AuthContext)

  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider')
  }

  return value
}
