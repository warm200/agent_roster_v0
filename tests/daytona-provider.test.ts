import { createCipheriv, createHash, randomBytes } from 'node:crypto'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, test } from 'node:test'

import type { Order } from '@/lib/types'
import { DaytonaRunProvider } from '@/server/providers/daytona.provider'
import { DaytonaNotFoundError, SandboxState } from '@daytonaio/sdk'

const TEST_TELEGRAM_SECRET_SEED = 'test-telegram-secret-seed'

function encryptTelegramSecret(value: string, secretSeed = TEST_TELEGRAM_SECRET_SEED) {
  const key = createHash('sha256').update(secretSeed).digest()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return [
    'enc',
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join(':')
}

process.env.TELEGRAM_SECRET_SEED ??= TEST_TELEGRAM_SECRET_SEED

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((directory) => rm(directory, { force: true, recursive: true })),
  )
})

async function createLocalAgentFixture(rootDir: string, slug: string, options: { locale?: string } = {}) {
  const agentDir = path.join(rootDir, slug)
  await mkdir(path.join(agentDir, 'avatars'), { recursive: true })
  await mkdir(path.join(agentDir, 'workspace'), { recursive: true })
  await writeFile(path.join(agentDir, 'IDENTITY.md'), `# ${slug} identity`)
  await writeFile(path.join(agentDir, 'SOUL.md'), `# ${slug} soul`)
  await writeFile(path.join(agentDir, 'avatars', 'avatar.png'), `${slug}-png`)
  await writeFile(
    path.join(agentDir, 'openclaw.json'),
    JSON.stringify({
      agents: {
        defaults: {
          ...(options.locale ? { locale: options.locale } : {}),
        },
      },
    }),
  )
  await writeFile(path.join(agentDir, 'workspace', 'README.md'), `# ${slug} hello`)

  return agentDir
}

const order: Order = {
  amountCents: 2900,
  bundleRisk: {
    highestRiskDriver: 'Inbox Triage Agent',
    level: 'low',
    summary: 'Low risk test order.',
  },
  cartId: 'cart-test-1',
  agentSetup: {
    workspace: '/home/daytona/workspace/custom',
    timeFormat: '24',
    modelPrimary: 'anthropic/claude-sonnet-4-5',
    modelFallbacks: ['openai/gpt-5-mini'],
    subagentsMaxConcurrent: 2,
  },
  channelConfig: {
    id: 'channel-test-1',
    orderId: 'order-test-1',
    channelType: 'telegram',
    botTokenSecretRef: encryptTelegramSecret('123456:telegram-bot-token'),
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
        assert.equal(params?.snapshot, 'daytona-medium')
        assert.equal(params?.public, true)
        const sandbox = {
          createdAt,
          files: {} as Record<string, string>,
          processCommands: [] as string[],
          state: 'started',
        }
        sandboxes.set(runId, sandbox)

        return {
          createdAt,
          delete: async () => {
            sandbox.state = 'destroyed'
          },
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
              if (sandbox.state === 'stopped' || sandbox.state === 'destroyed') {
                throw new Error('toolbox unavailable after stop')
              }
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
                  completedAt: new Date().toISOString(),
                  resultSummary:
                    'Managed runtime is ready for bundle order-test-1. Open Control UI to continue.',
                  startedAt,
                  status: 'completed',
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

              return {
                exitCode: 0,
                result: '',
              }
            },
          },
          stop: async () => {
            sandbox.state = 'stopped'
            delete sandbox.files['/tmp/agent-roster/openclaw.pid']
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
          delete: async () => {
            sandbox.state = 'destroyed'
          },
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
              if (sandbox.state === 'stopped' || sandbox.state === 'destroyed') {
                throw new Error('toolbox unavailable after stop')
              }
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

              return {
                exitCode: 0,
                result: '',
              }
            },
          },
          stop: async () => {
            sandbox.state = 'stopped'
            delete sandbox.files['/tmp/agent-roster/openclaw.pid']
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
  assert.equal(status.status, 'completed')
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
  const uploadedConfig = JSON.parse(
    sandboxes.get(created.id)?.files['/home/daytona/.openclaw/openclaw.json'] ?? '{}',
  )
  assert.equal(uploadedConfig.gateway?.mode, 'local')
  assert.equal(uploadedConfig.gateway?.bind, 'lan')
  assert.equal(uploadedConfig.gateway?.controlUi?.allowInsecureAuth, true)
  assert.equal(uploadedConfig.agents?.defaults?.timeFormat, '24')
  assert.equal(uploadedConfig.agents?.defaults?.model?.primary, 'anthropic/claude-sonnet-4-5')
  assert.deepEqual(uploadedConfig.agents?.defaults?.model?.fallbacks, ['openai/gpt-5-mini'])
  assert.equal(uploadedConfig.agents?.defaults?.subagents?.maxConcurrent, 2)
  assert.equal(uploadedConfig.agents?.list?.[0]?.workspace, '/home/daytona/workspace/custom-inbox-triage')
  assert.equal(uploadedConfig.agents?.list?.[0]?.id, 'inbox-triage')
  assert.equal(uploadedConfig.channels?.telegram?.botToken, '123456:telegram-bot-token')
  assert.equal(uploadedConfig.channels?.telegram?.dmPolicy, 'allowlist')
  assert.deepEqual(uploadedConfig.channels?.telegram?.allowFrom, ['tg:77'])
  assert.equal(uploadedConfig.channels?.telegram?.groupPolicy, 'disabled')
  assert.match(
    sandboxes.get(created.id)?.files['/tmp/agent-roster/bootstrap-openclaw.sh'] ?? '',
    /\/home\/daytona\/workspace\/custom-inbox-triage/,
  )
  assert.match(
    sandboxes.get(created.id)?.files['/tmp/agent-roster/bootstrap-openclaw.sh'] ?? '',
    /openclaw gateway run/,
  )

  const stopped = await provider.stopRun(created.id)
  assert.ok(stopped)
  assert.equal(stopped.status, 'failed')
  assert.match(stopped.resultSummary ?? '', /stopped by operator/i)
  assert.equal(sandboxes.get(created.id)?.state, 'stopped')
  assert.equal(
    sandboxes.get(created.id)?.processCommands.some((command) =>
      command.includes('kill "$(cat /tmp/agent-roster/openclaw.pid)"'),
    ),
    false,
  )
})

test('daytona run provider stages DB-sourced local agent assets into the sandbox workspace', async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'daytona-local-agent-'))
  tempDirs.push(rootDir)
  const agentDir = await createLocalAgentFixture(rootDir, 'test-writer', { locale: 'en-US' })

  const localOrder: Order = {
    ...order,
    items: order.items.map((item) => ({
      ...item,
      agent: {
        ...item.agent,
        slug: 'test-writer',
      },
      agentVersion: {
        ...item.agentVersion,
        runConfigSnapshot: JSON.stringify({
          source: {
            kind: 'local-folder',
            slug: 'test-writer',
            sourceRootRelativePath: path.relative(process.cwd(), agentDir).split(path.sep).join('/'),
            openClawConfigRelativePath: 'openclaw.json',
            stagingRelativePath: 'agents/test-writer',
            avatarRelativePath: null,
          },
        }),
      },
    })),
  }

  const sandboxes = new Map<
    string,
    {
      files: Record<string, string>
      processCommands: string[]
    }
  >()
  const provider = new DaytonaRunProvider({
    apiKey: 'daytona-test',
    clientFactory: () => ({
      async create(params) {
        const runId = String(params?.name)
        sandboxes.set(runId, { files: {}, processCommands: [] })

        return {
          createdAt: new Date().toISOString(),
          fs: {
            async downloadFile(filePath: string) {
              const value = sandboxes.get(runId)?.files[filePath]
              if (value === undefined) {
                const error = new Error(`404 ${filePath}`)
                ;(error as Error & { status: number }).status = 404
                throw error
              }

              return Buffer.from(value, 'utf8')
            },
            async uploadFile(file: Buffer, filePath: string) {
              const sandbox = sandboxes.get(runId)
              if (sandbox) {
                sandbox.files[filePath] = file.toString('utf8')
              }
            },
          },
          getSignedPreviewUrl: async () => ({
            url: 'https://18789-demo.proxy.daytona.works',
          }),
          id: runId,
          process: {
            async executeCommand(command: string) {
              sandboxes.get(runId)?.processCommands.push(command)
              if (command.includes('nohup /tmp/agent-roster/bootstrap-openclaw.sh')) {
                const sandbox = sandboxes.get(runId)
                if (sandbox) {
                  sandbox.files['/tmp/agent-roster/status.json'] = JSON.stringify({
                    completedAt: new Date().toISOString(),
                    resultSummary:
                      'Managed runtime is ready for bundle order-test-1. Open Control UI to continue.',
                    startedAt: new Date().toISOString(),
                    status: 'completed',
                    updatedAt: new Date().toISOString(),
                  })
                  sandbox.files['/tmp/agent-roster/result.json'] = JSON.stringify({
                    artifacts: [],
                    summary:
                      'Managed runtime is ready for bundle order-test-1. Open Control UI to continue.',
                  })
                }
              }

              return { exitCode: 0, result: '' }
            },
          },
          state: SandboxState.STARTED,
        }
      },
      async get() {
        throw new Error('not used')
      },
    }),
  })

  const created = await provider.createRun(localOrder, 'run-local-assets')
  const sandboxState = sandboxes.get(created.id)
  assert.ok(sandboxState)
  const sandboxFiles = sandboxState.files
  const uploadedConfig = JSON.parse(sandboxFiles['/home/daytona/.openclaw/openclaw.json'] ?? '{}')

  assert.equal(uploadedConfig.agents?.defaults?.locale, 'en-US')
  assert.equal(uploadedConfig.agents?.defaults?.skipBootstrap, true)
  assert.equal(uploadedConfig.agents?.list?.[0]?.agentDir, '/home/daytona/.openclaw/agents/test-writer/agent')
  assert.equal(
    sandboxFiles['/home/daytona/workspace/custom-test-writer/README.md'],
    undefined,
  )
  assert.equal(
    sandboxFiles['/home/daytona/workspace/custom-test-writer/workspace/README.md'],
    '# test-writer hello',
  )
  assert.equal(
    sandboxFiles['/home/daytona/workspace/custom-test-writer/IDENTITY.md'],
    '# test-writer identity',
  )
  assert.equal(
    sandboxFiles['/home/daytona/workspace/custom-test-writer/SOUL.md'],
    '# test-writer soul',
  )
  assert.equal(
    sandboxFiles['/home/daytona/workspace/custom-test-writer/avatars/avatar.png'],
    'test-writer-png',
  )
  assert.equal(
    sandboxFiles['/home/daytona/workspace/custom-test-writer/openclaw.json'],
    JSON.stringify({
      agents: {
        defaults: {
          locale: 'en-US',
        },
      },
    }),
  )
  assert.equal(uploadedConfig.agents?.list?.[0]?.workspace, '/home/daytona/workspace/custom-test-writer')
  assert.match(
    sandboxState.processCommands.find((command) => command.includes('mkdir -p')) ?? '',
    /\/home\/daytona\/\.openclaw\/agents\/test-writer\/agent/,
  )
})

test('daytona run provider registers multiple purchased agents with agent dirs and workspaces', async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'daytona-local-agents-'))
  tempDirs.push(rootDir)
  const writerDir = await createLocalAgentFixture(rootDir, 'test-writer', { locale: 'en-US' })
  const architectDir = await createLocalAgentFixture(rootDir, 'backend-architect')

  const multiAgentOrder: Order = {
    ...order,
    amountCents: 5800,
    bundleRisk: {
      highestRiskDriver: 'Backend Architect',
      level: 'medium',
      summary: 'Multi-agent test order.',
    },
    items: [
      {
        ...order.items[0],
        id: 'order-item-writer',
        priceCents: 2900,
        agent: {
          ...order.items[0].agent,
          id: 'agent-writer',
          slug: 'test-writer',
          title: 'Test Writer',
        },
        agentVersion: {
          ...order.items[0].agentVersion,
          id: 'ver-writer',
          agentId: 'agent-writer',
          runConfigSnapshot: JSON.stringify({
            source: {
              kind: 'local-folder',
              slug: 'test-writer',
              sourceRootRelativePath: path.relative(process.cwd(), writerDir).split(path.sep).join('/'),
              openClawConfigRelativePath: 'openclaw.json',
              stagingRelativePath: 'agents/test-writer',
              avatarRelativePath: null,
            },
          }),
        },
      },
      {
        ...order.items[0],
        id: 'order-item-architect',
        priceCents: 2900,
        agent: {
          ...order.items[0].agent,
          id: 'agent-architect',
          slug: 'backend-architect',
          title: 'Backend Architect',
        },
        agentVersion: {
          ...order.items[0].agentVersion,
          id: 'ver-architect',
          agentId: 'agent-architect',
          runConfigSnapshot: JSON.stringify({
            source: {
              kind: 'local-folder',
              slug: 'backend-architect',
              sourceRootRelativePath: path.relative(process.cwd(), architectDir).split(path.sep).join('/'),
              openClawConfigRelativePath: 'openclaw.json',
              stagingRelativePath: 'agents/backend-architect',
              avatarRelativePath: null,
            },
          }),
        },
      },
    ],
  }

  const sandboxes = new Map<
    string,
    {
      files: Record<string, string>
      processCommands: string[]
    }
  >()

  const provider = new DaytonaRunProvider({
    apiKey: 'daytona-test',
    clientFactory: () => ({
      async create(params) {
        const runId = String(params?.name)
        sandboxes.set(runId, { files: {}, processCommands: [] })

        return {
          createdAt: new Date().toISOString(),
          fs: {
            async downloadFile(filePath: string) {
              const value = sandboxes.get(runId)?.files[filePath]
              if (value === undefined) {
                const error = new Error(`404 ${filePath}`)
                ;(error as Error & { status: number }).status = 404
                throw error
              }

              return Buffer.from(value, 'utf8')
            },
            async uploadFile(file: Buffer, filePath: string) {
              const sandbox = sandboxes.get(runId)
              if (sandbox) {
                sandbox.files[filePath] = file.toString('utf8')
              }
            },
          },
          getSignedPreviewUrl: async () => ({
            url: 'https://18789-demo.proxy.daytona.works',
          }),
          id: runId,
          process: {
            async executeCommand(command: string) {
              sandboxes.get(runId)?.processCommands.push(command)
              if (command.includes('nohup /tmp/agent-roster/bootstrap-openclaw.sh')) {
                const sandbox = sandboxes.get(runId)
                if (sandbox) {
                  sandbox.files['/tmp/agent-roster/status.json'] = JSON.stringify({
                    completedAt: new Date().toISOString(),
                    resultSummary:
                      'Managed runtime is ready for bundle order-test-1. Open Control UI to continue.',
                    startedAt: new Date().toISOString(),
                    status: 'completed',
                    updatedAt: new Date().toISOString(),
                  })
                  sandbox.files['/tmp/agent-roster/result.json'] = JSON.stringify({
                    artifacts: [],
                    summary:
                      'Managed runtime is ready for bundle order-test-1. Open Control UI to continue.',
                  })
                }
              }

              return { exitCode: 0, result: '' }
            },
          },
          state: SandboxState.STARTED,
        }
      },
      async get() {
        throw new Error('not used')
      },
    }),
  })

  const created = await provider.createRun(multiAgentOrder, 'run-multi-agent-assets')
  const sandboxState = sandboxes.get(created.id)
  assert.ok(sandboxState)
  const uploadedConfig = JSON.parse(
    sandboxState.files['/home/daytona/.openclaw/openclaw.json'] ?? '{}',
  )

  assert.equal(uploadedConfig.agents?.list?.length, 2)
  assert.deepEqual(
    uploadedConfig.agents?.list?.map((agent: { id?: string; workspace?: string; agentDir?: string }) => ({
      agentDir: agent.agentDir,
      id: agent.id,
      workspace: agent.workspace,
    })),
    [
      {
        agentDir: '/home/daytona/.openclaw/agents/test-writer/agent',
        id: 'test-writer',
        workspace: '/home/daytona/workspace/custom-test-writer',
      },
      {
        agentDir: '/home/daytona/.openclaw/agents/backend-architect/agent',
        id: 'backend-architect',
        workspace: '/home/daytona/workspace/custom-backend-architect',
      },
    ],
  )
  assert.equal(
    sandboxState.files['/home/daytona/workspace/custom-test-writer/IDENTITY.md'],
    '# test-writer identity',
  )
  assert.equal(
    sandboxState.files['/home/daytona/workspace/custom-backend-architect/IDENTITY.md'],
    '# backend-architect identity',
  )
  assert.match(
    sandboxState.processCommands.find((command) => command.includes('mkdir -p')) ?? '',
    /\/home\/daytona\/\.openclaw\/agents\/backend-architect\/agent/,
  )
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

test('daytona run provider upgrades legacy running bootstrap state to completed once control ui is ready', async () => {
  const runId = 'run-legacy'
  const startedAt = new Date().toISOString()
  const sandbox = {
    createdAt: startedAt,
    files: {
      '/tmp/agent-roster/manifest.json': JSON.stringify({
        agentTitles: ['Inbox Triage Agent'],
        channelConfigId: 'channel-test-1',
        combinedRiskLevel: 'low',
        createdAt: startedAt,
        networkEnabled: true,
        orderId: 'order-test-1',
        recipientExternalId: '77',
        runId,
        userId: 'user-test-1',
        usesTools: true,
      }),
      '/tmp/agent-roster/status.json': JSON.stringify({
        completedAt: null,
        resultSummary: 'Managed runtime is ready for bundle order-test-1. Open Control UI to continue.',
        startedAt,
        status: 'running',
        updatedAt: startedAt,
      }),
      '/tmp/agent-roster/result.json': JSON.stringify({
        artifacts: [],
        summary: 'Managed runtime is ready for bundle order-test-1. Open Control UI to continue.',
      }),
      '/tmp/agent-roster/openclaw.pid': '123',
    } as Record<string, string>,
  }

  const provider = new DaytonaRunProvider({
    apiKey: 'daytona-test',
    clientFactory: () => ({
      async create() {
        throw new Error('not used')
      },
      async get(id) {
        assert.equal(id, runId)
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
          id,
          process: {
            async executeCommand(command: string) {
              if (command.includes('kill -0 "$(cat /tmp/agent-roster/openclaw.pid)"')) {
                return {
                  exitCode: 0,
                  result: 'running',
                }
              }

              return {
                exitCode: 0,
                result: '',
              }
            },
          },
          state: SandboxState.STARTED,
        }
      },
    }),
  })

  const status = await provider.getStatus(runId)
  assert.ok(status)
  assert.equal(status.status, 'completed')
  assert.ok(status.completedAt)
})

test('daytona run provider heals failed bootstrap records when control ui process is actually alive', async () => {
  const runId = 'run-heal'
  const startedAt = new Date().toISOString()
  const sandbox = {
    createdAt: startedAt,
    files: {
      '/tmp/agent-roster/manifest.json': JSON.stringify({
        agentTitles: ['Inbox Triage Agent'],
        channelConfigId: 'channel-test-1',
        combinedRiskLevel: 'low',
        createdAt: startedAt,
        networkEnabled: true,
        orderId: 'order-test-1',
        recipientExternalId: '77',
        runId,
        userId: 'user-test-1',
        usesTools: true,
      }),
      '/tmp/agent-roster/status.json': JSON.stringify({
        completedAt: startedAt,
        resultSummary: 'Managed runtime bootstrap failed.',
        startedAt,
        status: 'failed',
        updatedAt: startedAt,
      }),
      '/tmp/agent-roster/result.json': JSON.stringify({
        artifacts: [],
        summary: 'Managed runtime bootstrap failed.',
      }),
      '/tmp/agent-roster/openclaw.pid': '123',
    } as Record<string, string>,
  }

  const provider = new DaytonaRunProvider({
    apiKey: 'daytona-test',
    clientFactory: () => ({
      async create() {
        throw new Error('not used')
      },
      async get(id) {
        assert.equal(id, runId)
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
          id,
          process: {
            async executeCommand(command: string) {
              if (command.includes('kill -0 "$(cat /tmp/agent-roster/openclaw.pid)"')) {
                return {
                  exitCode: 0,
                  result: 'running',
                }
              }

              return {
                exitCode: 0,
                result: '',
              }
            },
          },
          state: SandboxState.STARTED,
        }
      },
    }),
  })

  const status = await provider.getStatus(runId)
  assert.ok(status)
  assert.equal(status.status, 'completed')
  assert.match(status.resultSummary ?? '', /Open Control UI/)
})

test('daytona run provider marks externally stopped sandboxes as failed on refresh', async () => {
  const runId = 'run-stopped-externally'
  const createdAt = new Date().toISOString()
  const sandbox = {
    createdAt,
    files: {
      '/tmp/agent-roster/manifest.json': JSON.stringify({
        agentTitles: ['Inbox Triage Agent'],
        channelConfigId: 'channel-test-1',
        combinedRiskLevel: 'low',
        createdAt,
        networkEnabled: true,
        orderId: 'order-test-1',
        recipientExternalId: '77',
        runId,
        userId: 'user-test-1',
        usesTools: true,
      }),
      '/tmp/agent-roster/status.json': JSON.stringify({
        completedAt: createdAt,
        resultSummary: 'Managed runtime is ready for bundle order-test-1. Open Control UI to continue.',
        startedAt: createdAt,
        status: 'completed',
        updatedAt: createdAt,
      }),
      '/tmp/agent-roster/result.json': JSON.stringify({
        artifacts: [],
        summary: 'Managed runtime is ready for bundle order-test-1. Open Control UI to continue.',
      }),
    } as Record<string, string>,
  }

  const provider = new DaytonaRunProvider({
    apiKey: 'daytona-test',
    clientFactory: () => ({
      async create() {
        throw new Error('not used')
      },
      async get(id) {
        assert.equal(id, runId)
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
          id,
          process: {
            async executeCommand() {
              return {
                exitCode: 0,
                result: '',
              }
            },
          },
          state: SandboxState.STOPPED,
        }
      },
    }),
  })

  const status = await provider.getStatus(runId)
  assert.ok(status)
  assert.equal(status.status, 'failed')
  assert.match(status.resultSummary ?? '', /no longer available/i)
})

test('daytona run provider falls back to empty template state when local OpenClaw files are missing', async () => {
  let uploadedWorkspaceFile = ''
  const provider = new DaytonaRunProvider({
    apiKey: 'daytona-test',
    clientFactory: () => ({
      async create(params) {
        const runId = String(params?.name)
        return {
          createdAt: new Date().toISOString(),
          fs: {
            async downloadFile() {
              throw Object.assign(new Error('404 missing'), { status: 404 })
            },
            async uploadFile(file: Buffer, filePath: string) {
              if (filePath.startsWith('/tmp/agent-roster/workspace-seed/')) {
                uploadedWorkspaceFile = file.toString('utf8')
              }
            },
          },
          id: runId,
          process: {
            async executeCommand() {
              return {
                exitCode: 0,
                result: '',
              }
            },
          },
          state: SandboxState.STARTED,
        }
      },
      async get() {
        throw new Error('not used')
      },
    }),
    openClawTemplateDir: 'openclaw_config_test-missing',
  })

  const created = await provider.createRun(order)
  assert.equal(created.status, 'provisioning')
  assert.equal(uploadedWorkspaceFile, '')
})

test('daytona run provider can stop a sandbox even when toolbox manifest reads fail', async () => {
  const runId = 'run-stop-fallback'
  let sandboxState = 'started'

  const provider = new DaytonaRunProvider({
    apiKey: 'daytona-test',
    clientFactory: () => ({
      async create() {
        throw new Error('not used')
      },
      async get(id) {
        assert.equal(id, runId)
        return {
          createdAt: new Date().toISOString(),
          fs: {
            async downloadFile() {
              const error = new Error('[object Object]')
              ;(error as Error & { status: number }).status = 400
              throw error
            },
            async uploadFile() {
              throw new Error('not used')
            },
          },
          id,
          process: {
            async executeCommand() {
              return { exitCode: 0, result: '' }
            },
          },
          state: sandboxState as typeof SandboxState.STARTED,
          stop: async () => {
            sandboxState = 'stopped'
          },
        }
      },
    }),
  })

  const stopped = await provider.stopRun(runId, {
    id: runId,
    userId: order.userId,
    orderId: order.id,
    channelConfigId: 'channel-test-1',
    status: 'completed',
    combinedRiskLevel: order.bundleRisk.level,
    usesRealWorkspace: true,
    usesTools: true,
    networkEnabled: true,
    resultSummary: 'Managed runtime is ready for bundle order-test-1. Open Control UI to continue.',
    resultArtifacts: [],
    createdAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  })

  assert.ok(stopped)
  assert.equal(stopped.status, 'failed')
  assert.equal(stopped.resultSummary, 'Run stopped by operator request.')
  assert.equal(sandboxState, 'stopped')
})

test('daytona run provider restarts the same stopped sandbox in place', async () => {
  const runId = 'run-restart-same-sandbox'
  const createdAt = new Date().toISOString()
  let sandboxState = 'stopped'
  const files: Record<string, string> = {
    '/tmp/agent-roster/manifest.json': JSON.stringify({
      agentTitles: ['Inbox Triage Agent'],
      channelConfigId: 'channel-test-1',
      combinedRiskLevel: 'low',
      createdAt,
      networkEnabled: true,
      orderId: 'order-test-1',
      recipientExternalId: '77',
      runId,
      userId: 'user-test-1',
      usesTools: true,
    }),
    '/tmp/agent-roster/status.json': JSON.stringify({
      completedAt: createdAt,
      resultSummary: 'Run stopped by operator request.',
      startedAt: createdAt,
      status: 'failed',
      updatedAt: createdAt,
    }),
    '/tmp/agent-roster/result.json': JSON.stringify({
      artifacts: [],
      summary: 'Run stopped by operator request.',
    }),
    '/tmp/agent-roster/bootstrap-openclaw.sh': '#!/usr/bin/env bash\necho restart\n',
  }
  const processCommands: string[] = []

  const provider = new DaytonaRunProvider({
    apiKey: 'daytona-test',
    clientFactory: () => ({
      async create() {
        throw new Error('not used')
      },
      async get(id) {
        assert.equal(id, runId)
        return {
          createdAt,
          fs: {
            async downloadFile(filePath: string) {
              const value = files[filePath]
              if (value === undefined) {
                const error = new Error(`404 ${filePath}`)
                ;(error as Error & { status: number }).status = 404
                throw error
              }

              return Buffer.from(value, 'utf8')
            },
            async uploadFile(file: Buffer, filePath: string) {
              files[filePath] = file.toString('utf8')
            },
          },
          id,
          process: {
            async executeCommand(command: string) {
              processCommands.push(command)
              return { exitCode: 0, result: '' }
            },
          },
          start: async () => {
            sandboxState = 'started'
          },
          state: sandboxState as typeof SandboxState.STOPPED,
        }
      },
    }),
  })

  const restarted = await provider.restartRun?.(runId, order, {
    id: runId,
    userId: order.userId,
    orderId: order.id,
    channelConfigId: 'channel-test-1',
    status: 'failed',
    combinedRiskLevel: order.bundleRisk.level,
    usesRealWorkspace: true,
    usesTools: true,
    networkEnabled: true,
    resultSummary: 'Run stopped by operator request.',
    resultArtifacts: [],
    createdAt,
    startedAt: createdAt,
    updatedAt: createdAt,
    completedAt: createdAt,
  })

  assert.ok(restarted)
  assert.equal(restarted.status, 'provisioning')
  assert.equal(restarted.id, runId)
  assert.equal(sandboxState, 'started')
  assert.match(restarted.resultSummary ?? '', /restarting/i)
  assert.equal(
    processCommands.some((command) => command.includes('nohup /tmp/agent-roster/bootstrap-openclaw.sh')),
    true,
  )
})
