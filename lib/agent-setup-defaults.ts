import type { AgentSetup } from './types'

export const DEFAULT_AGENT_SETUP_MODEL_PRIMARY = 'anthropic/claude-sonnet-4-5'
export const DEFAULT_AGENT_SETUP_MODEL_FALLBACKS = [
  'openai/gpt-5-mini',
  'openrouter/openai/gpt-4.1-mini',
] as const

export function resolveAgentSetupModelDefaults(
  agentSetup?: Pick<AgentSetup, 'modelPrimary' | 'modelFallbacks'> | null,
) {
  const fallbackModels =
    agentSetup?.modelFallbacks
      ?.map((value) => value.trim())
      .filter(Boolean) ?? []

  return {
    modelPrimary: agentSetup?.modelPrimary?.trim() || DEFAULT_AGENT_SETUP_MODEL_PRIMARY,
    modelFallbacks:
      fallbackModels.length > 0
        ? fallbackModels
        : [...DEFAULT_AGENT_SETUP_MODEL_FALLBACKS],
  }
}
