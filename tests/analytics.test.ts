import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildAttributionEventParams,
  buildAttributionTouch,
  mergeStoredAttribution,
} from '@/lib/analytics'

test('buildAttributionTouch returns null when no UTM params exist', () => {
  const touch = buildAttributionTouch({
    searchParams: new URLSearchParams('foo=bar'),
    pathname: '/agents',
  })

  assert.equal(touch, null)
})

test('buildAttributionTouch maps UTM params into a touch record', () => {
  const touch = buildAttributionTouch({
    searchParams: new URLSearchParams('utm_source=twitter&utm_medium=social&utm_campaign=spring'),
    pathname: '/',
    referrer: 'https://x.com/openroster',
    recordedAt: '2026-03-24T10:00:00.000Z',
  })

  assert.deepEqual(touch, {
    source: 'twitter',
    medium: 'social',
    campaign: 'spring',
    content: null,
    term: null,
    landingPath: '/',
    referrer: 'https://x.com/openroster',
    recordedAt: '2026-03-24T10:00:00.000Z',
  })
})

test('mergeStoredAttribution preserves first touch and replaces last touch', () => {
  const firstTouch = {
    source: 'twitter',
    medium: 'social',
    campaign: 'launch',
    content: null,
    term: null,
    landingPath: '/',
    referrer: null,
    recordedAt: '2026-03-24T10:00:00.000Z',
  }
  const lastTouch = {
    source: 'newsletter',
    medium: 'email',
    campaign: 'follow-up',
    content: 'cta-a',
    term: null,
    landingPath: '/pricing',
    referrer: 'https://mail.google.com',
    recordedAt: '2026-03-24T12:00:00.000Z',
  }

  const merged = mergeStoredAttribution({ firstTouch, lastTouch: firstTouch }, lastTouch)

  assert.deepEqual(merged, {
    firstTouch,
    lastTouch,
  })
})

test('buildAttributionEventParams flattens first and last touch fields', () => {
  const params = buildAttributionEventParams({
    firstTouch: {
      source: 'twitter',
      medium: 'social',
      campaign: 'launch',
      content: null,
      term: null,
      landingPath: '/',
      referrer: null,
      recordedAt: '2026-03-24T10:00:00.000Z',
    },
    lastTouch: {
      source: 'bitly',
      medium: 'shortlink',
      campaign: 'pricing-push',
      content: 'footer',
      term: null,
      landingPath: '/pricing',
      referrer: 'https://bit.ly/example',
      recordedAt: '2026-03-24T12:00:00.000Z',
    },
  })

  assert.deepEqual(params, {
    first_utm_source: 'twitter',
    first_utm_medium: 'social',
    first_utm_campaign: 'launch',
    first_utm_content: undefined,
    first_utm_term: undefined,
    first_landing_path: '/',
    last_utm_source: 'bitly',
    last_utm_medium: 'shortlink',
    last_utm_campaign: 'pricing-push',
    last_utm_content: 'footer',
    last_utm_term: undefined,
    last_landing_path: '/pricing',
  })
})
