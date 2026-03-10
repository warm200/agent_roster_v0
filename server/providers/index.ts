import { DaytonaRunProvider } from './daytona.provider'
import { MockRunProvider } from './mock.provider'
import { OpenAIRunProvider } from './openai.provider'
import { OpenClawRunProvider } from './openclaw.provider'
import type { RunProvider } from './run-provider.interface'

function resolveDefaultProvider() {
  const explicit = process.env.RUN_PROVIDER

  if (explicit) {
    return explicit
  }

  const daytonaKey = process.env.DAYTONA_API_KEY
  if (daytonaKey && !daytonaKey.startsWith('op://')) {
    return 'daytona'
  }

  return 'mock'
}

export function getRunProvider(providerName = resolveDefaultProvider()): RunProvider {
  switch (providerName) {
    case 'daytona':
      return new DaytonaRunProvider()
    case 'openai':
      return new OpenAIRunProvider()
    case 'openclaw':
      return new OpenClawRunProvider()
    case 'mock':
    default:
      return new MockRunProvider()
  }
}
