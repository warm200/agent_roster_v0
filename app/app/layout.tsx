'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Bot, LayoutDashboard, Package, Play, LogIn, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAuth } from '@/lib/auth-context'

const sidebarLinks = [
  { href: '/app', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/app/bundles', label: 'My Bundles', icon: Package },
  { href: '/app/runs', label: 'Runs', icon: Play },
]

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const { isAuthenticated, session, signOut } = useAuth()
  const userName = session?.user?.name || 'Guest Session'
  const userEmail = session?.user?.email || 'Configure OAuth to enforce login'
  const initials = userName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-border bg-sidebar">
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <div className="w-8 h-8 rounded-lg bg-sidebar-foreground flex items-center justify-center">
              <Bot className="w-5 h-5 text-sidebar" />
            </div>
            <span>OpenRoster</span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1">
          {sidebarLinks.map((link) => {
            const isActive = pathname === link.href ||
              (link.href !== '/app' && pathname.startsWith(link.href))
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-colors',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                )}
              >
                <link.icon className="w-4 h-4" />
                {link.label}
              </Link>
            )
          })}
        </nav>

        {/* User */}
        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-3 py-2">
            <Avatar className="h-8 w-8">
              <AvatarImage alt={userName} src={session?.user?.image ?? undefined} />
              <AvatarFallback>{initials || 'AR'}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{userName}</p>
              <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
            </div>
          </div>
          <div className="mt-3 px-3">
            {isAuthenticated ? (
              <Button className="w-full justify-start" onClick={() => void signOut()} variant="ghost">
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            ) : (
              <Button asChild className="w-full justify-start" variant="ghost">
                <Link href="/login">
                  <LogIn className="mr-2 h-4 w-4" />
                  Sign In
                </Link>
              </Button>
            )}
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top bar (mobile) */}
        <header className="lg:hidden h-16 flex items-center justify-between px-4 border-b border-border">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <div className="w-8 h-8 rounded-lg bg-foreground flex items-center justify-center">
              <Bot className="w-5 h-5 text-background" />
            </div>
            <span>OpenRoster</span>
          </Link>
          <nav className="flex items-center gap-1">
            {sidebarLinks.map((link) => (
              <Button
                key={link.href}
                variant="ghost"
                size="icon"
                asChild
                className={cn(
                  pathname === link.href || (link.href !== '/app' && pathname.startsWith(link.href))
                    ? 'bg-secondary'
                    : ''
                )}
              >
                <Link href={link.href}>
                  <link.icon className="w-5 h-5" />
                </Link>
              </Button>
            ))}
          </nav>
        </header>

        {/* Content */}
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  )
}
