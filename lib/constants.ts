export const RISK_LEVELS = ['low', 'medium', 'high'] as const
export const RUN_STATUSES = ['provisioning', 'running', 'completed', 'failed'] as const
export const AGENT_TIME_FORMATS = ['auto', '12', '24'] as const
export const TERMINAL_RUN_STATUSES = ['completed', 'failed'] as const
export const ORDER_STATUSES = ['pending', 'paid', 'failed', 'refunded'] as const
export const TOKEN_STATUSES = ['pending', 'validated', 'failed'] as const
export const PAIRING_STATUSES = ['pending', 'paired', 'failed'] as const
export const AGENT_CATEGORIES = ['inbox', 'calendar', 'docs', 'automation', 'analytics'] as const
export const AGENT_STATUSES = ['draft', 'active', 'archived'] as const
export const CART_STATUSES = ['active', 'converted', 'abandoned'] as const
export const CHANNEL_TYPES = ['telegram'] as const
export const CHANNEL_SCOPES = ['run'] as const
export const LOG_LEVELS = ['info', 'warn', 'error', 'debug'] as const
export const MESSAGE_ROLES = ['user', 'assistant'] as const
export const AGENT_PROVIDER_KEY_NAMES = ['anthropic', 'google', 'openai', 'openrouter'] as const
export const SUBSCRIPTION_PLAN_IDS = ['free', 'run', 'warm_standby', 'always_on'] as const
export const SUBSCRIPTION_STATUSES = ['active', 'canceled', 'expired', 'past_due'] as const
export const BILLING_INTERVALS = ['none', 'one_time', 'month'] as const
export const TRIGGER_MODES = ['none', 'manual', 'auto_wake', 'always_active'] as const
export const CREDIT_LEDGER_EVENT_TYPES = [
  'grant',
  'reset',
  'reserve',
  'commit',
  'refund',
  'adjust',
  'expire',
  'shadow_usage_estimate',
] as const
export const CREDIT_LEDGER_UNIT_TYPES = [
  'launch_credit',
  'wake_credit',
  'always_on_budget',
  'fair_use_adjustment',
] as const
export const CREDIT_LEDGER_STATUSES = ['pending', 'committed', 'reversed'] as const
export const RUN_TERMINATION_REASONS = [
  'ttl_expired',
  'idle_timeout',
  'provisioning_timeout',
  'manual_stop',
  'provider_unhealthy',
  'provider_rejected',
  'provider_error',
] as const

export const DEFAULT_CURRENCY = 'USD'

export const RISK_LEVEL_PRIORITY = {
  low: 0,
  medium: 1,
  high: 2,
} as const
