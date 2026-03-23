import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

import { isAuthConfigured } from '@/server/lib/auth'
import { getAdminAllowedEmails } from '@/server/lib/route-security'

function rewriteAdminToNotFound(request: NextRequest) {
  const response = NextResponse.rewrite(new URL('/_not-found', request.url))
  response.headers.set('cache-control', 'no-store')
  return response
}

export async function proxy(request: NextRequest) {
  const isAdminRoute =
    request.nextUrl.pathname.startsWith('/admin') ||
    request.nextUrl.pathname.startsWith('/api/admin')

  if (!isAuthConfigured()) {
    if (isAdminRoute) {
      return rewriteAdminToNotFound(request)
    }

    return NextResponse.next()
  }

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
  })

  if (token) {
    if (isAdminRoute) {
      const allowedEmails = getAdminAllowedEmails()
      const tokenEmail = typeof token.email === 'string' ? token.email.toLowerCase() : ''

      if (allowedEmails.length === 0 || !allowedEmails.includes(tokenEmail)) {
        return rewriteAdminToNotFound(request)
      }
    }

    return NextResponse.next()
  }

  if (isAdminRoute) {
    return rewriteAdminToNotFound(request)
  }

  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('callbackUrl', `${request.nextUrl.pathname}${request.nextUrl.search}`)

  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/app/:path*', '/admin/:path*', '/api/admin/:path*'],
}
