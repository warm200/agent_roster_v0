import assert from 'node:assert/strict'
import { test } from 'node:test'

import { canOpenRunControlUi, getRunControlUiBlockedReason } from '@/lib/run-control-ui'

test('control ui stays blocked while runtime is running but openclaw is not ready yet', () => {
  assert.equal(
    canOpenRunControlUi({
      resultSummary: 'Managed runtime is restarting for bundle order-test-1. Status will update automatically.',
      runtimeState: 'running',
      status: 'running',
      usesRealWorkspace: true,
    }),
    false,
  )
  assert.match(
    getRunControlUiBlockedReason({
      resultSummary: 'Managed runtime is restarting for bundle order-test-1. Status will update automatically.',
      runtimeState: 'running',
      status: 'running',
    }),
    /still starting/i,
  )
})

test('control ui opens only after ready summary is present on a running runtime', () => {
  assert.equal(
    canOpenRunControlUi({
      resultSummary: 'Managed runtime is ready for bundle order-test-1. Open Control UI to continue.',
      runtimeState: 'running',
      status: 'completed',
      usesRealWorkspace: true,
    }),
    true,
  )
})
