import { z } from 'zod'

import {
  AGENT_CATEGORIES,
  AGENT_PROVIDER_KEY_NAMES,
  AGENT_STATUSES,
  AGENT_TIME_FORMATS,
  BILLING_INTERVALS,
  CART_STATUSES,
  CHANNEL_SCOPES,
  CHANNEL_TYPES,
  CREDIT_TOP_UP_PACK_IDS,
  CREDIT_LEDGER_EVENT_TYPES,
  CREDIT_LEDGER_STATUSES,
  CREDIT_LEDGER_UNIT_TYPES,
  LOG_LEVELS,
  MESSAGE_ROLES,
  ORDER_STATUSES,
  PAIRING_STATUSES,
  PERSISTENCE_MODES,
  RISK_LEVELS,
  RUNTIME_INSTANCE_STATES,
  RUNTIME_MODES,
  RUN_TERMINATION_REASONS,
  RUN_STATUSES,
  SUBSCRIPTION_PLAN_IDS,
  SUBSCRIPTION_STATUSES,
  TOKEN_STATUSES,
  TRIGGER_MODES,
} from './constants'

const timestampSchema = z.string().min(1)

export const riskLevelSchema = z.enum(RISK_LEVELS)
export const agentRiskReviewLevelSchema = z.enum(['info', 'medium', 'high'])
export const runStatusSchema = z.enum(RUN_STATUSES)
export const agentTimeFormatSchema = z.enum(AGENT_TIME_FORMATS)
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
export const agentProviderKeyNameSchema = z.enum(AGENT_PROVIDER_KEY_NAMES)
export const subscriptionPlanIdSchema = z.enum(SUBSCRIPTION_PLAN_IDS)
export const creditTopUpPackIdSchema = z.enum(CREDIT_TOP_UP_PACK_IDS)
export const subscriptionStatusSchema = z.enum(SUBSCRIPTION_STATUSES)
export const billingIntervalSchema = z.enum(BILLING_INTERVALS)
export const triggerModeSchema = z.enum(TRIGGER_MODES)
export const runtimeModeSchema = z.enum(RUNTIME_MODES)
export const persistenceModeSchema = z.enum(PERSISTENCE_MODES)
export const runtimeInstanceStateSchema = z.enum(RUNTIME_INSTANCE_STATES)
export const creditLedgerEventTypeSchema = z.enum(CREDIT_LEDGER_EVENT_TYPES)
export const creditLedgerUnitTypeSchema = z.enum(CREDIT_LEDGER_UNIT_TYPES)
export const creditLedgerStatusSchema = z.enum(CREDIT_LEDGER_STATUSES)
export const runTerminationReasonSchema = z.enum(RUN_TERMINATION_REASONS)

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

export const agentRiskCapabilityFlagsSchema = z.object({
  fileWrite: z.boolean(),
  network: z.boolean(),
  secrets: z.boolean(),
  shell: z.boolean(),
})

export const agentRiskFindingSchema = z.object({
  code: z.string().min(1),
  evidenceSnippet: z.string().nullable(),
  filePath: z.string().nullable(),
  riskDriving: z.boolean(),
  severity: z.string().min(1),
  title: z.string().min(1),
})

export const agentRiskReviewSchema = z.object({
  additionalContext: z.array(agentRiskFindingSchema),
  capabilityFlags: agentRiskCapabilityFlagsSchema,
  displayName: z.string().min(1),
  level: agentRiskReviewLevelSchema,
  primaryFindings: z.array(agentRiskFindingSchema),
  summary: z.string().min(1),
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
  thumbnailUrl: z.string().min(1).nullable().optional(),
  category: agentCategorySchema,
  summary: z.string().min(1),
  descriptionMarkdown: z.string(),
  priceCents: z.number().int().nonnegative(),
  currency: z.string().length(3),
  status: agentStatusSchema,
  riskReview: agentRiskReviewSchema.nullable().optional(),
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

export const providerKeyStatusSchema = z.object({
  anthropic: z.boolean(),
  google: z.boolean(),
  openai: z.boolean(),
  openrouter: z.boolean(),
})

export const providerApiKeysUpdateSchema = z.object({
  anthropic: z.string().min(1).max(4096).optional(),
  google: z.string().min(1).max(4096).optional(),
  openai: z.string().min(1).max(4096).optional(),
  openrouter: z.string().min(1).max(4096).optional(),
})

export const agentSetupUpdateSchema = z.object({
  defaultAgentSlug: z.string().min(1).nullable(),
  workspace: z.string().min(1).nullable(),
  timeFormat: agentTimeFormatSchema,
  modelPrimary: z.string().min(1).nullable(),
  modelFallbacks: z.array(z.string().min(1)),
  subagentsMaxConcurrent: z.number().int().positive().max(16).nullable(),
})

export const agentSetupSchema = agentSetupUpdateSchema.extend({
  providerKeyStatus: providerKeyStatusSchema,
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
  agentSetup: agentSetupSchema.nullable().optional(),
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
  runtimeState: runtimeInstanceStateSchema.nullable().optional(),
  persistenceMode: persistenceModeSchema.nullable().optional(),
  preservedStateAvailable: z.boolean().optional(),
  recoverableUntilAt: timestampSchema.nullable().optional(),
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

export const subscriptionPlanSchema = z.object({
  id: subscriptionPlanIdSchema,
  name: z.string().min(1),
  priceLabel: z.string().min(1),
  priceCents: z.number().int().nonnegative(),
  billingInterval: billingIntervalSchema,
  includedCredits: z.number().int().nonnegative(),
  activeBundles: z.number().int().nonnegative(),
  agentsPerBundle: z.number().int().nonnegative(),
  triggerMode: triggerModeSchema,
  concurrentRuns: z.number().int().nonnegative(),
  alwaysOnBundles: z.number().int().nonnegative(),
  runtimeAccess: z.boolean(),
  planIncludes: z.array(z.string().min(1)),
  suitFor: z.string().min(1),
})

export const creditTopUpPackSchema = z.object({
  id: creditTopUpPackIdSchema,
  name: z.string().min(1),
  credits: z.number().int().positive(),
  priceCents: z.number().int().positive(),
  priceLabel: z.string().min(1),
  expiresInDays: z.number().int().positive(),
  summary: z.string().min(1),
})

export const userSubscriptionSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  planId: subscriptionPlanIdSchema,
  planVersion: z.string().min(1),
  status: subscriptionStatusSchema,
  billingInterval: billingIntervalSchema,
  includedCredits: z.number().int().nonnegative(),
  remainingCredits: z.number().int().nonnegative(),
  priceCents: z.number().int().nonnegative(),
  currency: z.string().length(3),
  stripeCustomerId: z.string().nullable(),
  stripePriceId: z.string().nullable(),
  stripeSubscriptionId: z.string().nullable(),
  stripeCheckoutSessionId: z.string().nullable(),
  currentPeriodStart: timestampSchema.nullable(),
  currentPeriodEnd: timestampSchema.nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
})

export const creditLedgerEntrySchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  subscriptionId: z.string().nullable(),
  orderId: z.string().nullable(),
  runId: z.string().nullable(),
  eventType: creditLedgerEventTypeSchema,
  unitType: creditLedgerUnitTypeSchema,
  deltaCredits: z.number().int(),
  resultingBalance: z.number().int().nullable(),
  status: creditLedgerStatusSchema,
  reasonCode: z.string().min(1),
  idempotencyKey: z.string().min(1),
  metadataJson: z.record(z.string(), z.unknown()),
  createdAt: timestampSchema,
})

export const ttlPolicySnapshotSchema = z.object({
  cleanupGraceMinutes: z.number().int().positive().nullable(),
  heartbeatMissingMinutes: z.number().int().positive().nullable(),
  idleTimeoutMinutes: z.number().int().positive().nullable(),
  maxSessionTtlMinutes: z.number().int().positive().nullable(),
  provisioningTimeoutMinutes: z.number().int().positive(),
  triggerMode: triggerModeSchema,
  unhealthyProviderTimeoutMinutes: z.number().int().positive().nullable(),
})

export const runUsageSchema = z.object({
  id: z.string().min(1),
  runId: z.string().min(1),
  userId: z.string().min(1),
  orderId: z.string().min(1),
  planId: subscriptionPlanIdSchema,
  planVersion: z.string().min(1),
  triggerModeSnapshot: triggerModeSchema,
  agentCount: z.number().int().nonnegative(),
  usesRealWorkspace: z.boolean(),
  usesTools: z.boolean(),
  networkEnabled: z.boolean(),
  provisioningStartedAt: timestampSchema.nullable(),
  providerAcceptedAt: timestampSchema.nullable(),
  runningStartedAt: timestampSchema.nullable(),
  lastMeaningfulActivityAt: timestampSchema.nullable(),
  completedAt: timestampSchema.nullable(),
  workspaceReleasedAt: timestampSchema.nullable(),
  terminationReason: runTerminationReasonSchema.nullable(),
  workspaceMinutes: z.number().int().nonnegative().nullable(),
  toolCallsCount: z.number().int().nonnegative().nullable(),
  inputTokensEst: z.number().int().nonnegative().nullable(),
  outputTokensEst: z.number().int().nonnegative().nullable(),
  estimatedInternalCostCents: z.number().int().nonnegative().nullable(),
  statusSnapshot: runStatusSchema,
  ttlPolicySnapshot: ttlPolicySnapshotSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
})

export const runtimeInstanceSchema = z.object({
  id: z.string().min(1),
  runId: z.string().min(1),
  userId: z.string().min(1),
  orderId: z.string().min(1),
  providerName: z.string().min(1),
  providerInstanceRef: z.string().min(1),
  planId: subscriptionPlanIdSchema,
  runtimeMode: runtimeModeSchema,
  persistenceMode: persistenceModeSchema,
  state: runtimeInstanceStateSchema,
  stopReason: runTerminationReasonSchema.nullable(),
  preservedStateAvailable: z.boolean(),
  startedAt: timestampSchema.nullable(),
  stoppedAt: timestampSchema.nullable(),
  archivedAt: timestampSchema.nullable(),
  deletedAt: timestampSchema.nullable(),
  recoverableUntilAt: timestampSchema.nullable(),
  workspaceReleasedAt: timestampSchema.nullable(),
  lastReconciledAt: timestampSchema.nullable(),
  metadataJson: z.record(z.string(), z.unknown()),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
})

export const runtimeIntervalSchema = z.object({
  id: z.string().min(1),
  runtimeInstanceId: z.string().min(1),
  runId: z.string().min(1),
  providerInstanceRef: z.string().min(1),
  startedAt: timestampSchema,
  endedAt: timestampSchema.nullable(),
  closeReason: runTerminationReasonSchema.nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
})

export const launchPolicyUsageSchema = z.object({
  activeBundles: z.number().int().nonnegative(),
  activeRunIds: z.array(z.string().min(1)),
  concurrentRuns: z.number().int().nonnegative(),
})

export const launchPolicyCheckSchema = z.object({
  allowed: z.boolean(),
  blockers: z.array(z.string().min(1)),
  plan: subscriptionPlanSchema,
  subscription: userSubscriptionSchema.nullable(),
  usage: launchPolicyUsageSchema,
})

export const checkoutSessionSchema = z.object({
  sessionId: z.string().min(1),
  sessionUrl: z.string().min(1),
})

export const subscriptionCheckoutSessionSchema = checkoutSessionSchema.extend({
  planId: subscriptionPlanIdSchema,
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

export const scanAgentVersionRequestSchema = z.object({
  version: agentVersionSchema,
})

export const validateTelegramTokenRequestSchema = z.object({
  botToken: z.string().min(1),
})

export const previewInterviewRequestSchema = z.object({
  agentId: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  messages: z.array(previewMessageSchema).min(1),
})

export const updateOrderAgentSetupRequestSchema = z.object({
  agentSetup: agentSetupUpdateSchema,
  vendorApiKeys: providerApiKeysUpdateSchema.optional(),
})

export const createSubscriptionCheckoutSessionRequestSchema = z.object({
  planId: subscriptionPlanIdSchema,
  returnPath: z.string().min(1).optional(),
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
export type AgentSetupInput = z.infer<typeof agentSetupSchema>
export type RunChannelConfigInput = z.infer<typeof runChannelConfigSchema>
export type RunInput = z.infer<typeof runSchema>
