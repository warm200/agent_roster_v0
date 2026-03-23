import assert from 'node:assert/strict'
import { test } from 'node:test'

import { NextRequest } from 'next/server'

import { PUT as replaceCart } from '@/app/api/cart/route'
import { DELETE as removeCartItem } from '@/app/api/cart/items/[id]/route'
import { POST as addCartItem } from '@/app/api/cart/items/route'

test('cart add route rejects cross-site post', async () => {
  const response = await addCartItem(
    new NextRequest('http://localhost/api/cart/items', {
      body: JSON.stringify({ agentId: 'agent-test-1' }),
      headers: {
        origin: 'https://evil.example',
      },
      method: 'POST',
    }),
  )
  const payload = await response.json()

  assert.equal(response.status, 403)
  assert.equal(payload.error, 'Cross-site request forbidden.')
})

test('cart replace route rejects cross-site put', async () => {
  const response = await replaceCart(
    new NextRequest('http://localhost/api/cart', {
      body: JSON.stringify({ agentIds: ['agent-test-1'] }),
      headers: {
        origin: 'https://evil.example',
      },
      method: 'PUT',
    }),
  )
  const payload = await response.json()

  assert.equal(response.status, 403)
  assert.equal(payload.error, 'Cross-site request forbidden.')
})

test('cart remove route rejects cross-site delete', async () => {
  const response = await removeCartItem(
    new NextRequest('http://localhost/api/cart/items/item-test-1', {
      headers: {
        origin: 'https://evil.example',
      },
      method: 'DELETE',
    }),
    {
      params: Promise.resolve({ id: 'item-test-1' }),
    },
  )
  const payload = await response.json()

  assert.equal(response.status, 403)
  assert.equal(payload.error, 'Cross-site request forbidden.')
})
