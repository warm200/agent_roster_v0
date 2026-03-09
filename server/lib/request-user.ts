import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { eq } from 'drizzle-orm'

import { HttpError } from '../lib/http'
import { isAuthConfigured } from './auth'
import { createDb, type DbClient } from '../db'
import { users } from '../db/schema'

export const DEFAULT_REQUEST_USER_ID = 'user-1'

let dbClient: DbClient | null = null
let requestUserIdOverride:
  | ((request: NextRequest) => Promise<string> | string)
  | null = null

function getDb() {
  dbClient ??= createDb()
  return dbClient
}

type RequestUserSeed = {
  authProvider?: string
  email?: string | null
  name?: string | null
}

export async function ensureRequestUser(userId: string, seed: RequestUserSeed = {}) {
  const db = getDb()
  const [existing] = await db.select().from(users).where(eq(users.id, userId)).limit(1)

  if (existing) {
    return existing
  }

  const email = seed.email?.trim() || `${userId}@demo.local`
  const name = seed.name?.trim() || (userId === DEFAULT_REQUEST_USER_ID ? 'Demo User' : userId)
  const authProvider = seed.authProvider?.trim() || 'demo'

  const [created] = await db
    .insert(users)
    .values({
      id: userId,
      email,
      name,
      authProvider,
    })
    .onConflictDoNothing()
    .returning()

  if (created) {
    return created
  }

  const [insertedElsewhere] = await db.select().from(users).where(eq(users.id, userId)).limit(1)

  if (!insertedElsewhere) {
    throw new HttpError(500, `Unable to resolve user "${userId}".`)
  }

  return insertedElsewhere
}

export async function getRequestUserId(request: NextRequest) {
  if (requestUserIdOverride) {
    return requestUserIdOverride(request)
  }

  if (isAuthConfigured()) {
    const token = await getToken({
      req: request,
      secret: process.env.AUTH_SECRET,
    })

    if (!token || typeof token.sub !== 'string' || token.sub.trim().length === 0) {
      throw new HttpError(401, 'Authentication required.')
    }

    const userId = token.sub.trim()

    await ensureRequestUser(userId, {
      authProvider: 'oauth',
      email: typeof token.email === 'string' ? token.email : null,
      name: typeof token.name === 'string' ? token.name : null,
    })

    return userId
  }

  const headerUserId = request.headers.get('x-user-id')?.trim()
  const userId = headerUserId || DEFAULT_REQUEST_USER_ID
  await ensureRequestUser(userId, {
    authProvider: headerUserId ? 'header' : 'demo',
  })
  return userId
}

export function setRequestUserIdForTesting(
  resolver: ((request: NextRequest) => Promise<string> | string) | null,
) {
  requestUserIdOverride = resolver
}
