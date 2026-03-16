import { desc, eq } from 'drizzle-orm'

import { createDb, type DbClient } from '../db'
import { launchAttempts } from '../db/schema'

let dbClient: DbClient | null = null

function getDb() {
  dbClient ??= createDb()
  return dbClient
}

export class LaunchAttemptRepository {
  async createLaunchAttempt(input: typeof launchAttempts.$inferInsert) {
    const db = getDb()
    const [created] = await db.insert(launchAttempts).values(input).returning()
    return created ?? null
  }

  async updateLaunchAttempt(id: string, input: Partial<typeof launchAttempts.$inferInsert>) {
    const db = getDb()
    const [updated] = await db
      .update(launchAttempts)
      .set(input)
      .where(eq(launchAttempts.id, id))
      .returning()

    return updated ?? null
  }

  async listLaunchAttempts() {
    const db = getDb()
    return db.select().from(launchAttempts).orderBy(desc(launchAttempts.attemptedAt))
  }
}
