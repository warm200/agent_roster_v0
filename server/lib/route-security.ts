import { getToken } from 'next-auth/jwt'
import { NextRequest, NextResponse } from 'next/server'

import { isAuthConfigured } from './auth'

const FORBIDDEN_CSRF_MESSAGE = 'Cross-site request forbidden.'

export function getAdminAllowedEmails() {
  return (process.env.ADMIN_ALLOWED_EMAILS ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
}

export function verifySameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin')?.trim()

  if (!origin || origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: FORBIDDEN_CSRF_MESSAGE }, { status: 403 })
  }

  return null
}

export async function requireAdminApiRequest(request: NextRequest) {
  if (!isAuthConfigured()) {
    return NextResponse.json(
      { error: 'Not found.' },
      { headers: { 'cache-control': 'no-store' }, status: 404 },
    )
  }

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
  })
  const tokenEmail = typeof token?.email === 'string' ? token.email.toLowerCase() : ''
  const allowedEmails = getAdminAllowedEmails()

  if (!token || allowedEmails.length === 0 || !allowedEmails.includes(tokenEmail)) {
    return NextResponse.json(
      { error: 'Not found.' },
      { headers: { 'cache-control': 'no-store' }, status: 404 },
    )
  }

  return null
}
