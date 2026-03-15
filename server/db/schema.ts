import { type InferInsertModel, type InferSelectModel } from 'drizzle-orm'
import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

export const riskLevelEnum = pgEnum('risk_level', ['low', 'medium', 'high'])
export const runStatusEnum = pgEnum('run_status', ['provisioning', 'running', 'completed', 'failed'])
export const orderStatusEnum = pgEnum('order_status', ['pending', 'paid', 'failed', 'refunded'])
export const tokenStatusEnum = pgEnum('token_status', ['pending', 'validated', 'failed'])
export const pairingStatusEnum = pgEnum('pairing_status', ['pending', 'paired', 'failed'])
export const agentCategoryEnum = pgEnum('agent_category', ['inbox', 'calendar', 'docs', 'automation', 'analytics'])
export const agentStatusEnum = pgEnum('agent_status', ['draft', 'active', 'archived'])
export const cartStatusEnum = pgEnum('cart_status', ['active', 'converted', 'abandoned'])
export const channelTypeEnum = pgEnum('channel_type', ['telegram'])
export const channelScopeEnum = pgEnum('channel_scope', ['run'])
export const subscriptionPlanIdEnum = pgEnum('subscription_plan_id', [
  'free',
  'run',
  'warm_standby',
  'always_on',
])
export const subscriptionStatusEnum = pgEnum('subscription_status', ['active', 'canceled', 'past_due'])
export const billingIntervalEnum = pgEnum('billing_interval', ['none', 'one_time', 'month'])

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    name: text('name').notNull(),
    authProvider: text('auth_provider').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    emailIdx: uniqueIndex('users_email_idx').on(table.email),
  }),
)

export const accounts = pgTable(
  'accounts',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refreshToken: text('refresh_token'),
    accessToken: text('access_token'),
    expiresAt: integer('expires_at'),
    tokenType: text('token_type'),
    scope: text('scope'),
    idToken: text('id_token'),
    sessionState: text('session_state'),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.provider, table.providerAccountId] }),
  }),
)

export const sessions = pgTable('sessions', {
  sessionToken: text('session_token').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { withTimezone: true }).notNull(),
})

export const verificationTokens = pgTable(
  'verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { withTimezone: true }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.identifier, table.token] }),
  }),
)

export const agents = pgTable(
  'agents',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    category: agentCategoryEnum('category').notNull(),
    summary: text('summary').notNull(),
    descriptionMarkdown: text('description_markdown').notNull(),
    priceCents: integer('price_cents').notNull(),
    currency: text('currency').notNull(),
    status: agentStatusEnum('status').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    slugIdx: uniqueIndex('agents_slug_idx').on(table.slug),
  }),
)

export const agentVersions = pgTable('agent_versions', {
  id: text('id').primaryKey(),
  agentId: text('agent_id')
    .notNull()
    .references(() => agents.id, { onDelete: 'cascade' }),
  version: text('version').notNull(),
  changelogMarkdown: text('changelog_markdown').notNull(),
  previewPromptSnapshot: text('preview_prompt_snapshot').notNull(),
  runConfigSnapshot: text('run_config_snapshot').notNull(),
  installPackageUrl: text('install_package_url').notNull(),
  installScriptMarkdown: text('install_script_markdown').notNull(),
  releaseNotes: text('release_notes').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const riskProfiles = pgTable(
  'risk_profiles',
  {
    id: text('id').primaryKey(),
    agentVersionId: text('agent_version_id')
      .notNull()
      .references(() => agentVersions.id, { onDelete: 'cascade' }),
    chatOnly: boolean('chat_only').notNull(),
    readFiles: boolean('read_files').notNull(),
    writeFiles: boolean('write_files').notNull(),
    network: boolean('network').notNull(),
    shell: boolean('shell').notNull(),
    riskLevel: riskLevelEnum('risk_level').notNull(),
    scanSummary: text('scan_summary').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    agentVersionIdx: uniqueIndex('risk_profiles_agent_version_idx').on(table.agentVersionId),
  }),
)

export const carts = pgTable('carts', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  status: cartStatusEnum('status').notNull(),
  bundleRiskLevel: riskLevelEnum('bundle_risk_level').notNull(),
  highestRiskDriver: text('highest_risk_driver'),
  bundleRiskSummary: text('bundle_risk_summary').notNull(),
  totalCents: integer('total_cents').notNull(),
  currency: text('currency').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const cartItems = pgTable('cart_items', {
  id: text('id').primaryKey(),
  cartId: text('cart_id')
    .notNull()
    .references(() => carts.id, { onDelete: 'cascade' }),
  agentId: text('agent_id')
    .notNull()
    .references(() => agents.id, { onDelete: 'restrict' }),
  agentVersionId: text('agent_version_id')
    .notNull()
    .references(() => agentVersions.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const orders = pgTable('orders', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  cartId: text('cart_id')
    .notNull()
    .references(() => carts.id, { onDelete: 'restrict' }),
  paymentProvider: text('payment_provider').notNull(),
  paymentReference: text('payment_reference'),
  amountCents: integer('amount_cents').notNull(),
  currency: text('currency').notNull(),
  status: orderStatusEnum('status').notNull(),
  agentSetup: jsonb('agent_setup').$type<Record<string, unknown> | null>(),
  bundleRiskLevel: riskLevelEnum('bundle_risk_level').notNull(),
  highestRiskDriver: text('highest_risk_driver'),
  bundleRiskSummary: text('bundle_risk_summary').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  paidAt: timestamp('paid_at', { withTimezone: true }),
})

export const userSubscriptions = pgTable(
  'user_subscriptions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    planId: subscriptionPlanIdEnum('plan_id').notNull(),
    status: subscriptionStatusEnum('status').notNull(),
    billingInterval: billingIntervalEnum('billing_interval').notNull(),
    includedCredits: integer('included_credits').notNull(),
    remainingCredits: integer('remaining_credits').notNull(),
    priceCents: integer('price_cents').notNull(),
    currency: text('currency').notNull(),
    stripeCustomerId: text('stripe_customer_id'),
    stripePriceId: text('stripe_price_id'),
    stripeSubscriptionId: text('stripe_subscription_id'),
    stripeCheckoutSessionId: text('stripe_checkout_session_id'),
    currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdx: uniqueIndex('user_subscriptions_user_idx').on(table.userId),
  }),
)

export const creditLedger = pgTable('credit_ledger', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  subscriptionId: text('subscription_id').references(() => userSubscriptions.id, {
    onDelete: 'set null',
  }),
  deltaCredits: integer('delta_credits').notNull(),
  balanceAfter: integer('balance_after').notNull(),
  reason: text('reason').notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const orderItems = pgTable('order_items', {
  id: text('id').primaryKey(),
  orderId: text('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  agentId: text('agent_id')
    .notNull()
    .references(() => agents.id, { onDelete: 'restrict' }),
  agentVersionId: text('agent_version_id')
    .notNull()
    .references(() => agentVersions.id, { onDelete: 'restrict' }),
  priceCents: integer('price_cents').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const runChannelConfigs = pgTable(
  'run_channel_configs',
  {
    id: text('id').primaryKey(),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    channelType: channelTypeEnum('channel_type').notNull(),
    botTokenSecretRef: text('bot_token_secret_ref'),
    tokenStatus: tokenStatusEnum('token_status').notNull(),
    recipientBindingStatus: pairingStatusEnum('recipient_binding_status').notNull(),
    recipientExternalId: text('recipient_external_id'),
    appliesToScope: channelScopeEnum('applies_to_scope').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orderIdx: uniqueIndex('run_channel_configs_order_idx').on(table.orderId),
  }),
)

export const runs = pgTable('runs', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  orderId: text('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  channelConfigId: text('channel_config_id')
    .notNull()
    .references(() => runChannelConfigs.id, { onDelete: 'restrict' }),
  status: runStatusEnum('status').notNull(),
  combinedRiskLevel: riskLevelEnum('combined_risk_level').notNull(),
  usesRealWorkspace: boolean('uses_real_workspace').notNull(),
  usesTools: boolean('uses_tools').notNull(),
  networkEnabled: boolean('network_enabled').notNull(),
  resultSummary: text('result_summary'),
  resultArtifacts: jsonb('result_artifacts').$type<Array<Record<string, unknown>>>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
})

export type DbUser = InferSelectModel<typeof users>
export type NewDbUser = InferInsertModel<typeof users>
export type DbAgent = InferSelectModel<typeof agents>
export type NewDbAgent = InferInsertModel<typeof agents>
export type DbAgentVersion = InferSelectModel<typeof agentVersions>
export type NewDbAgentVersion = InferInsertModel<typeof agentVersions>
export type DbRiskProfile = InferSelectModel<typeof riskProfiles>
export type NewDbRiskProfile = InferInsertModel<typeof riskProfiles>
export type DbCart = InferSelectModel<typeof carts>
export type NewDbCart = InferInsertModel<typeof carts>
export type DbOrder = InferSelectModel<typeof orders>
export type NewDbOrder = InferInsertModel<typeof orders>
export type DbUserSubscription = InferSelectModel<typeof userSubscriptions>
export type NewDbUserSubscription = InferInsertModel<typeof userSubscriptions>
export type DbCreditLedgerEntry = InferSelectModel<typeof creditLedger>
export type NewDbCreditLedgerEntry = InferInsertModel<typeof creditLedger>
export type DbRunChannelConfig = InferSelectModel<typeof runChannelConfigs>
export type NewDbRunChannelConfig = InferInsertModel<typeof runChannelConfigs>
export type DbRun = InferSelectModel<typeof runs>
export type NewDbRun = InferInsertModel<typeof runs>
