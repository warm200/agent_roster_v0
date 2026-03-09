import { eq } from 'drizzle-orm'

import { createDb, type DbClient } from '../db'
import { users } from '../db/schema'

export const DEFAULT_REQUEST_USER_ID = 'user-1'

let dbClient: DbClient | null = null

function getDb() {
  dbClient ??= createDb()
  return dbClient
}

export async function ensureRequestUser(userId: string) {
  const db = getDb()
  const [existing] = await db.select().from(users).where(eq(users.id, userId)).limit(1)

  if (existing) {
    return existing
  }

  const email = `${userId}@demo.local`

  const [created] = await db
    .insert(users)
    .values({
      id: userId,
      email,
      name: userId === DEFAULT_REQUEST_USER_ID ? 'Demo User' : userId,
      authProvider: 'demo',
    })
    .returning()

  return created
}

export async function getRequestUserId(request: Request) {
  const headerUserId = request.headers.get('x-user-id')?.trim()
  const userId = headerUserId || DEFAULT_REQUEST_USER_ID
  await ensureRequestUser(userId)
  return userId
}
