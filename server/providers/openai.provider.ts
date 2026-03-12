import type { Order, Run, RunArtifact, RunLog, RunResult } from '@/lib/types'

import { HttpError } from '../lib/http'
import type { RunProvider, RunProviderRuntimeConfig } from './run-provider.interface'

type OpenAIResponseStatus =
  | 'queued'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'incomplete'

type OpenAIResponsePayload = {
  created_at?: number
  error?: {
    message?: string
  }
  id: string
  output_text?: string
  status: OpenAIResponseStatus
}

type OpenAIProviderState = {
  createdAt: string
  order: Order
  responseId: string
  runId: string
}

type OpenAIRunProviderOptions = {
  apiKey?: string
  fetchImpl?: typeof fetch
  model?: string
}

const openAiRunState = new Map<string, OpenAIProviderState>()

function resolveApiKey(explicitApiKey?: string) {
  const apiKey = explicitApiKey ?? process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new HttpError(503, 'OPENAI_API_KEY is required for the openai run provider.')
  }

  if (apiKey.startsWith('op://')) {
    throw new HttpError(
      503,
      'OPENAI_API_KEY is still a 1Password reference. Start the app with `op run --env-file=.env -- pnpm dev` or export the resolved key first.',
    )
  }

  return apiKey
}

function mapStatus(status: OpenAIResponseStatus): Run['status'] {
  switch (status) {
    case 'completed':
      return 'completed'
    case 'failed':
    case 'cancelled':
    case 'incomplete':
      return 'failed'
    case 'in_progress':
      return 'running'
    case 'queued':
    default:
      return 'provisioning'
  }
}

function buildRun(order: Order, runId: string, createdAt: string): Run {
  return {
    id: runId,
    userId: order.userId,
    orderId: order.id,
    channelConfigId: order.channelConfig?.id ?? 'channel-pending',
    status: 'provisioning',
    combinedRiskLevel: order.bundleRisk.level,
    usesRealWorkspace: false,
    usesTools: false,
    networkEnabled: false,
    resultSummary: null,
    resultArtifacts: [],
    createdAt,
    startedAt: null,
    updatedAt: createdAt,
    completedAt: null,
  }
}

function buildPrompt(order: Order) {
  const agentSummary = order.items
    .map((item) => `- ${item.agent.title}: ${item.agent.summary}`)
    .join('\n')

  return [
    'You are the backend run provider for a purchased agent bundle.',
    'Produce a concise execution summary for this bundle.',
    'Do not claim to have accessed tools, files, shell, or network.',
    'Summarize what the purchased agents would do for the operator next.',
    '',
    `Order ID: ${order.id}`,
    `Bundle risk: ${order.bundleRisk.level}`,
    'Agents:',
    agentSummary,
  ].join('\n')
}

function buildArtifacts(responseId: string, summary: string): RunArtifact[] {
  return summary
    ? [
        {
          id: `artifact-${responseId}`,
          name: `openai-response-${responseId}.txt`,
          type: 'text/plain',
          size: Buffer.byteLength(summary, 'utf8'),
          downloadUrl: `https://platform.openai.com/responses/${responseId}`,
        },
      ]
    : []
}

function applyResponseToRun(input: {
  baseRun: Run
  response: OpenAIResponsePayload
}): Run {
  const now = new Date().toISOString()
  const resultSummary = input.response.output_text?.trim() || null
  const status = mapStatus(input.response.status)
  const isRunning = status === 'running'
  const isComplete = status === 'completed' || status === 'failed'

  return {
    ...input.baseRun,
    status,
    startedAt: input.baseRun.startedAt ?? (isRunning || isComplete ? now : null),
    updatedAt: now,
    completedAt: isComplete ? now : null,
    resultSummary,
    resultArtifacts: resultSummary ? buildArtifacts(input.response.id, resultSummary) : [],
  }
}

export class OpenAIRunProvider implements RunProvider {
  readonly name = 'openai'

  private readonly apiKey: string
  private readonly fetchImpl: typeof fetch
  private readonly model: string

  constructor(options: OpenAIRunProviderOptions = {}) {
    this.apiKey = resolveApiKey(options.apiKey)
    this.fetchImpl = options.fetchImpl ?? fetch
    this.model = options.model ?? process.env.OPENAI_RUN_MODEL ?? 'gpt-5'
  }

  async createRun(
    order: Order,
    runId = `run-${Date.now()}`,
    _runtimeConfig?: RunProviderRuntimeConfig,
  ): Promise<Run> {
    const createdAt = new Date().toISOString()
    const baseRun = buildRun(order, runId, createdAt)
    const response = await this.request<OpenAIResponsePayload>('/responses', {
      background: true,
      input: buildPrompt(order),
      model: this.model,
    })

    openAiRunState.set(runId, {
      createdAt,
      order,
      responseId: response.id,
      runId,
    })

    return applyResponseToRun({
      baseRun,
      response,
    })
  }

  async getStatus(runId: string): Promise<Run | null> {
    const state = openAiRunState.get(runId)

    if (!state) {
      return null
    }

    const response = await this.request<OpenAIResponsePayload>(`/responses/${state.responseId}`, undefined, 'GET')
    return applyResponseToRun({
      baseRun: buildRun(state.order, state.runId, state.createdAt),
      response,
    })
  }

  async getLogs(runId: string): Promise<RunLog[]> {
    const state = openAiRunState.get(runId)

    if (!state) {
      return []
    }

    const response = await this.request<OpenAIResponsePayload>(`/responses/${state.responseId}`, undefined, 'GET')
    const currentRun = applyResponseToRun({
      baseRun: buildRun(state.order, state.runId, state.createdAt),
      response,
    })

    return [
      {
        timestamp: state.createdAt,
        level: 'info',
        step: 'submit',
        message: `Submitted background response ${state.responseId} to OpenAI model ${this.model}.`,
      },
      {
        timestamp: currentRun.updatedAt,
        level: currentRun.status === 'failed' ? 'error' : 'info',
        step: 'status',
        message: `OpenAI response is currently ${response.status}.`,
      },
      ...(currentRun.resultSummary
        ? [
            {
              timestamp: currentRun.updatedAt,
              level: 'info' as const,
              step: 'result',
              message: 'OpenAI returned a final summary for this run.',
            },
          ]
        : []),
    ]
  }

  async getResult(runId: string): Promise<RunResult | null> {
    const state = openAiRunState.get(runId)

    if (!state) {
      return null
    }

    const response = await this.request<OpenAIResponsePayload>(`/responses/${state.responseId}`, undefined, 'GET')
    const summary = response.output_text?.trim()

    if (!summary) {
      return null
    }

    return {
      summary,
      artifacts: buildArtifacts(response.id, summary),
    }
  }

  async stopRun(runId: string): Promise<Run | null> {
    const state = openAiRunState.get(runId)

    if (!state) {
      return null
    }

    const response = await this.request<OpenAIResponsePayload>(
      `/responses/${state.responseId}/cancel`,
      {},
      'POST',
    )

    return applyResponseToRun({
      baseRun: buildRun(state.order, state.runId, state.createdAt),
      response,
    })
  }

  private async request<T>(
    path: string,
    body?: Record<string, unknown>,
    method: 'GET' | 'POST' = 'POST',
  ): Promise<T> {
    const response = await this.fetchImpl(`https://api.openai.com/v1${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
    })
    const payload = (await response.json()) as OpenAIResponsePayload

    if (!response.ok) {
      throw new HttpError(502, payload.error?.message ?? 'OpenAI run provider request failed.')
    }

    return payload as T
  }
}
