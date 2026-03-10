import { MockRunProvider } from './mock.provider'
import { OpenAIRunProvider } from './openai.provider'
import { OpenClawRunProvider } from './openclaw.provider'
import type { RunProvider } from './run-provider.interface'

export function getRunProvider(providerName = process.env.RUN_PROVIDER ?? 'mock'): RunProvider {
  switch (providerName) {
    case 'openai':
      return new OpenAIRunProvider()
    case 'openclaw':
      return new OpenClawRunProvider()
    case 'mock':
    default:
      return new MockRunProvider()
  }
}
