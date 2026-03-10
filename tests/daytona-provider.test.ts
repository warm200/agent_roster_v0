import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { Order } from '@/lib/types'
import { DaytonaRunProvider } from '@/server/providers/daytona.provider'
import { DaytonaNotFoundError, SandboxState } from '@daytonaio/sdk'

const order: Order = {
  amountCents: 2900,
  bundleRisk: {
    highestRiskDriver: 'Inbox Triage Agent',
    level: 'low',
    summary: 'Low risk test order.',
  },
  cartId: 'cart-test-1',
  channelConfig: {
    id: 'channel-test-1',
    orderId: 'order-test-1',
    channelType: 'telegram',
    botTokenSecretRef: 'secret-ref',
    tokenStatus: 'validated',
    recipientBindingStatus: 'paired',
    recipientExternalId: '77',
    appliesToScope: 'run',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  createdAt: new Date().toISOString(),
  currency: 'USD',
  id: 'order-test-1',
  items: [
    {
      id: 'order-item-1',
      orderId: 'order-test-1',
      priceCents: 2900,
      createdAt: new Date().toISOString(),
      agent: {
        id: 'agent-1',
        slug: 'inbox-triage',
        title: 'Inbox Triage Agent',
        category: 'inbox',
        summary: 'Triage email.',
        descriptionMarkdown: 'desc',
        priceCents: 2900,
        currency: 'USD',
        status: 'active',
        currentVersion: {
          id: 'ver-1',
          agentId: 'agent-1',
          version: '1.0.0',
          changelogMarkdown: '',
          previewPromptSnapshot: '',
          runConfigSnapshot: '',
          installPackageUrl: '/downloads/a.zip',
          installScriptMarkdown: '',
          releaseNotes: '',
          riskProfile: {
            id: 'risk-1',
            agentVersionId: 'ver-1',
            chatOnly: true,
            readFiles: false,
            writeFiles: false,
            network: true,
            shell: true,
            riskLevel: 'low',
            scanSummary: 'low',
            createdAt: new Date().toISOString(),
          },
          createdAt: new Date().toISOString(),
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      agentVersion: {
        id: 'ver-1',
        agentId: 'agent-1',
        version: '1.0.0',
        changelogMarkdown: '',
        previewPromptSnapshot: '',
        runConfigSnapshot: '',
        installPackageUrl: '/downloads/a.zip',
        installScriptMarkdown: '',
        releaseNotes: '',
        riskProfile: {
          id: 'risk-1',
          agentVersionId: 'ver-1',
          chatOnly: true,
          readFiles: false,
          writeFiles: false,
          network: true,
          shell: true,
          riskLevel: 'low',
          scanSummary: 'low',
          createdAt: new Date().toISOString(),
        },
        createdAt: new Date().toISOString(),
      },
    },
  ],
  paidAt: new Date().toISOString(),
  paymentProvider: 'stripe',
  paymentReference: 'pi_test_1',
  status: 'paid',
  updatedAt: new Date().toISOString(),
  userId: 'user-test-1',
}

test('daytona run provider stages OpenClaw and returns a signed control ui link', async () => {
  const sandboxes = new Map<
    string,
    {
      createdAt: string
      files: Record<string, string>
      processCommands: string[]
      state: string
    }
  >()

  const provider = new DaytonaRunProvider({
    apiKey: 'daytona-test',
    clientFactory: () => ({
      async create(params) {
        const runId = String(params?.name)
        const createdAt = new Date().toISOString()
        const sandbox = {
          createdAt,
          files: {} as Record<string, string>,
          processCommands: [] as string[],
          state: 'started',
        }
        sandboxes.set(runId, sandbox)

        return {
          createdAt,
          fs: {
            async downloadFile(filePath: string) {
              const value = sandbox.files[filePath]
              if (value === undefined) {
                const error = new Error(`404 ${filePath}`)
                ;(error as Error & { status: number }).status = 404
                throw error
              }

              return Buffer.from(value, 'utf8')
            },
            async uploadFile(file: Buffer, filePath: string) {
              sandbox.files[filePath] = file.toString('utf8')
            },
          },
          async getSignedPreviewUrl() {
            return {
              url: 'https://18789-demo.proxy.daytona.works',
            }
          },
          id: runId,
          process: {
            async executeCommand(command: string) {
              sandbox.processCommands.push(command)

              if (command.includes('mkdir -p /tmp/agent-roster /tmp/agent-roster/workspace-seed')) {
                return { exitCode: 0, result: '' }
              }

              if (command.includes('nohup /tmp/agent-roster/bootstrap-openclaw.sh')) {
                const startedAt = new Date().toISOString()
                sandbox.files['/tmp/agent-roster/run.log'] = [
                  `${startedAt}|info|bootstrap|Provisioning managed runtime for order order-test-1.`,
                  `${new Date().toISOString()}|info|ready|Managed runtime is ready for Control UI access.`,
                ].join('\n')
                sandbox.files['/tmp/agent-roster/status.json'] = JSON.stringify({
                  completedAt: null,
                  resultSummary:
                    'Managed runtime is ready for bundle order-test-1. Open Control UI to continue.',
                  startedAt,
                  status: 'running',
                  updatedAt: new Date().toISOString(),
                })
                sandbox.files['/tmp/agent-roster/result.json'] = JSON.stringify({
                  artifacts: [],
                  summary:
                    'Managed runtime is ready for bundle order-test-1. Open Control UI to continue.',
                })
                sandbox.files['/tmp/agent-roster/openclaw.pid'] = '123'
              }

              if (command.includes('kill -0 "$(cat /tmp/agent-roster/openclaw.pid)"')) {
                return {
                  exitCode: 0,
                  result: sandbox.files['/tmp/agent-roster/openclaw.pid'] ? 'running' : 'exited',
                }
              }

              if (command.includes('kill "$(cat /tmp/agent-roster/openclaw.pid)"')) {
                delete sandbox.files['/tmp/agent-roster/openclaw.pid']
              }

              return {
                exitCode: 0,
                result: '',
              }
            },
          },
          state: sandbox.state as typeof SandboxState.STARTED,
        }
      },
      async get(runId) {
        const sandbox = sandboxes.get(runId)
        if (!sandbox) {
          const error = new Error('404 sandbox')
          ;(error as Error & { status: number }).status = 404
          throw error
        }

        return {
          createdAt: sandbox.createdAt,
          fs: {
            async downloadFile(filePath: string) {
              const value = sandbox.files[filePath]
              if (value === undefined) {
                const error = new Error(`404 ${filePath}`)
                ;(error as Error & { status: number }).status = 404
                throw error
              }

              return Buffer.from(value, 'utf8')
            },
            async uploadFile(file: Buffer, filePath: string) {
              sandbox.files[filePath] = file.toString('utf8')
            },
          },
          async getSignedPreviewUrl() {
            return {
              url: 'https://18789-demo.proxy.daytona.works',
            }
          },
          id: runId,
          process: {
            async executeCommand(command: string) {
              sandbox.processCommands.push(command)

              if (command.includes('kill -0 "$(cat /tmp/agent-roster/openclaw.pid)"')) {
                return {
                  exitCode: 0,
                  result: sandbox.files['/tmp/agent-roster/openclaw.pid'] ? 'running' : 'exited',
                }
              }

              if (command.includes('kill "$(cat /tmp/agent-roster/openclaw.pid)"')) {
                delete sandbox.files['/tmp/agent-roster/openclaw.pid']
              }

              return {
                exitCode: 0,
                result: '',
              }
            },
          },
          state: sandbox.state as typeof SandboxState.STARTED,
        }
      },
    }),
  })

  const created = await provider.createRun(order)
  assert.equal(created.status, 'provisioning')
  assert.equal(created.usesRealWorkspace, true)
  assert.equal(created.networkEnabled, true)

  const status = await provider.getStatus(created.id)
  assert.ok(status)
  assert.equal(status.status, 'running')
  assert.match(status.resultSummary ?? '', /Open Control UI/)

  const logs = await provider.getLogs(created.id)
  assert.equal(logs[0]?.step, 'bootstrap')
  assert.equal(logs.at(-1)?.step, 'ready')

  const result = await provider.getResult(created.id)
  assert.ok(result)
  assert.match(result.summary, /Open Control UI/)

  const controlUiLink = await provider.getControlUiLink?.(created.id)
  assert.ok(controlUiLink)
  assert.match(controlUiLink.url, /proxy\.daytona\.works/)
  assert.match(controlUiLink.url, /token=/)

  const stopped = await provider.stopRun(created.id)
  assert.ok(stopped)
  assert.equal(stopped.status, 'failed')
  assert.match(stopped.resultSummary ?? '', /stopped by operator/i)
})

test('daytona run provider tolerates deleted sandboxes', async () => {
  const provider = new DaytonaRunProvider({
    apiKey: 'daytona-test',
    clientFactory: () => ({
      async create() {
        throw new Error('not used')
      },
      async get() {
        throw new DaytonaNotFoundError('Sandbox not found', 404)
      },
    }),
  })

  assert.equal(await provider.getStatus('run-missing'), null)
  assert.deepEqual(await provider.getLogs('run-missing'), [])
  assert.equal(await provider.getResult('run-missing'), null)
  assert.equal(await provider.getControlUiLink?.('run-missing'), null)
  assert.equal(await provider.stopRun('run-missing'), null)
})
