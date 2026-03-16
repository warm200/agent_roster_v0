import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

import { isAuthConfigured } from '@/server/lib/auth'

function getAdminAllowlist() {
  return (process.env.ADMIN_ALLOWED_EMAILS ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
}

export async function proxy(request: NextRequest) {
  const isAdminRoute = request.nextUrl.pathname.startsWith('/admin')

  if (!isAuthConfigured()) {
    if (isAdminRoute) {
      return NextResponse.json(
        { error: 'Admin console requires configured OAuth.' },
        {
          headers: {
            'cache-control': 'no-store',
          },
          status: 503,
        },
      )
    }

    return NextResponse.next()
  }

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
  })

  if (token) {
    if (isAdminRoute) {
      const allowedEmails = getAdminAllowlist()
      const tokenEmail = typeof token.email === 'string' ? token.email.toLowerCase() : ''

      if (allowedEmails.length > 0 && !allowedEmails.includes(tokenEmail)) {
        return NextResponse.json(
          { error: 'Forbidden' },
          {
            headers: {
              'cache-control': 'no-store',
            },
            status: 403,
          },
        )
      }
    }

    return NextResponse.next()
  }

  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('callbackUrl', `${request.nextUrl.pathname}${request.nextUrl.search}`)

  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/app/:path*', '/admin/:path*'],
}
