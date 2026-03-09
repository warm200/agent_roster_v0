export const RISK_LEVELS = ['low', 'medium', 'high'] as const
export const RUN_STATUSES = ['provisioning', 'running', 'completed', 'failed'] as const
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

export const DEFAULT_CURRENCY = 'USD'

export const RISK_LEVEL_PRIORITY = {
  low: 0,
  medium: 1,
  high: 2,
} as const
