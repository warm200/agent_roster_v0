import assert from 'node:assert/strict'
import test from 'node:test'

import { formatPlanIncludedCreditsLabel, getSubscriptionPlan } from '@/lib/subscription-plans'

test('formatPlanIncludedCreditsLabel uses the shared plan catalog values', () => {
  assert.equal(formatPlanIncludedCreditsLabel(getSubscriptionPlan('run')), 'Includes 8 runtime credits.')
  assert.equal(
    formatPlanIncludedCreditsLabel(getSubscriptionPlan('warm_standby')),
    'Includes 24 runtime credits per month.',
  )
  assert.equal(
    formatPlanIncludedCreditsLabel(getSubscriptionPlan('always_on')),
    'Includes 100 runtime credits per month.',
  )
  assert.equal(formatPlanIncludedCreditsLabel(getSubscriptionPlan('free')), 'No managed runtime.')
})
