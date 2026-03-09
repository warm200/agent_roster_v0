// AgentRoster - Shared Types

// Risk levels
export type RiskLevel = 'low' | 'medium' | 'high'

// Run statuses
export type RunStatus = 'provisioning' | 'running' | 'completed' | 'failed'

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
