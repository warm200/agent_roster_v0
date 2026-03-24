import assert from 'node:assert/strict'
import { test } from 'node:test'

import { NextRequest } from 'next/server'

import { verifySameOrigin } from '@/server/lib/route-security'

test('verifySameOrigin accepts forwarded https origin behind a proxy', () => {
  const result = verifySameOrigin(
    new NextRequest('http://app:3000/api/cart', {
      headers: {
        host: 'app:3000',
        origin: 'https://openroster.ai',
        'x-forwarded-host': 'openroster.ai',
        'x-forwarded-proto': 'https',
      },
      method: 'PUT',
    }),
  )

  assert.equal(result, null)
})

test('verifySameOrigin falls back to same-origin referer when origin is absent', async () => {
  const result = verifySameOrigin(
    new NextRequest('http://app:3000/api/cart', {
      headers: {
        host: 'app:3000',
        referer: 'https://openroster.ai/app',
        'x-forwarded-host': 'openroster.ai',
        'x-forwarded-proto': 'https',
      },
      method: 'PUT',
    }),
  )

  assert.equal(result, null)
})

test('verifySameOrigin still rejects cross-site origins behind a proxy', async () => {
  const result = verifySameOrigin(
    new NextRequest('http://app:3000/api/cart', {
      headers: {
        host: 'app:3000',
        origin: 'https://evil.example',
        'x-forwarded-host': 'openroster.ai',
        'x-forwarded-proto': 'https',
      },
      method: 'PUT',
    }),
  )

  assert.ok(result)
  assert.equal(result.status, 403)
})
