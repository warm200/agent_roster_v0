import assert from 'node:assert/strict'
import test from 'node:test'

import { getRunStatusDisplay } from '@/lib/run-status-display'

test('run status display prefers stopped runtime state over completed status', () => {
  const display = getRunStatusDisplay('completed', 'stopped')

  assert.equal(display.key, 'stopped')
  assert.equal(display.label, 'Stopped')
})

test('run status display exposes archived and released lifecycle labels', () => {
  assert.equal(getRunStatusDisplay('completed', 'archived').label, 'Archived')
  assert.equal(getRunStatusDisplay('completed', 'deleted').label, 'Released')
})
