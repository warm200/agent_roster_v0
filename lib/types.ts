// AgentRoster - Shared Types

// Risk levels
export type RiskLevel = 'low' | 'medium' | 'high'

// Run statuses
export type RunStatus = 'provisioning' | 'running' | 'completed' | 'failed'
export type AgentTimeFormat = 'auto' | '12' | '24'
export type AgentProviderKeyName = 'anthropic' | 'google' | 'openai' | 'openrouter'
export type SubscriptionPlanId = 'free' | 'run' | 'warm_standby' | 'always_on'
export type SubscriptionStatus = 'active' | 'canceled' | 'expired' | 'past_due'
export type BillingInterval = 'none' | 'one_time' | 'month'
export type TriggerMode = 'none' | 'manual' | 'auto_wake' | 'always_active'
export type CreditLedgerEventType =
  | 'grant'
  | 'reset'
  | 'reserve'
  | 'commit'
  | 'refund'
  | 'adjust'
  | 'expire'
  | 'shadow_usage_estimate'
export type CreditLedgerUnitType =
  | 'launch_credit'
  | 'wake_credit'
  | 'always_on_budget'
  | 'fair_use_adjustment'
export type CreditLedgerStatus = 'pending' | 'committed' | 'reversed'
export type RunTerminationReason =
  | 'ttl_expired'
  | 'idle_timeout'
  | 'provisioning_timeout'
  | 'manual_stop'
  | 'provider_unhealthy'
  | 'provider_rejected'
  | 'provider_error'

// Order statuses
export type OrderStatus = 'pending' | 'paid' | 'failed' | 'refunded'

// Token/Pairing statuses
export type TokenStatus = 'pending' | 'validated' | 'failed'
export type PairingStatus = 'pending' | 'paired' | 'failed'

// Agent categories
export type AgentCategory = 'inbox' | 'calendar' | 'docs' | 'automation' | 'analytics'

// Agent status
export type AgentStatus = 'draft' | 'active' | 'archived'

// Risk Profile
export interface RiskProfile {
  id: string
  agentVersionId: string
  chatOnly: boolean
  readFiles: boolean
  writeFiles: boolean
  network: boolean
  shell: boolean
  riskLevel: RiskLevel
  scanSummary: string
  createdAt: string
}

// Agent Version
export interface AgentVersion {
  id: string
  agentId: string
  version: string
  changelogMarkdown: string
  previewPromptSnapshot: string
  runConfigSnapshot: string
  installPackageUrl: string
  installScriptMarkdown: string
  releaseNotes: string
  riskProfile: RiskProfile
  createdAt: string
}

// Agent
export interface Agent {
  id: string
  slug: string
  title: string
  thumbnailUrl?: string | null
  category: AgentCategory
  summary: string
  descriptionMarkdown: string
  priceCents: number
  currency: string
  status: AgentStatus
  currentVersion: AgentVersion
  createdAt: string
  updatedAt: string
}

// Cart Item
export interface CartItem {
  id: string
  cartId: string
  agent: Agent
  agentVersion: AgentVersion
  createdAt: string
}

// Bundle Risk (aggregated)
export interface BundleRisk {
  level: RiskLevel
  highestRiskDriver: string | null
  summary: string
}

// Cart
export interface Cart {
  id: string
  userId: string | null
  status: 'active' | 'converted' | 'abandoned'
  items: CartItem[]
  bundleRisk: BundleRisk
  totalCents: number
  currency: string
  createdAt: string
  updatedAt: string
}

// Order Item
export interface OrderItem {
  id: string
  orderId: string
  agent: Agent
  agentVersion: AgentVersion
  priceCents: number
  createdAt: string
}

// Run Channel Config
export interface RunChannelConfig {
  id: string
  orderId: string
  channelType: 'telegram'
  botTokenSecretRef: string | null
  tokenStatus: TokenStatus
  recipientBindingStatus: PairingStatus
  recipientExternalId: string | null
  appliesToScope: 'run'
  createdAt: string
  updatedAt: string
}

export interface AgentSetup {
  defaultAgentSlug: string | null
  workspace: string | null
  timeFormat: AgentTimeFormat
  modelPrimary: string | null
  modelFallbacks: string[]
  subagentsMaxConcurrent: number | null
  providerKeyStatus: Record<AgentProviderKeyName, boolean>
}

// Order
export interface Order {
  id: string
  userId: string
  cartId: string
  paymentProvider: string
  paymentReference: string | null
  amountCents: number
  currency: string
  status: OrderStatus
  items: OrderItem[]
  channelConfig: RunChannelConfig | null
  agentSetup?: AgentSetup | null
  bundleRisk: BundleRisk
  createdAt: string
  updatedAt: string
  paidAt: string | null
}

// Run Log
export interface RunLog {
  timestamp: string
  level: 'info' | 'warn' | 'error' | 'debug'
  step: string
  message: string
}

// Run Artifact
export interface RunArtifact {
  id: string
  name: string
  type: string
  size: number
  downloadUrl: string
}

// Run Result
export interface RunResult {
  summary: string
  artifacts: RunArtifact[]
}

// Run
export interface Run {
  id: string
  userId: string
  orderId: string
  channelConfigId: string
  status: RunStatus
  combinedRiskLevel: RiskLevel
  usesRealWorkspace: boolean
  usesTools: boolean
  networkEnabled: boolean
  resultSummary: string | null
  resultArtifacts: RunArtifact[]
  createdAt: string
  startedAt: string | null
  updatedAt: string
  completedAt: string | null
}

// Preview Chat Message
export interface PreviewMessage {
  role: 'user' | 'assistant'
  content: string
}

// User
export interface User {
  id: string
  email: string
  name: string
  authProvider: string
  createdAt: string
  updatedAt: string
}

export interface SubscriptionPlan {
  id: SubscriptionPlanId
  name: string
  priceLabel: string
  priceCents: number
  billingInterval: BillingInterval
  includedCredits: number
  activeBundles: number
  agentsPerBundle: number
  triggerMode: TriggerMode
  concurrentRuns: number
  alwaysOnBundles: number
  runtimeAccess: boolean
  planIncludes: string[]
  suitFor: string
}

export interface UserSubscription {
  id: string
  userId: string
  planId: SubscriptionPlanId
  planVersion: string
  status: SubscriptionStatus
  billingInterval: BillingInterval
  includedCredits: number
  remainingCredits: number
  priceCents: number
  currency: string
  stripeCustomerId: string | null
  stripePriceId: string | null
  stripeSubscriptionId: string | null
  stripeCheckoutSessionId: string | null
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  createdAt: string
  updatedAt: string
}

export interface CreditLedgerEntry {
  id: string
  userId: string
  subscriptionId: string | null
  orderId: string | null
  runId: string | null
  eventType: CreditLedgerEventType
  unitType: CreditLedgerUnitType
  deltaCredits: number
  resultingBalance: number | null
  status: CreditLedgerStatus
  reasonCode: string
  idempotencyKey: string
  metadataJson: Record<string, unknown>
  createdAt: string
}

export interface RunUsage {
  id: string
  runId: string
  userId: string
  orderId: string
  planId: SubscriptionPlanId
  planVersion: string
  triggerModeSnapshot: TriggerMode
  agentCount: number
  usesRealWorkspace: boolean
  usesTools: boolean
  networkEnabled: boolean
  provisioningStartedAt: string | null
  providerAcceptedAt: string | null
  runningStartedAt: string | null
  completedAt: string | null
  workspaceReleasedAt: string | null
  terminationReason: RunTerminationReason | null
  workspaceMinutes: number | null
  toolCallsCount: number | null
  inputTokensEst: number | null
  outputTokensEst: number | null
  estimatedInternalCostCents: number | null
  statusSnapshot: RunStatus
  ttlPolicySnapshot: {
    cleanupGraceMinutes: number | null
    heartbeatMissingMinutes: number | null
    idleTimeoutMinutes: number | null
    maxSessionTtlMinutes: number | null
    provisioningTimeoutMinutes: number
    triggerMode: TriggerMode
    unhealthyProviderTimeoutMinutes: number | null
  }
  createdAt: string
  updatedAt: string
}

export interface LaunchPolicyUsage {
  activeBundles: number
  activeRunIds: string[]
  concurrentRuns: number
}

export interface LaunchPolicyCheck {
  allowed: boolean
  blockers: string[]
  plan: SubscriptionPlan
  subscription: UserSubscription | null
  usage: LaunchPolicyUsage
}

// API Response types
export interface ApiResponse<T> {
  data: T
  error?: string
}

// Checkout Session
export interface CheckoutSession {
  sessionId: string
  sessionUrl: string
}

export interface SubscriptionCheckoutSession extends CheckoutSession {
  planId: SubscriptionPlanId
}
