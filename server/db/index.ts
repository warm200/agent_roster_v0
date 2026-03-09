import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

import { HttpError } from '../lib/http'
import * as schema from './schema'

export function createPool(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    throw new HttpError(503, 'DATABASE_URL is required.')
  }

  let protocol: string

  try {
    protocol = new URL(connectionString).protocol.toLowerCase()
  } catch {
    throw new HttpError(503, 'DATABASE_URL must be a valid PostgreSQL connection string.')
  }

  if (protocol !== 'postgres:' && protocol !== 'postgresql:') {
    throw new HttpError(
      503,
      `DATABASE_URL must use PostgreSQL (postgres:// or postgresql://). Received ${protocol}.`,
    )
  }

  return new Pool({ connectionString })
}

export function createDb(connectionString = process.env.DATABASE_URL) {
  return drizzle(createPool(connectionString), { schema })
}

export type DbClient = ReturnType<typeof createDb>
