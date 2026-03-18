import { creditTopUpPackSchema } from './schemas'
import type { CreditTopUpPack, CreditTopUpPackId } from './types'

export const CREDIT_TOP_UP_EXPIRY_DAYS = 90

export const CREDIT_TOP_UP_PACKS = [
  {
    id: 'quick_refill',
    name: 'Quick Refill',
    credits: 10,
    priceCents: 599,
    priceLabel: '$5.99',
    expiresInDays: CREDIT_TOP_UP_EXPIRY_DAYS,
    summary: 'Add 10 runtime credits fast.',
  },
  {
    id: 'builder_pack',
    name: 'Builder Pack',
    credits: 25,
    priceCents: 1299,
    priceLabel: '$12.99',
    expiresInDays: CREDIT_TOP_UP_EXPIRY_DAYS,
    summary: 'Extra runway for active build-and-test cycles.',
  },
  {
    id: 'power_pack',
    name: 'Power Pack',
    credits: 60,
    priceCents: 2499,
    priceLabel: '$24.99',
    expiresInDays: CREDIT_TOP_UP_EXPIRY_DAYS,
    summary: 'High-capacity refill for repeated wake and launch use.',
  },
] as const satisfies readonly CreditTopUpPack[]

export function listCreditTopUpPacks() {
  return CREDIT_TOP_UP_PACKS.map((pack) => creditTopUpPackSchema.parse(pack))
}

export function getCreditTopUpPack(packId: CreditTopUpPackId) {
  const pack = CREDIT_TOP_UP_PACKS.find((candidate) => candidate.id === packId)

  if (!pack) {
    throw new Error(`Unknown credit top-up pack: ${packId}`)
  }

  return creditTopUpPackSchema.parse(pack)
}

export function getCreditTopUpExpiresAt(purchasedAt = new Date()) {
  return new Date(purchasedAt.getTime() + CREDIT_TOP_UP_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
}
