import { getToken } from 'next-auth/jwt'
import { NextRequest, NextResponse } from 'next/server'

import { isAuthConfigured } from './auth'

const FORBIDDEN_CSRF_MESSAGE = 'Cross-site request forbidden.'

function getRequestOrigin(request: NextRequest) {
  const originHeader = request.headers.get('origin')?.trim()
  const refererHeader = request.headers.get('referer')?.trim()

  for (const value of [originHeader, refererHeader]) {
    if (!value) {
      continue
    }

    try {
      return new URL(value).origin
    } catch {
      continue
    }
  }

  return null
}

function getExpectedOrigin(request: NextRequest) {
  const forwardedHost = request.headers.get('x-forwarded-host')?.trim()
  const host = request.headers.get('host')?.trim()
  const hostname = forwardedHost || host
  const forwardedProto = request.headers.get('x-forwarded-proto')?.trim()
  const protocol = forwardedProto || request.nextUrl.protocol.replace(/:$/, '')

  if (!hostname || !protocol) {
    return request.nextUrl.origin
  }

  return `${protocol}://${hostname}`
}

export function getAdminAllowedEmails() {
  return (process.env.ADMIN_ALLOWED_EMAILS ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
}

export function verifySameOrigin(request: NextRequest) {
  const origin = getRequestOrigin(request)
  const expectedOrigin = getExpectedOrigin(request)

  if (!origin || origin !== expectedOrigin) {
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
