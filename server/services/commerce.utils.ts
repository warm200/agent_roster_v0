import type { InferSelectModel } from 'drizzle-orm'

import {
  agentSchema,
  agentVersionSchema,
  cartItemSchema,
  cartSchema,
  orderItemSchema,
  orderSchema,
  runChannelConfigSchema,
} from '@/lib/schemas'
import type {
  Agent,
  AgentVersion,
  BundleRisk,
  Cart,
  CartItem,
  Order,
  OrderItem,
  RiskLevel,
  RunChannelConfig,
} from '@/lib/types'

import {
  agents,
  agentVersions,
  cartItems,
  carts,
  orderItems,
  orders,
  riskProfiles,
  runChannelConfigs,
} from '../db/schema'

const riskRank: Record<RiskLevel, number> = {
  low: 1,
  medium: 2,
  high: 3,
}

type AgentRecord = InferSelectModel<typeof agents>
type AgentVersionRecord = InferSelectModel<typeof agentVersions>
type RiskProfileRecord = InferSelectModel<typeof riskProfiles>
type CartRecord = InferSelectModel<typeof carts>
type CartItemRecord = InferSelectModel<typeof cartItems>
type OrderRecord = InferSelectModel<typeof orders>
type OrderItemRecord = InferSelectModel<typeof orderItems>
type RunChannelConfigRecord = InferSelectModel<typeof runChannelConfigs>

export type SaleRow = {
  agent: AgentRecord
  riskProfile: RiskProfileRecord
  version: AgentVersionRecord
}

export type CartItemRow = SaleRow & {
  cart: CartRecord
  cartItem: CartItemRecord
}

export type OrderItemRow = SaleRow & {
  orderItem: OrderItemRecord
}

export function combineRiskLevels(levels: RiskLevel[]): RiskLevel {
  if (levels.length === 0) {
    return 'low'
  }

  return levels.slice(1).reduce<RiskLevel>((highest, current) => {
    return riskRank[current] > riskRank[highest] ? current : highest
  }, levels[0])
}

export function buildBundleRisk(input: {
  highestRiskDriver: string | null
  level: RiskLevel
  summary: string
}): BundleRisk {
  return {
    level: input.level,
    highestRiskDriver: input.highestRiskDriver,
    summary: input.summary,
  }
}

export function buildAgentVersionSnapshot(row: SaleRow): AgentVersion {
  return agentVersionSchema.parse({
    id: row.version.id,
    agentId: row.version.agentId,
    version: row.version.version,
    changelogMarkdown: row.version.changelogMarkdown,
    previewPromptSnapshot: row.version.previewPromptSnapshot,
    runConfigSnapshot: row.version.runConfigSnapshot,
    installPackageUrl: row.version.installPackageUrl,
    installScriptMarkdown: row.version.installScriptMarkdown,
    releaseNotes: row.version.releaseNotes,
    riskProfile: {
      id: row.riskProfile.id,
      agentVersionId: row.riskProfile.agentVersionId,
      chatOnly: row.riskProfile.chatOnly,
      readFiles: row.riskProfile.readFiles,
      writeFiles: row.riskProfile.writeFiles,
      network: row.riskProfile.network,
      shell: row.riskProfile.shell,
      riskLevel: row.riskProfile.riskLevel,
      scanSummary: row.riskProfile.scanSummary,
      createdAt: row.riskProfile.createdAt.toISOString(),
    },
    createdAt: row.version.createdAt.toISOString(),
  })
}

export function buildAgentSnapshot(row: SaleRow): Agent {
  const currentVersion = buildAgentVersionSnapshot(row)

  return agentSchema.parse({
    id: row.agent.id,
    slug: row.agent.slug,
    title: row.agent.title,
    category: row.agent.category,
    summary: row.agent.summary,
    descriptionMarkdown: row.agent.descriptionMarkdown,
    priceCents: row.agent.priceCents,
    currency: row.agent.currency,
    status: row.agent.status,
    currentVersion,
    createdAt: row.agent.createdAt.toISOString(),
    updatedAt: row.agent.updatedAt.toISOString(),
  })
}

export function buildCartSnapshot(cart: CartRecord, rows: CartItemRow[]): Cart {
  const items = rows.map(buildCartItemSnapshot) as CartItem[]

  return cartSchema.parse({
    id: cart.id,
    userId: cart.userId,
    status: cart.status,
    items,
    bundleRisk: buildBundleRisk({
      level: cart.bundleRiskLevel,
      highestRiskDriver: cart.highestRiskDriver,
      summary: cart.bundleRiskSummary,
    }),
    totalCents: cart.totalCents,
    currency: cart.currency,
    createdAt: cart.createdAt.toISOString(),
    updatedAt: cart.updatedAt.toISOString(),
  })
}

export function buildRunChannelConfigSnapshot(
  config: RunChannelConfigRecord,
): RunChannelConfig {
  return runChannelConfigSchema.parse({
    id: config.id,
    orderId: config.orderId,
    channelType: config.channelType,
    botTokenSecretRef: config.botTokenSecretRef,
    tokenStatus: config.tokenStatus,
    recipientBindingStatus: config.recipientBindingStatus,
    recipientExternalId: config.recipientExternalId,
    appliesToScope: config.appliesToScope,
    createdAt: config.createdAt.toISOString(),
    updatedAt: config.updatedAt.toISOString(),
  })
}

export function buildCartItemSnapshot(row: CartItemRow): CartItem {
  return cartItemSchema.parse({
    id: row.cartItem.id,
    cartId: row.cartItem.cartId,
    agent: buildAgentSnapshot(row),
    agentVersion: buildAgentVersionSnapshot(row),
    createdAt: row.cartItem.createdAt.toISOString(),
  })
}

export function buildOrderSnapshot(input: {
  items: OrderItemRow[]
  order: OrderRecord
  runChannelConfig: RunChannelConfigRecord | null
}): Order {
  const items = input.items.map((row) =>
    orderItemSchema.parse({
      id: row.orderItem.id,
      orderId: row.orderItem.orderId,
      agent: buildAgentSnapshot(row),
      agentVersion: buildAgentVersionSnapshot(row),
      priceCents: row.orderItem.priceCents,
      createdAt: row.orderItem.createdAt.toISOString(),
    }),
  ) as OrderItem[]

  return orderSchema.parse({
    id: input.order.id,
    userId: input.order.userId,
    cartId: input.order.cartId,
    paymentProvider: input.order.paymentProvider,
    paymentReference: input.order.paymentReference,
    amountCents: input.order.amountCents,
    currency: input.order.currency,
    status: input.order.status,
    items,
    channelConfig: input.runChannelConfig
      ? buildRunChannelConfigSnapshot(input.runChannelConfig)
      : null,
    bundleRisk: buildBundleRisk({
      level: input.order.bundleRiskLevel,
      highestRiskDriver: input.order.highestRiskDriver,
      summary: input.order.bundleRiskSummary,
    }),
    createdAt: input.order.createdAt.toISOString(),
    updatedAt: input.order.updatedAt.toISOString(),
    paidAt: input.order.paidAt?.toISOString() ?? null,
  })
}
