import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createPool } from '@/server/db'
import { HttpError } from '@/server/lib/http'

test('createPool rejects non-postgres database urls with a clear message', () => {
  assert.throws(
    () => createPool('mysql+mysqlconnector://user:pass@example.com:3306/app'),
    (error: unknown) => {
      assert.ok(error instanceof HttpError)
      assert.equal(error.status, 503)
      assert.match(
        error.message,
        /DATABASE_URL must use PostgreSQL \(postgres:\/\/ or postgresql:\/\/\)/,
      )
      return true
    },
  )
})

test('createPool accepts postgres database urls', async () => {
  const pool = createPool('postgres://user:pass@localhost:5432/app')
  await pool.end()
})
