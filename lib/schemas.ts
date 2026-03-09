import { z } from 'zod'

import {
  AGENT_CATEGORIES,
  AGENT_STATUSES,
  CART_STATUSES,
  CHANNEL_SCOPES,
  CHANNEL_TYPES,
  LOG_LEVELS,
  MESSAGE_ROLES,
  ORDER_STATUSES,
  PAIRING_STATUSES,
  RISK_LEVELS,
  RUN_STATUSES,
  TOKEN_STATUSES,
} from './constants'

const timestampSchema = z.string().min(1)

export const riskLevelSchema = z.enum(RISK_LEVELS)
export const runStatusSchema = z.enum(RUN_STATUSES)
export const orderStatusSchema = z.enum(ORDER_STATUSES)
export const tokenStatusSchema = z.enum(TOKEN_STATUSES)
export const pairingStatusSchema = z.enum(PAIRING_STATUSES)
export const agentCategorySchema = z.enum(AGENT_CATEGORIES)
export const agentStatusSchema = z.enum(AGENT_STATUSES)
export const cartStatusSchema = z.enum(CART_STATUSES)
export const channelTypeSchema = z.enum(CHANNEL_TYPES)
export const channelScopeSchema = z.enum(CHANNEL_SCOPES)
export const logLevelSchema = z.enum(LOG_LEVELS)
export const messageRoleSchema = z.enum(MESSAGE_ROLES)

export const riskProfileSchema = z.object({
  id: z.string().min(1),
  agentVersionId: z.string().min(1),
  chatOnly: z.boolean(),
  readFiles: z.boolean(),
  writeFiles: z.boolean(),
  network: z.boolean(),
  shell: z.boolean(),
  riskLevel: riskLevelSchema,
  scanSummary: z.string().min(1),
  createdAt: timestampSchema,
})

export const agentVersionSchema = z.object({
  id: z.string().min(1),
  agentId: z.string().min(1),
  version: z.string().min(1),
  changelogMarkdown: z.string(),
  previewPromptSnapshot: z.string(),
  runConfigSnapshot: z.string(),
  installPackageUrl: z.string().min(1),
  installScriptMarkdown: z.string(),
  releaseNotes: z.string(),
  riskProfile: riskProfileSchema,
  createdAt: timestampSchema,
})

export const agentSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  category: agentCategorySchema,
  summary: z.string().min(1),
  descriptionMarkdown: z.string(),
  priceCents: z.number().int().nonnegative(),
  currency: z.string().length(3),
  status: agentStatusSchema,
  currentVersion: agentVersionSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
})

export const bundleRiskSchema = z.object({
  level: riskLevelSchema,
  highestRiskDriver: z.string().nullable(),
  summary: z.string().min(1),
})

export const cartItemSchema = z.object({
  id: z.string().min(1),
  cartId: z.string().min(1),
  agent: agentSchema,
  agentVersion: agentVersionSchema,
  createdAt: timestampSchema,
})

export const cartSchema = z.object({
  id: z.string().min(1),
  userId: z.string().nullable(),
  status: cartStatusSchema,
  items: z.array(cartItemSchema),
  bundleRisk: bundleRiskSchema,
  totalCents: z.number().int().nonnegative(),
  currency: z.string().length(3),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
})

export const orderItemSchema = z.object({
  id: z.string().min(1),
  orderId: z.string().min(1),
  agent: agentSchema,
  agentVersion: agentVersionSchema,
  priceCents: z.number().int().nonnegative(),
  createdAt: timestampSchema,
})

export const runChannelConfigSchema = z.object({
  id: z.string().min(1),
  orderId: z.string().min(1),
  channelType: channelTypeSchema,
  botTokenSecretRef: z.string().nullable(),
  tokenStatus: tokenStatusSchema,
  recipientBindingStatus: pairingStatusSchema,
  recipientExternalId: z.string().nullable(),
  appliesToScope: channelScopeSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
})

export const orderSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  cartId: z.string().min(1),
  paymentProvider: z.string().min(1),
  paymentReference: z.string().nullable(),
  amountCents: z.number().int().nonnegative(),
  currency: z.string().length(3),
  status: orderStatusSchema,
  items: z.array(orderItemSchema),
  channelConfig: runChannelConfigSchema.nullable(),
  bundleRisk: bundleRiskSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  paidAt: timestampSchema.nullable(),
})

export const runArtifactSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.string().min(1),
  size: z.number().int().nonnegative(),
  downloadUrl: z.string().min(1),
})

export const runResultSchema = z.object({
  summary: z.string().min(1),
  artifacts: z.array(runArtifactSchema),
})

export const runLogSchema = z.object({
  timestamp: timestampSchema,
  level: logLevelSchema,
  step: z.string().min(1),
  message: z.string().min(1),
})

export const runSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  orderId: z.string().min(1),
  channelConfigId: z.string().min(1),
  status: runStatusSchema,
  combinedRiskLevel: riskLevelSchema,
  usesRealWorkspace: z.boolean(),
  usesTools: z.boolean(),
  networkEnabled: z.boolean(),
  resultSummary: z.string().nullable(),
  resultArtifacts: z.array(runArtifactSchema),
  createdAt: timestampSchema,
  startedAt: timestampSchema.nullable(),
  updatedAt: timestampSchema,
  completedAt: timestampSchema.nullable(),
})

export const previewMessageSchema = z.object({
  role: messageRoleSchema,
  content: z.string().min(1),
})

export const userSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1),
  authProvider: z.string().min(1),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
})

export const checkoutSessionSchema = z.object({
  sessionId: z.string().min(1),
  sessionUrl: z.string().min(1),
})

export const addCartItemRequestSchema = z.object({
  agentId: z.string().min(1),
})

export const syncCartRequestSchema = z.object({
  agentIds: z.array(z.string().min(1)),
})

export const createRunRequestSchema = z.object({
  orderId: z.string().min(1),
})

export const validateTelegramTokenRequestSchema = z.object({
  botToken: z.string().min(1),
})

export const previewInterviewRequestSchema = z.object({
  agentId: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  messages: z.array(previewMessageSchema).min(1),
})

export const apiErrorSchema = z.object({
  error: z.string().min(1),
})

export const apiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: dataSchema,
    error: z.string().optional(),
  })

export type RiskProfileInput = z.infer<typeof riskProfileSchema>
export type AgentVersionInput = z.infer<typeof agentVersionSchema>
export type AgentInput = z.infer<typeof agentSchema>
export type CartInput = z.infer<typeof cartSchema>
export type OrderInput = z.infer<typeof orderSchema>
export type RunChannelConfigInput = z.infer<typeof runChannelConfigSchema>
export type RunInput = z.infer<typeof runSchema>
