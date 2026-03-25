'use client'

import type { Agent, Order } from '@/lib/types'

const ATTRIBUTION_STORAGE_KEY = 'openroster:analytics:attribution:v1'
const EVENT_STORAGE_KEY_PREFIX = 'openroster:analytics:event:'

export type AttributionTouch = {
  source: string | null
  medium: string | null
  campaign: string | null
  content: string | null
  term: string | null
  landingPath: string
  referrer: string | null
  recordedAt: string
}

export type StoredAttribution = {
  firstTouch: AttributionTouch | null
  lastTouch: AttributionTouch | null
}

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
    __openRosterGaMeasurementId?: string
  }
}

function canUseBrowserStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function hasAttributionValues(searchParams: URLSearchParams) {
  return ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].some((key) =>
    searchParams.get(key),
  )
}

export function buildAttributionTouch(input: {
  searchParams: URLSearchParams
  pathname: string
  referrer?: string | null
  recordedAt?: string
}): AttributionTouch | null {
  if (!hasAttributionValues(input.searchParams)) {
    return null
  }

  return {
    source: input.searchParams.get('utm_source'),
    medium: input.searchParams.get('utm_medium'),
    campaign: input.searchParams.get('utm_campaign'),
    content: input.searchParams.get('utm_content'),
    term: input.searchParams.get('utm_term'),
    landingPath: input.pathname,
    referrer: input.referrer ?? null,
    recordedAt: input.recordedAt ?? new Date().toISOString(),
  }
}

export function mergeStoredAttribution(
  existing: StoredAttribution | null,
  touch: AttributionTouch,
): StoredAttribution {
  return {
    firstTouch: existing?.firstTouch ?? touch,
    lastTouch: touch,
  }
}

export function readStoredAttribution(): StoredAttribution | null {
  if (!canUseBrowserStorage()) {
    return null
  }

  try {
    const raw = window.localStorage.getItem(ATTRIBUTION_STORAGE_KEY)

    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as StoredAttribution
    return parsed ?? null
  } catch {
    return null
  }
}

export function persistAttributionFromLocation(searchParams: URLSearchParams, pathname: string) {
  const touch = buildAttributionTouch({
    searchParams,
    pathname,
    referrer: typeof document !== 'undefined' ? document.referrer || null : null,
  })

  if (!touch || !canUseBrowserStorage()) {
    return null
  }

  const next = mergeStoredAttribution(readStoredAttribution(), touch)
  window.localStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(next))
  return next
}

export function buildAttributionEventParams(stored: StoredAttribution | null) {
  return {
    first_utm_source: stored?.firstTouch?.source ?? undefined,
    first_utm_medium: stored?.firstTouch?.medium ?? undefined,
    first_utm_campaign: stored?.firstTouch?.campaign ?? undefined,
    first_utm_content: stored?.firstTouch?.content ?? undefined,
    first_utm_term: stored?.firstTouch?.term ?? undefined,
    first_landing_path: stored?.firstTouch?.landingPath ?? undefined,
    last_utm_source: stored?.lastTouch?.source ?? undefined,
    last_utm_medium: stored?.lastTouch?.medium ?? undefined,
    last_utm_campaign: stored?.lastTouch?.campaign ?? undefined,
    last_utm_content: stored?.lastTouch?.content ?? undefined,
    last_utm_term: stored?.lastTouch?.term ?? undefined,
    last_landing_path: stored?.lastTouch?.landingPath ?? undefined,
  }
}

function markEventSeen(storageKey: string) {
  if (!canUseBrowserStorage()) {
    return false
  }

  if (window.localStorage.getItem(storageKey)) {
    return false
  }

  window.localStorage.setItem(storageKey, new Date().toISOString())
  return true
}

export function ensureAnalyticsBootstrap(measurementId: string) {
  if (typeof window === 'undefined' || !measurementId) {
    return
  }

  if (!window.dataLayer) {
    window.dataLayer = []
  }

  if (typeof window.gtag !== 'function') {
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer?.push(args)
    }
  }

  if (window.__openRosterGaMeasurementId === measurementId) {
    return
  }

  window.__openRosterGaMeasurementId = measurementId

  window.gtag('js', new Date())
  window.gtag('config', measurementId, { send_page_view: false })
}

export function loadGoogleAnalyticsScript(measurementId: string) {
  if (typeof document === 'undefined' || !measurementId) {
    return
  }

  if (document.querySelector(`script[data-openroster-ga="${measurementId}"]`)) {
    return
  }

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`
  script.dataset.openrosterGa = measurementId
  document.head.appendChild(script)
}

export function trackEvent(name: string, params: Record<string, string | number | boolean | undefined> = {}) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') {
    return
  }

  window.gtag('event', name, {
    ...buildAttributionEventParams(readStoredAttribution()),
    ...params,
  })
}

export function trackPageView(path: string) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') {
    return
  }

  window.gtag('event', 'page_view', {
    page_location: window.location.href,
    page_path: path,
    page_title: document.title,
    ...buildAttributionEventParams(readStoredAttribution()),
  })
}

export function trackSignupOnce(identity: string) {
  if (!identity) {
    return
  }

  const storageKey = `${EVENT_STORAGE_KEY_PREFIX}sign_up:${identity}`
  if (!markEventSeen(storageKey)) {
    return
  }

  trackEvent('sign_up', { method: 'oauth' })
}

export function trackFirstCollectionOnce(agent: Pick<Agent, 'id' | 'slug' | 'title' | 'category'>) {
  const storageKey = `${EVENT_STORAGE_KEY_PREFIX}first_collection`
  if (!markEventSeen(storageKey)) {
    return
  }

  trackEvent('first_collection', {
    agent_id: agent.id,
    agent_slug: agent.slug,
    agent_title: agent.title,
    agent_category: agent.category,
    collection_size: 1,
  })
}

export function trackTelegramConnectionOnce(input: { orderId: string; botUsername?: string | null }) {
  const storageKey = `${EVENT_STORAGE_KEY_PREFIX}telegram_connection:${input.orderId}`
  if (!markEventSeen(storageKey)) {
    return
  }

  trackEvent('telegram_connection', {
    order_id: input.orderId,
    bot_username: input.botUsername ?? undefined,
  })
}

export function trackPurchaseOnce(order: Pick<Order, 'id' | 'amountCents' | 'currency' | 'items'>) {
  const storageKey = `${EVENT_STORAGE_KEY_PREFIX}purchase:${order.id}`
  if (!markEventSeen(storageKey)) {
    return
  }

  trackEvent('purchase', {
    transaction_id: order.id,
    value: Number((order.amountCents / 100).toFixed(2)),
    currency: order.currency,
    item_count: order.items.length,
  })
}
