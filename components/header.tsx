'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ShoppingCart, User, Menu, Bot, LogIn, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCart } from '@/lib/cart-context'
import { useAuth } from '@/lib/auth-context'
import { getCurrentSubscription } from '@/services/subscription.api'
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet'

const navLinks = [
  { href: '/agents', label: 'Agents' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/app', label: 'Dashboard' },
]

export function Header() {
  const pathname = usePathname()
  const { items } = useCart()
  const { isAuthenticated, session, signOut, status } = useAuth()
  const [remainingCredits, setRemainingCredits] = useState<number | null>(null)
  const cartCount = items.length
  const userName = session?.user?.name || 'Account'
  const userEmail = session?.user?.email || ''
  const initials = userName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const loadSubscription = useCallback(async () => {
    if (!isAuthenticated) {
      setRemainingCredits(null)
      return
    }

    try {
      const payload = await getCurrentSubscription()
      setRemainingCredits(payload.subscription?.remainingCredits ?? payload.plan.includedCredits)
    } catch {
      setRemainingCredits(null)
    }
  }, [isAuthenticated])

  useEffect(() => {
    void loadSubscription()
  }, [loadSubscription])

  useEffect(() => {
    const handleRefresh = () => {
      void loadSubscription()
    }

    window.addEventListener('focus', handleRefresh)
    window.addEventListener('subscription-updated', handleRefresh)

    return () => {
      window.removeEventListener('focus', handleRefresh)
      window.removeEventListener('subscription-updated', handleRefresh)
    }
  }, [loadSubscription])

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="grid h-16 grid-cols-[auto_1fr] items-center md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 text-lg font-semibold md:justify-self-start">
            <div className="w-8 h-8 rounded-lg bg-foreground flex items-center justify-center">
              <Bot className="w-5 h-5 text-background" />
            </div>
            <span className="hidden sm:inline">AgentRoster</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden items-center gap-1 md:flex md:justify-self-center">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'px-4 py-2 text-sm rounded-md transition-colors',
                  pathname === link.href || pathname.startsWith(link.href + '/')
                    ? 'bg-secondary text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Actions */}
          <div className="col-start-2 flex items-center justify-self-end gap-2 md:col-start-3">
            <Button variant="ghost" size="icon" asChild className="relative">
              <Link href="/cart">
                <ShoppingCart className="w-5 h-5" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-foreground text-background text-xs font-medium rounded-full flex items-center justify-center">
                    {cartCount}
                  </span>
                )}
              </Link>
            </Button>

            {status === 'loading' ? (
              <Button disabled size="icon" variant="ghost" className="hidden md:flex">
                <User className="w-5 h-5" />
              </Button>
            ) : isAuthenticated ? (
              <>
                <Button variant="ghost" asChild className="hidden md:flex px-2">
                  <Link href="/app" className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage alt={userName} src={session?.user?.image ?? undefined} />
                      <AvatarFallback>{initials || 'AR'}</AvatarFallback>
                    </Avatar>
                    <span className="max-w-32 truncate text-sm">{userName}</span>
                    {remainingCredits !== null ? (
                      <span className="rounded-full border border-border/70 bg-secondary/80 px-2 py-0.5 text-xs text-muted-foreground">
                        {remainingCredits} cr
                      </span>
                    ) : null}
                  </Link>
                </Button>
                <Button
                  className="hidden md:flex"
                  onClick={() => void signOut()}
                  size="sm"
                  variant="ghost"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </Button>
              </>
            ) : (
              <Button variant="ghost" asChild className="hidden md:flex">
                <Link href="/login">
                  <LogIn className="mr-2 h-4 w-4" />
                  Sign In
                </Link>
              </Button>
            )}

            {/* Mobile menu */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72">
                <nav className="flex flex-col gap-2 mt-8">
                  {navLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={cn(
                        'px-4 py-3 text-sm rounded-md transition-colors',
                        pathname === link.href || pathname.startsWith(link.href + '/')
                          ? 'bg-secondary text-foreground'
                          : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                      )}
                    >
                      {link.label}
                    </Link>
                  ))}
                  {isAuthenticated ? (
                    <div className="mt-4 rounded-lg border border-border bg-secondary/30 p-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage alt={userName} src={session?.user?.image ?? undefined} />
                          <AvatarFallback>{initials || 'AR'}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{userName}</p>
                          {userEmail ? (
                            <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
                          ) : null}
                          {remainingCredits !== null ? (
                            <p className="truncate text-xs text-muted-foreground">{remainingCredits} credits</p>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2">
                        <Link
                          href="/app"
                          className="px-4 py-3 text-sm rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                        >
                          Account
                        </Link>
                        <Button onClick={() => void signOut()} variant="outline">
                          <LogOut className="mr-2 h-4 w-4" />
                          Sign Out
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Link
                      href="/login"
                      className="px-4 py-3 text-sm rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                    >
                      Sign In
                    </Link>
                  )}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  )
}
