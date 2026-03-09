import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

import * as schema from './schema'

export function createPool(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    throw new Error('DATABASE_URL is required')
  }

  return new Pool({ connectionString })
}

export function createDb(connectionString = process.env.DATABASE_URL) {
  return drizzle(createPool(connectionString), { schema })
}

export type DbClient = ReturnType<typeof createDb>
