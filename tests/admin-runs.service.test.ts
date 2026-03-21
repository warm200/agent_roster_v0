import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'

import { getAdminRunsPage } from '@/server/services/admin-runs.service'

const originalForceFallback = process.env.ADMIN_USAGE_FORCE_FALLBACK

before(() => {
  process.env.ADMIN_USAGE_FORCE_FALLBACK = '1'
})

after(() => {
  if (originalForceFallback === undefined) {
    delete process.env.ADMIN_USAGE_FORCE_FALLBACK
  } else {
    process.env.ADMIN_USAGE_FORCE_FALLBACK = originalForceFallback
  }
})

test('getAdminRunsPage returns staged paginated rows when fallback is forced', async () => {
  const page = await getAdminRunsPage()

  assert.equal(page.page, 1)
  assert.equal(page.pageSize, 20)
  assert.equal(page.totalRuns, 4)
  assert.equal(page.totalPages, 1)
  assert.equal(page.rows.length, 4)
  assert.equal(page.rows[0]?.id, 'run-4418')
})

test('getAdminRunsPage filters staged rows by run, user, and provider refs', async () => {
  const filteredByRun = await getAdminRunsPage({ query: 'run-4415' })
  const filteredByUser = await getAdminRunsPage({ query: 'ava' })
  const filteredByProvider = await getAdminRunsPage({ query: 'run-4398' })

  assert.equal(filteredByRun.totalRuns, 1)
  assert.equal(filteredByRun.rows[0]?.id, 'run-4415')
  assert.equal(filteredByUser.totalRuns, 2)
  assert.deepEqual(
    filteredByUser.rows.map((row) => row.id),
    ['run-4418', 'run-4398'],
  )
  assert.equal(filteredByProvider.totalRuns, 1)
  assert.equal(filteredByProvider.rows[0]?.providerInstanceRef, 'run-4398')
})
