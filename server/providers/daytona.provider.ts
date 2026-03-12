import { randomBytes } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'

import { Daytona, DaytonaNotFoundError, SandboxState, type DaytonaConfig, type Sandbox } from '@daytonaio/sdk'

import type { AgentSetup, Order, Run, RunLog, RunResult, RunStatus } from '@/lib/types'

import { HttpError, logServerError } from '../lib/http'
import { loadRuntimeAssetsFromSnapshot } from '../services/local-agent-files'
import { buildOpenClawTelegramChannelConfig } from '../services/telegram.service'
import type { RunControlUiLink, RunProvider } from './run-provider.interface'

type DaytonaRunManifest = {
  agentWorkspaces: Record<string, string>
  agentTitles: string[]
  channelConfigId: string
  combinedRiskLevel: Order['bundleRisk']['level']
  createdAt: string
  networkEnabled: boolean
  orderId: string
  recipientExternalId: string | null
  runId: string
  userId: string
  usesTools: boolean
}

type DaytonaStatusFile = {
  completedAt: string | null
  resultSummary: string | null
  startedAt: string | null
  status: RunStatus
  updatedAt: string
}

type DaytonaRunProviderOptions = {
  apiKey?: string
  apiUrl?: string
  clientFactory?: (config: DaytonaConfig) => DaytonaClientLike
  openClawPort?: number
  openClawTemplateDir?: string
  target?: string
}

type DaytonaClientLike = {
  create(
    params?: Record<string, unknown>,
    options?: { timeout?: number },
  ): Promise<DaytonaSandboxLike>
  get(sandboxIdOrName: string): Promise<DaytonaSandboxLike>
}

type DaytonaFsLike = {
  downloadFile(remotePath: string, timeout?: number): Promise<Buffer>
  uploadFile(file: Buffer, remotePath: string, timeout?: number): Promise<void>
}

type DaytonaProcessLike = {
  executeCommand(
    command: string,
    cwd?: string,
    env?: Record<string, string>,
    timeout?: number,
  ): Promise<{ exitCode: number; result: string }>
}

type PreviewLinkLike = {
  url: string
}

type DaytonaSandboxLike = Pick<Sandbox, 'createdAt' | 'errorReason' | 'id' | 'state'> & {
  delete?: (timeout?: number) => Promise<void>
  fs: DaytonaFsLike
  process: DaytonaProcessLike
  getPreviewLink?: (port: number) => Promise<PreviewLinkLike>
  getSignedPreviewUrl?: (port: number, expiresInSeconds?: number) => Promise<PreviewLinkLike>
  getUserHomeDir?: () => Promise<string | undefined>
  start?: (timeout?: number) => Promise<void>
  stop?: (timeout?: number) => Promise<void>
}

type OpenClawTemplate = {
  config: Record<string, unknown>
  workspaceFiles: Array<{
    contents: Buffer
    relativePath: string
    targetWorkspaceDir: string | null
  }>
}

const DAYTONA_ROOT = '/tmp/agent-roster'
const MANIFEST_PATH = `${DAYTONA_ROOT}/manifest.json`
const STATUS_PATH = `${DAYTONA_ROOT}/status.json`
const RESULT_PATH = `${DAYTONA_ROOT}/result.json`
const LOG_PATH = `${DAYTONA_ROOT}/run.log`
const BOOTSTRAP_SCRIPT_PATH = `${DAYTONA_ROOT}/bootstrap-openclaw.sh`
const STAGED_WORKSPACE_ROOT = `${DAYTONA_ROOT}/workspace-seed`
const OPENCLAW_GATEWAY_LOG_PATH = `${DAYTONA_ROOT}/openclaw-gateway.log`
const OPENCLAW_PID_PATH = `${DAYTONA_ROOT}/openclaw.pid`
const DEFAULT_OPENCLAW_TEMPLATE_DIR = 'openclaw_config_test'
const DEFAULT_OPENCLAW_PORT = 18_789
const DEFAULT_PREVIEW_TTL_SECONDS = 60 * 30
const DEFAULT_OPENCLAW_PACKAGE = 'openclaw@latest'
const DEFAULT_DAYTONA_SNAPSHOT = 'daytona-medium'
const DEFAULT_ENV_SANDBOX_PATH = '.env.sandbox'
const OPENCLAW_CONFIG_PATH = '.openclaw/openclaw.json'
const OPENCLAW_BASE_CONFIG = {
  agents: {
    defaults: {
      workspace: '~/.openclaw/workspace',
    },
  },
  gateway: {
    auth: {
      mode: 'token',
      token: '',
    },
    bind: 'lan',
    controlUi: {
      allowInsecureAuth: true,
    },
    mode: 'local',
    port: DEFAULT_OPENCLAW_PORT,
  },
} as const

function nowIso() {
  return new Date().toISOString()
}

function resolveDaytonaApiKey(explicitApiKey?: string) {
  const apiKey = explicitApiKey ?? process.env.DAYTONA_API_KEY

  if (!apiKey) {
    throw new HttpError(503, 'DAYTONA_API_KEY is required for the daytona run provider.')
  }

  if (apiKey.startsWith('op://')) {
    throw new HttpError(
      503,
      'DAYTONA_API_KEY is still a 1Password reference. Start the app with `op run --env-file=.env -- pnpm dev` or export the resolved key first.',
    )
  }

  return apiKey
}

function resolveOpenClawPort(explicitPort?: number) {
  const rawPort = explicitPort ?? Number.parseInt(process.env.OPENCLAW_PORT ?? '', 10)
  if (!Number.isFinite(rawPort)) {
    return DEFAULT_OPENCLAW_PORT
  }

  if (rawPort <= 0 || rawPort > 65_535) {
    throw new HttpError(503, 'OPENCLAW_PORT must be a valid TCP port number.')
  }

  return rawPort
}

function resolveOpenClawTemplateDir(explicitTemplateDir?: string) {
  return path.resolve(
    process.cwd(),
    explicitTemplateDir ?? process.env.OPENCLAW_TEMPLATE_DIR ?? DEFAULT_OPENCLAW_TEMPLATE_DIR,
  )
}

function buildManifest(
  order: Order,
  runId: string,
  createdAt: string,
  agentWorkspaces: Record<string, string>,
): DaytonaRunManifest {
  return {
    agentWorkspaces,
    agentTitles: order.items.map((item) => item.agent.title),
    channelConfigId: order.channelConfig?.id ?? 'channel-pending',
    combinedRiskLevel: order.bundleRisk.level,
    createdAt,
    networkEnabled: order.items.some((item) => item.agentVersion.riskProfile.network),
    orderId: order.id,
    recipientExternalId: order.channelConfig?.recipientExternalId ?? null,
    runId,
    userId: order.userId,
    usesTools: order.items.some((item) => {
      const risk = item.agentVersion.riskProfile
      return risk.readFiles || risk.writeFiles || risk.shell
    }),
  }
}

function buildRunFromManifest(
  manifest: DaytonaRunManifest,
  status: DaytonaStatusFile,
  sandbox: Pick<DaytonaSandboxLike, 'createdAt'>,
): Run {
  return {
    id: manifest.runId,
    userId: manifest.userId,
    orderId: manifest.orderId,
    channelConfigId: manifest.channelConfigId,
    status: status.status,
    combinedRiskLevel: manifest.combinedRiskLevel,
    usesRealWorkspace: true,
    usesTools: manifest.usesTools,
    networkEnabled: manifest.networkEnabled,
    resultSummary: status.resultSummary,
    resultArtifacts: [],
    createdAt: manifest.createdAt ?? sandbox.createdAt ?? nowIso(),
    startedAt: status.startedAt,
    updatedAt: status.updatedAt,
    completedAt: status.completedAt,
  }
}

function buildInitialStatus(createdAt: string): DaytonaStatusFile {
  return {
    completedAt: null,
    resultSummary: null,
    startedAt: null,
    status: 'provisioning',
    updatedAt: createdAt,
  }
}

function buildReadySummary(orderId: string) {
  return `Managed runtime is ready for bundle ${orderId}. Open Control UI to continue.`
}

function buildRestartingSummary(orderId: string) {
  return `Managed runtime is restarting for bundle ${orderId}. Status will update automatically.`
}

function reconcileSandboxStatus(
  sandbox: Pick<DaytonaSandboxLike, 'state'>,
  status: DaytonaStatusFile,
): DaytonaStatusFile {
  const mappedStatus = mapSandboxStateToStatus(sandbox.state)

  if (mappedStatus !== 'failed') {
    return status
  }

  const terminalSummary =
    status.resultSummary &&
    status.resultSummary.trim().length > 0 &&
    !status.resultSummary.includes('Open Control UI')
      ? status.resultSummary
      : 'Managed runtime is no longer available.'
  const terminalAt = status.completedAt ?? nowIso()

  return {
    ...status,
    completedAt: terminalAt,
    resultSummary: terminalSummary,
    status: 'failed',
    updatedAt: nowIso(),
  }
}

function mapSandboxStateToStatus(state?: string): RunStatus {
  switch (state) {
    case SandboxState.STARTED:
      return 'running'
    case SandboxState.ERROR:
    case SandboxState.BUILD_FAILED:
    case SandboxState.DESTROYED:
    case SandboxState.DESTROYING:
    case SandboxState.STOPPED:
    case SandboxState.STOPPING:
    case SandboxState.ARCHIVED:
    case SandboxState.ARCHIVING:
      return 'failed'
    case SandboxState.CREATING:
    case SandboxState.STARTING:
    case SandboxState.PENDING_BUILD:
    case SandboxState.PULLING_SNAPSHOT:
    case SandboxState.BUILDING_SNAPSHOT:
    default:
      return 'provisioning'
  }
}

function shellQuote(value: string) {
  return `'${value.replaceAll("'", `'\"'\"'`)}'`
}

function isIgnoredWorkspaceEntry(name: string) {
  return name === '.git' || name === '.DS_Store'
}

async function collectWorkspaceFiles(
  rootDir: string,
  currentDir = rootDir,
): Promise<OpenClawTemplate['workspaceFiles']> {
  const entries = await fs.readdir(currentDir, { withFileTypes: true })
  const files: OpenClawTemplate['workspaceFiles'] = []

  for (const entry of entries) {
    if (isIgnoredWorkspaceEntry(entry.name)) {
      continue
    }

    const fullPath = path.join(currentDir, entry.name)

    if (entry.isDirectory()) {
      files.push(...(await collectWorkspaceFiles(rootDir, fullPath)))
      continue
    }

    if (!entry.isFile()) {
      continue
    }

    files.push({
      contents: await fs.readFile(fullPath),
      relativePath: path.relative(rootDir, fullPath).split(path.sep).join('/'),
      targetWorkspaceDir: null,
    })
  }

  return files
}

async function loadOpenClawTemplate(templateDir: string): Promise<OpenClawTemplate> {
  const configPath = path.join(templateDir, 'openclaw.json')
  const workspaceDir = path.join(templateDir, 'workspace')
  const config = await readOptionalJsonFile(configPath)
  let workspaceFiles: OpenClawTemplate['workspaceFiles'] = []

  try {
    await fs.access(workspaceDir)
    workspaceFiles = await collectWorkspaceFiles(workspaceDir)
  } catch {
    workspaceFiles = []
  }

  return {
    config,
    workspaceFiles: workspaceFiles.map((file) => ({
      ...file,
      targetWorkspaceDir: null,
    })),
  }
}

async function buildOrderRuntimeAssets(
  baseTemplate: OpenClawTemplate,
  order: Order,
  workspaceByAgentVersionId: Record<string, string>,
) {
  let config = baseTemplate.config
  const workspaceFilesByPath = new Map<string, OpenClawTemplate['workspaceFiles'][number]>()

  for (const file of baseTemplate.workspaceFiles) {
    workspaceFilesByPath.set(`default:${file.relativePath}`, file)
  }

  for (const item of order.items) {
    const assets = await loadRuntimeAssetsFromSnapshot(
      item.agentVersion.runConfigSnapshot,
      workspaceByAgentVersionId[item.agentVersion.id] ?? null,
    )
    if (Object.keys(assets.config).length > 0) {
      config = deepMerge(config, assets.config)
    }

    for (const file of assets.workspaceFiles) {
      workspaceFilesByPath.set(
        `${file.targetWorkspaceDir ?? 'default'}:${file.relativePath}`,
        file,
      )
    }
  }

  return {
    config,
    workspaceFiles: Array.from(workspaceFilesByPath.values()),
  } satisfies OpenClawTemplate
}

function buildBootstrapScript(input: {
  homeDir: string
  openClawPackage: string
  port: number
  workspaceDir: string
}) {
  return `#!/usr/bin/env bash
set -euo pipefail

ROOT=${shellQuote(DAYTONA_ROOT)}
STATUS_PATH=${shellQuote(STATUS_PATH)}
RESULT_PATH=${shellQuote(RESULT_PATH)}
LOG_PATH=${shellQuote(LOG_PATH)}
WORKSPACE_STAGE=${shellQuote(STAGED_WORKSPACE_ROOT)}
OPENCLAW_LOG=${shellQuote(OPENCLAW_GATEWAY_LOG_PATH)}
OPENCLAW_PID_PATH=${shellQuote(OPENCLAW_PID_PATH)}
HOME_DIR=${shellQuote(input.homeDir)}
OPENCLAW_DIR="$HOME_DIR/.openclaw"
WORKSPACE_DIR=${shellQuote(input.workspaceDir)}
PORT=${shellQuote(String(input.port))}
OPENCLAW_PACKAGE=${shellQuote(input.openClawPackage)}
ORDER_ID=""
STARTED_AT=""

now_iso() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

write_status() {
  STATUS_VALUE="$1" STARTED_VALUE="\${2:-}" COMPLETED_VALUE="\${3:-}" RESULT_SUMMARY_VALUE="\${4:-}" STATUS_FILE="$STATUS_PATH" node <<'NODE'
const fs = require('fs')
const payload = {
  status: process.env.STATUS_VALUE,
  startedAt: process.env.STARTED_VALUE || null,
  completedAt: process.env.COMPLETED_VALUE || null,
  updatedAt: new Date().toISOString(),
  resultSummary: process.env.RESULT_SUMMARY_VALUE || null,
}
fs.writeFileSync(process.env.STATUS_FILE, JSON.stringify(payload))
NODE
}

write_result() {
  RESULT_SUMMARY_VALUE="$1" RESULT_FILE="$RESULT_PATH" node <<'NODE'
const fs = require('fs')
const payload = {
  summary: process.env.RESULT_SUMMARY_VALUE,
  artifacts: [],
}
fs.writeFileSync(process.env.RESULT_FILE, JSON.stringify(payload))
NODE
}

append_log() {
  local level="$1"
  local step="$2"
  local message="$3"
  printf '%s|%s|%s|%s\\n' "$(now_iso)" "$level" "$step" "$message" >> "$LOG_PATH"
}

fail_run() {
  local message="$1"
  if [ -f "$OPENCLAW_LOG" ]; then
    local tail_output
    tail_output=$(tail -n 20 "$OPENCLAW_LOG" | tr '\n' ' ' | sed 's/[[:space:]]\\+/ /g')
    if [ -n "$tail_output" ]; then
      message="$message Gateway log tail: $tail_output"
    fi
  fi
  append_log error crash "$message"
  write_status failed "$STARTED_AT" "$(now_iso)" "$message"
  write_result "$message"
  exit 1
}

trap 'fail_run "Managed runtime bootstrap failed."' ERR

ORDER_ID=$(node -e "const fs=require('fs'); const payload=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); process.stdout.write(payload.orderId);" "$ROOT/manifest.json")
STARTED_AT=$(now_iso)

append_log info bootstrap "Provisioning managed runtime for order $ORDER_ID."
mkdir -p "$ROOT" "$OPENCLAW_DIR" "$WORKSPACE_DIR"
if [ -d "$WORKSPACE_STAGE" ] && [ -z "$(find "$WORKSPACE_DIR" -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null)" ]; then
  cp -R "$WORKSPACE_STAGE/." "$WORKSPACE_DIR/"
fi
write_status provisioning "$STARTED_AT" "" ""

append_log info install "Checking managed runtime dependencies."
if ! command -v openclaw >/dev/null 2>&1; then
  command -v node >/dev/null 2>&1 || fail_run "Node.js is required inside the managed runtime."
  command -v npm >/dev/null 2>&1 || fail_run "npm is required inside the managed runtime."
  npm install -g "$OPENCLAW_PACKAGE" >> "$OPENCLAW_LOG" 2>&1
fi

append_log info gateway "Starting Control UI service."
nohup openclaw gateway run >> "$OPENCLAW_LOG" 2>&1 &
echo $! > "$OPENCLAW_PID_PATH"

for _ in $(seq 1 90); do
  if (echo > /dev/tcp/127.0.0.1/"$PORT") >/dev/null 2>&1; then
    READY_SUMMARY="Managed runtime is ready for bundle $ORDER_ID. Open Control UI to continue."
    append_log info ready "Managed runtime is ready for Control UI access."
    write_status completed "$STARTED_AT" "$(now_iso)" "$READY_SUMMARY"
    write_result "$READY_SUMMARY"
    exit 0
  fi
  sleep 2
done

fail_run "Managed runtime started but the Control UI port did not become ready in time."
`
}

function parseLogLine(line: string): RunLog | null {
  if (!line.trim()) {
    return null
  }

  const parts = line.split('|')
  if (parts.length < 4) {
    return {
      timestamp: nowIso(),
      level: 'info',
      step: 'output',
      message: line,
    }
  }

  const [timestamp, level, step, ...messageParts] = parts

  return {
    timestamp,
    level: level as RunLog['level'],
    step,
    message: messageParts.join('|'),
  }
}

function isNotFoundError(error: unknown) {
  if (error instanceof DaytonaNotFoundError) {
    return true
  }

  const candidate = error as {
    message?: string
    name?: string
    response?: { status?: number }
    status?: number
    statusCode?: number
  }
  return (
    candidate?.response?.status === 404 ||
    candidate?.status === 404 ||
    candidate?.statusCode === 404 ||
    candidate?.name === 'DaytonaNotFoundError' ||
    candidate?.message?.includes('404') ||
    candidate?.message?.toLowerCase().includes('not found')
  )
}

async function downloadJsonFile<T>(sandbox: DaytonaSandboxLike, filePath: string): Promise<T | null> {
  try {
    const buffer = await sandbox.fs.downloadFile(filePath)
    return JSON.parse(buffer.toString('utf8')) as T
  } catch (error) {
    if (isNotFoundError(error)) {
      return null
    }

    throw error
  }
}

async function downloadTextFile(sandbox: DaytonaSandboxLike, filePath: string) {
  try {
    const buffer = await sandbox.fs.downloadFile(filePath)
    return buffer.toString('utf8')
  } catch (error) {
    if (isNotFoundError(error)) {
      return ''
    }

    throw error
  }
}

async function writeJsonFile(
  sandbox: DaytonaSandboxLike,
  filePath: string,
  payload: Record<string, unknown>,
) {
  await sandbox.fs.uploadFile(Buffer.from(JSON.stringify(payload), 'utf8'), filePath)
}

async function appendStructuredLog(
  sandbox: DaytonaSandboxLike,
  level: RunLog['level'],
  step: string,
  message: string,
) {
  const response = await sandbox.process.executeCommand(
    `bash -lc ${shellQuote(
      `printf '%s|${level}|${step}|${message.replaceAll("'", `'\"'\"'`)}\\n' '${nowIso()}' >> ${LOG_PATH}`,
    )}`,
    undefined,
    undefined,
    20,
  )

  if (response.exitCode !== 0) {
    throw new HttpError(502, response.result.trim() || 'Managed runtime log update failed.')
  }
}

async function startBootstrapScript(sandbox: DaytonaSandboxLike) {
  const launch = await sandbox.process.executeCommand(
    `bash -lc ${shellQuote(
      `chmod +x ${BOOTSTRAP_SCRIPT_PATH} && nohup ${BOOTSTRAP_SCRIPT_PATH} >/dev/null 2>&1 &`,
    )}`,
    undefined,
    undefined,
    20,
  )

  if (launch.exitCode !== 0) {
    throw new HttpError(502, launch.result.trim() || 'Managed runtime bootstrap failed to start.')
  }
}

async function resolveUserHomeDir(sandbox: DaytonaSandboxLike) {
  return (await sandbox.getUserHomeDir?.()) ?? '/home/daytona'
}

async function refreshGatewayStatus(
  sandbox: DaytonaSandboxLike,
  status: DaytonaStatusFile,
  manifest: DaytonaRunManifest,
): Promise<DaytonaStatusFile> {
  const shouldProbe =
    status.status === 'running' ||
    (status.status === 'failed' &&
      (status.resultSummary?.includes('Managed runtime bootstrap failed.') ?? false))

  if (!shouldProbe) {
    return status
  }

  const probe = await sandbox.process.executeCommand(
    `bash -lc ${shellQuote(
      `if [ -f ${OPENCLAW_PID_PATH} ] && kill -0 "$(cat ${OPENCLAW_PID_PATH})" 2>/dev/null; then echo running; else echo exited; fi`,
    )}`,
    undefined,
    undefined,
    20,
  )

  if (probe.exitCode !== 0) {
    return status
  }

  if (probe.result.trim() === 'running') {
    const upgradedStatus: DaytonaStatusFile = {
      ...status,
      resultSummary: buildReadySummary(manifest.orderId),
      completedAt: status.completedAt ?? nowIso(),
      status: 'completed',
      updatedAt: nowIso(),
    }

    await writeJsonFile(sandbox, STATUS_PATH, upgradedStatus)
    await writeJsonFile(sandbox, RESULT_PATH, {
      artifacts: [],
      summary: upgradedStatus.resultSummary,
    })

    return upgradedStatus
  }

  const failedAt = nowIso()
  const nextStatus: DaytonaStatusFile = {
    completedAt: failedAt,
    resultSummary: 'Managed runtime stopped unexpectedly.',
    startedAt: status.startedAt,
    status: 'failed',
    updatedAt: failedAt,
  }

  await writeJsonFile(sandbox, STATUS_PATH, nextStatus)
  await writeJsonFile(sandbox, RESULT_PATH, {
    artifacts: [],
    summary: nextStatus.resultSummary,
  })
  await appendStructuredLog(sandbox, 'error', 'runtime', 'Managed runtime stopped unexpectedly.')

  return nextStatus
}

function buildControlUiUrl(previewUrl: string, openClawToken: string) {
  const url = new URL(previewUrl)
  url.searchParams.set('token', openClawToken)
  return url.toString()
}

type OpenClawConfigShape = {
  agents?: {
    defaults?: {
      workspace?: string
    }
    list?: Array<{
      default?: boolean
      id?: string
      name?: string
      workspace?: string
    }>
  }
  gateway?: {
    auth?: {
      token?: string
    }
    port?: number
  }
}

function resolveOpenClawWorkspaceDir(config: OpenClawConfigShape, homeDir: string) {
  const listedWorkspace =
    config.agents?.list?.find((agent) => agent.default && agent.workspace?.trim())?.workspace?.trim() ??
    config.agents?.list?.find((agent) => agent.workspace?.trim())?.workspace?.trim()
  const configuredWorkspace = config.agents?.defaults?.workspace?.trim()
  const effectiveWorkspace = listedWorkspace || configuredWorkspace

  if (!effectiveWorkspace) {
    return `${homeDir}/.openclaw/workspace`
  }

  if (effectiveWorkspace.startsWith('~/')) {
    return path.posix.join(homeDir, effectiveWorkspace.slice(2))
  }

  if (effectiveWorkspace === '~') {
    return homeDir
  }

  return effectiveWorkspace
}

function deepMerge<T>(target: T, source: Record<string, unknown>): T {
  const output = { ...target } as Record<string, unknown>

  for (const key of Object.keys(source)) {
    const left = output[key]
    const right = source[key]

    if (
      left != null &&
      right != null &&
      typeof left === 'object' &&
      typeof right === 'object' &&
      !Array.isArray(left) &&
      !Array.isArray(right)
    ) {
      output[key] = deepMerge(left as Record<string, unknown>, right as Record<string, unknown>)
      continue
    }

    output[key] = right
  }

  return output as T
}

async function readOptionalJsonFile(filePath: string) {
  try {
    const contents = await fs.readFile(filePath, 'utf8')
    return JSON.parse(contents) as Record<string, unknown>
  } catch (error) {
    const candidate = error as NodeJS.ErrnoException
    if (candidate.code === 'ENOENT') {
      return {}
    }

    throw error
  }
}

async function readOptionalEnvFile(filePath: string) {
  try {
    const contents = await fs.readFile(filePath, 'utf8')
    return Object.fromEntries(
      contents
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'))
        .map((line) => {
          const separatorIndex = line.indexOf('=')

          if (separatorIndex === -1) {
            return [line, '']
          }

          const key = line.slice(0, separatorIndex).trim()
          let value = line.slice(separatorIndex + 1).trim()

          if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
          ) {
            value = value.slice(1, -1)
          }

          return [key, value]
        }),
    )
  } catch (error) {
    const candidate = error as NodeJS.ErrnoException
    if (candidate.code === 'ENOENT') {
      return {}
    }

    throw error
  }
}

function resolveDaytonaSnapshot() {
  return process.env.DAYTONA_SNAPSHOT ?? DEFAULT_DAYTONA_SNAPSHOT
}

function resolveEnvSandboxPath() {
  return path.resolve(process.cwd(), process.env.DAYTONA_ENV_SANDBOX_PATH ?? DEFAULT_ENV_SANDBOX_PATH)
}

function buildOpenClawConfig(
  userConfig: Record<string, unknown>,
  gatewayToken: string,
  openClawPort: number,
  telegramChannelConfig?: Record<string, unknown> | null,
  agentDefaultsConfig?: Record<string, unknown> | null,
  agentListConfig?: Array<Record<string, unknown>> | null,
  multiAgentToolsConfig?: Record<string, unknown> | null,
  skipBootstrap = false,
) {
  const config = deepMerge(OPENCLAW_BASE_CONFIG, userConfig)
  let runtimeConfig = deepMerge(config, {
    gateway: {
      auth: {
        mode: 'token',
        token: gatewayToken,
      },
      bind: 'lan',
      controlUi: {
        allowInsecureAuth: true,
      },
      mode: 'local',
      port: openClawPort,
    },
  })

  if (agentDefaultsConfig) {
    runtimeConfig = deepMerge(runtimeConfig, {
      agents: {
        defaults: agentDefaultsConfig,
      },
    })
  }

  if (skipBootstrap) {
    runtimeConfig = deepMerge(runtimeConfig, {
      agents: {
        defaults: {
          skipBootstrap: true,
        },
      },
    })
  }

  if (agentListConfig && agentListConfig.length > 0) {
    runtimeConfig = deepMerge(runtimeConfig, {
      agents: {
        list: agentListConfig,
      },
    })
  }

  if (multiAgentToolsConfig) {
    runtimeConfig = deepMerge(runtimeConfig, {
      tools: multiAgentToolsConfig,
    })
  }

  if (!telegramChannelConfig) {
    return runtimeConfig
  }

  return deepMerge(runtimeConfig, {
    channels: {
      telegram: telegramChannelConfig,
    },
  })
}

const OPENCLAW_BOOTSTRAP_FILES = new Set([
  'AGENTS.md',
  'SOUL.md',
  'TOOLS.md',
  'IDENTITY.md',
  'USER.md',
  'HEARTBEAT.md',
  'BOOTSTRAP.md',
])

function shouldSkipOpenClawBootstrap(
  workspaceFiles: Array<{
    relativePath: string
  }>,
) {
  return workspaceFiles.some((file) => {
    const basename = path.posix.basename(file.relativePath)
    return OPENCLAW_BOOTSTRAP_FILES.has(basename)
  })
}

function buildOpenClawAgentDefaultsConfig(agentSetup?: AgentSetup | null) {
  if (!agentSetup) {
    return null
  }

  const defaults: Record<string, unknown> = {}

  if (agentSetup.timeFormat) {
    defaults.timeFormat = agentSetup.timeFormat
  }

  if (agentSetup.modelPrimary || agentSetup.modelFallbacks.length > 0) {
    defaults.model = {
      ...(agentSetup.modelPrimary ? { primary: agentSetup.modelPrimary } : {}),
      ...(agentSetup.modelFallbacks.length > 0 ? { fallbacks: agentSetup.modelFallbacks } : {}),
    }
  }

  if (agentSetup.subagentsMaxConcurrent) {
    defaults.subagents = {
      maxConcurrent: agentSetup.subagentsMaxConcurrent,
    }
  }

  return Object.keys(defaults).length > 0 ? defaults : null
}

function buildAgentWorkspacePath(baseWorkspace: string | null | undefined, slug: string, homeDir: string) {
  const safeSlug = slug.replace(/[^a-z0-9-]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase()
  const base = baseWorkspace?.trim() || '~/.openclaw/workspace'

  if (base === '~') {
    return path.posix.join(homeDir, safeSlug)
  }

  if (base.startsWith('~/')) {
    return path.posix.join(homeDir, `${base.slice(2)}-${safeSlug}`)
  }

  return `${base}-${safeSlug}`
}

function buildAgentDirPath(slug: string, homeDir: string) {
  const safeSlug = slug.replace(/[^a-z0-9-]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase()
  return path.posix.join(homeDir, '.openclaw', 'agents', safeSlug, 'agent')
}

function buildAgentSessionsPath(slug: string, homeDir: string) {
  const safeSlug = slug.replace(/[^a-z0-9-]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase()
  return path.posix.join(homeDir, '.openclaw', 'agents', safeSlug, 'sessions')
}

function buildOpenClawAgentsListConfig(
  order: Order,
  homeDir: string,
  agentSetup?: AgentSetup | null,
) {
  const agentIds = order.items.map((item) => item.agent.slug)
  const workspaceBase = agentSetup?.workspace
  const agentDirByAgentVersionId: Record<string, string> = {}
  const agentSessionsByAgentVersionId: Record<string, string> = {}
  const workspaceByAgentVersionId: Record<string, string> = {}
  const list = order.items.map((item, index) => {
    const workspace = buildAgentWorkspacePath(workspaceBase, item.agent.slug, homeDir)
    const agentDir = buildAgentDirPath(item.agent.slug, homeDir)
    const sessionDir = buildAgentSessionsPath(item.agent.slug, homeDir)
    agentDirByAgentVersionId[item.agentVersion.id] = agentDir
    agentSessionsByAgentVersionId[item.agentVersion.id] = sessionDir
    workspaceByAgentVersionId[item.agentVersion.id] = workspace

    return {
      agentDir,
      default: index === 0,
      id: item.agent.slug,
      name: item.agent.title,
      ...(agentIds.length > 1
        ? {
            subagents: {
              allowAgents: agentIds,
            },
          }
        : {}),
      workspace,
    }
  })

  return {
    agentDirByAgentVersionId,
    agentSessionsByAgentVersionId,
    list,
    workspaceByAgentVersionId,
  }
}

function buildOpenClawMultiAgentToolsConfig(order: Order) {
  const agentIds = [...new Set(order.items.map((item) => item.agent.slug))]

  if (agentIds.length <= 1) {
    return null
  }

  return {
    agentToAgent: {
      allow: agentIds,
      enabled: true,
    },
  }
}

export class DaytonaRunProvider implements RunProvider {
  readonly name = 'daytona'

  private readonly client: DaytonaClientLike
  private readonly daytonaSnapshot: string
  private readonly envSandboxPath: string
  private readonly openClawPort: number
  private readonly openClawTemplateDir: string
  private readonly openClawPackage: string

  constructor(options: DaytonaRunProviderOptions = {}) {
    const config: DaytonaConfig = {
      apiKey: resolveDaytonaApiKey(options.apiKey),
      apiUrl: options.apiUrl ?? process.env.DAYTONA_API_URL ?? 'https://app.daytona.io/api',
      target: options.target ?? process.env.DAYTONA_TARGET,
    }

    this.client = options.clientFactory ? options.clientFactory(config) : new Daytona(config)
    this.daytonaSnapshot = resolveDaytonaSnapshot()
    this.envSandboxPath = resolveEnvSandboxPath()
    this.openClawPort = resolveOpenClawPort(options.openClawPort)
    this.openClawTemplateDir = resolveOpenClawTemplateDir(options.openClawTemplateDir)
    this.openClawPackage = process.env.OPENCLAW_PACKAGE ?? DEFAULT_OPENCLAW_PACKAGE
  }

  async createRun(order: Order, runId = `run-${Date.now()}`): Promise<Run> {
    const createdAt = nowIso()
    const gatewayToken = randomBytes(24).toString('hex')
    const envVars = await readOptionalEnvFile(this.envSandboxPath)
    const sandbox = await this.client.create(
      {
        autoArchiveInterval: 60,
        autoDeleteInterval: 120,
        autoStopInterval: 0,
        envVars,
        ephemeral: false,
        labels: {
          app: 'agent-roster',
          orderId: order.id,
          runId,
        },
        name: runId,
        networkBlockAll: !order.items.some((item) => item.agentVersion.riskProfile.network),
        public: true,
        snapshot: this.daytonaSnapshot,
      },
      { timeout: 90 },
    )

    const homeDir = await resolveUserHomeDir(sandbox)
    const { agentDirByAgentVersionId, agentSessionsByAgentVersionId, list: agentListConfig, workspaceByAgentVersionId } = buildOpenClawAgentsListConfig(
      order,
      homeDir,
      order.agentSetup ?? null,
    )
    const manifest = buildManifest(order, runId, createdAt, workspaceByAgentVersionId)
    const template = await buildOrderRuntimeAssets(
      await loadOpenClawTemplate(this.openClawTemplateDir),
      order,
      workspaceByAgentVersionId,
    )
    const telegramChannelConfig = await buildOpenClawTelegramChannelConfig(order.channelConfig)
    const agentDefaultsConfig = buildOpenClawAgentDefaultsConfig(order.agentSetup ?? null)
    const multiAgentToolsConfig = buildOpenClawMultiAgentToolsConfig(order)
    const skipBootstrap = shouldSkipOpenClawBootstrap(template.workspaceFiles)
    const openClawConfig = buildOpenClawConfig(
      template.config,
      gatewayToken,
      this.openClawPort,
      telegramChannelConfig,
      agentDefaultsConfig,
      agentListConfig,
      multiAgentToolsConfig,
      skipBootstrap,
    )
    const workspaceDir = resolveOpenClawWorkspaceDir(openClawConfig, homeDir)
    const bootstrapScript = buildBootstrapScript({
      homeDir,
      openClawPackage: this.openClawPackage,
      port: this.openClawPort,
      workspaceDir,
    })

    await sandbox.process.executeCommand(
      `bash -lc ${shellQuote(
        `mkdir -p ${DAYTONA_ROOT} ${STAGED_WORKSPACE_ROOT} ${homeDir}/.openclaw ${[
          workspaceDir,
          ...Object.values(agentDirByAgentVersionId),
          ...Object.values(agentSessionsByAgentVersionId),
          ...Object.values(workspaceByAgentVersionId),
        ].join(' ')}`,
      )}`,
      undefined,
      undefined,
      20,
    )
    await sandbox.fs.uploadFile(
      Buffer.from(JSON.stringify(openClawConfig, null, 2), 'utf8'),
      `${homeDir}/${OPENCLAW_CONFIG_PATH}`,
    )
    await sandbox.fs.uploadFile(Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'), MANIFEST_PATH)
    await sandbox.fs.uploadFile(
      Buffer.from(JSON.stringify(buildInitialStatus(createdAt), null, 2), 'utf8'),
      STATUS_PATH,
    )
    await sandbox.fs.uploadFile(
      Buffer.from(
        JSON.stringify(
          {
            artifacts: [],
            summary: 'Managed runtime is provisioning. Control UI will be available when setup completes.',
          } satisfies RunResult,
          null,
          2,
        ),
        'utf8',
      ),
      RESULT_PATH,
    )
    await sandbox.fs.uploadFile(Buffer.from(bootstrapScript, 'utf8'), BOOTSTRAP_SCRIPT_PATH)

    for (const file of template.workspaceFiles) {
      if (file.targetWorkspaceDir) {
        await sandbox.fs.uploadFile(file.contents, `${file.targetWorkspaceDir}/${file.relativePath}`)
        continue
      }

      await sandbox.fs.uploadFile(file.contents, `${STAGED_WORKSPACE_ROOT}/${file.relativePath}`)
    }

    await startBootstrapScript(sandbox)

    return buildRunFromManifest(manifest, buildInitialStatus(createdAt), sandbox)
  }

  async getStatus(runId: string): Promise<Run | null> {
    const sandbox = await this.getSandbox(runId)

    if (!sandbox) {
      return null
    }

    const manifest = await downloadJsonFile<DaytonaRunManifest>(sandbox, MANIFEST_PATH)

    if (!manifest) {
      return null
    }

    const fileStatus = await downloadJsonFile<DaytonaStatusFile>(sandbox, STATUS_PATH)
    const status = await refreshGatewayStatus(
      sandbox,
      reconcileSandboxStatus(
        sandbox,
        fileStatus ??
          ({
            completedAt: null,
            resultSummary: null,
            startedAt:
              sandbox.state === SandboxState.STARTED ? sandbox.createdAt ?? manifest.createdAt : null,
            status: mapSandboxStateToStatus(sandbox.state),
            updatedAt: sandbox.createdAt ?? manifest.createdAt,
          } satisfies DaytonaStatusFile),
      ),
      manifest,
    )

    return buildRunFromManifest(manifest, status, sandbox)
  }

  async getLogs(runId: string): Promise<RunLog[]> {
    const sandbox = await this.getSandbox(runId)

    if (!sandbox) {
      return []
    }

    const output = await downloadTextFile(sandbox, LOG_PATH)

    return output
      .split('\n')
      .map((line) => parseLogLine(line))
      .filter((log): log is RunLog => Boolean(log))
  }

  async getResult(runId: string): Promise<RunResult | null> {
    const sandbox = await this.getSandbox(runId)

    if (!sandbox) {
      return null
    }

    return downloadJsonFile<RunResult>(sandbox, RESULT_PATH)
  }

  async getControlUiLink(
    runId: string,
    expiresInSeconds = DEFAULT_PREVIEW_TTL_SECONDS,
  ): Promise<RunControlUiLink | null> {
    const sandbox = await this.getSandbox(runId)

    if (!sandbox) {
      return null
    }

    const homeDir = await resolveUserHomeDir(sandbox)
    const config = await downloadJsonFile<OpenClawConfigShape>(
      sandbox,
      `${homeDir}/.openclaw/openclaw.json`,
    )
    const openClawToken = config?.gateway?.auth?.token
    const openClawPort = config?.gateway?.port ?? this.openClawPort

    if (!openClawToken) {
      throw new HttpError(409, 'Control UI token is not ready yet.')
    }

    const preview =
      (await sandbox.getSignedPreviewUrl?.(openClawPort, expiresInSeconds)) ??
      (await sandbox.getPreviewLink?.(openClawPort))

    if (!preview?.url) {
      throw new HttpError(503, 'Unable to generate a Control UI link for this run.')
    }

    return {
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
      url: buildControlUiUrl(preview.url, openClawToken),
    }
  }

  async restartRun(runId: string, order: Order, fallbackRun?: Run): Promise<Run | null> {
    const sandbox = await this.getSandbox(runId)

    if (!sandbox) {
      return null
    }

    if (sandbox.start) {
      await sandbox.start(60)
    }

    const homeDir = await resolveUserHomeDir(sandbox)
    const manifest = await downloadJsonFile<DaytonaRunManifest>(sandbox, MANIFEST_PATH)
    const telegramChannelConfig = await buildOpenClawTelegramChannelConfig(order.channelConfig)
    const agentDefaultsConfig = buildOpenClawAgentDefaultsConfig(order.agentSetup ?? null)
    const { agentDirByAgentVersionId, agentSessionsByAgentVersionId, list: agentListConfig, workspaceByAgentVersionId } = buildOpenClawAgentsListConfig(
      order,
      homeDir,
      order.agentSetup ?? null,
    )
    const template = await buildOrderRuntimeAssets(
      await loadOpenClawTemplate(this.openClawTemplateDir),
      order,
      workspaceByAgentVersionId,
    )
    const multiAgentToolsConfig = buildOpenClawMultiAgentToolsConfig(order)
    const skipBootstrap = shouldSkipOpenClawBootstrap(template.workspaceFiles)
    const openClawConfig = buildOpenClawConfig(
      template.config,
      randomBytes(24).toString('hex'),
      this.openClawPort,
      telegramChannelConfig,
      agentDefaultsConfig,
      agentListConfig,
      multiAgentToolsConfig,
      skipBootstrap,
    )
    const workspaceDir = resolveOpenClawWorkspaceDir(openClawConfig, homeDir)
    const restartedAt = nowIso()
    const restartingStatus: DaytonaStatusFile = {
      completedAt: null,
      resultSummary: buildRestartingSummary(
        manifest?.orderId ?? fallbackRun?.orderId ?? 'unknown-order',
      ),
      startedAt: restartedAt,
      status: 'provisioning',
      updatedAt: restartedAt,
    }

    await sandbox.fs.uploadFile(
      Buffer.from(JSON.stringify(openClawConfig, null, 2), 'utf8'),
      `${homeDir}/${OPENCLAW_CONFIG_PATH}`,
    )
    await sandbox.process.executeCommand(
      `bash -lc ${shellQuote(
        `mkdir -p ${[
          workspaceDir,
          ...Object.values(agentDirByAgentVersionId),
          ...Object.values(agentSessionsByAgentVersionId),
          ...Object.values(workspaceByAgentVersionId),
        ].join(' ')}`,
      )}`,
      undefined,
      undefined,
      20,
    )
    await sandbox.fs.uploadFile(
      Buffer.from(
        buildBootstrapScript({
          homeDir,
          openClawPackage: this.openClawPackage,
          port: this.openClawPort,
          workspaceDir,
        }),
        'utf8',
      ),
      BOOTSTRAP_SCRIPT_PATH,
    )
    for (const file of template.workspaceFiles) {
      if (file.targetWorkspaceDir) {
        await sandbox.fs.uploadFile(file.contents, `${file.targetWorkspaceDir}/${file.relativePath}`)
        continue
      }

      await sandbox.fs.uploadFile(file.contents, `${STAGED_WORKSPACE_ROOT}/${file.relativePath}`)
    }
    await writeJsonFile(sandbox, STATUS_PATH, restartingStatus)
    await writeJsonFile(sandbox, RESULT_PATH, {
      artifacts: [],
      summary: restartingStatus.resultSummary,
    })
    await appendStructuredLog(sandbox, 'info', 'restart', 'Managed runtime restart requested.')
    await startBootstrapScript(sandbox)

    if (manifest) {
      return buildRunFromManifest(manifest, restartingStatus, sandbox)
    }

    if (fallbackRun) {
      return {
        ...fallbackRun,
        completedAt: null,
        resultSummary: restartingStatus.resultSummary,
        startedAt: restartedAt,
        status: 'provisioning',
        updatedAt: restartedAt,
      }
    }

    return null
  }

  async stopRun(runId: string, fallbackRun?: Run): Promise<Run | null> {
    const sandbox = await this.getSandbox(runId)
    if (!sandbox) {
      if (!fallbackRun) {
        return null
      }

      const stoppedAt = nowIso()
      return {
        ...fallbackRun,
        completedAt: stoppedAt,
        resultSummary: 'Run stopped by operator request.',
        status: 'failed',
        updatedAt: stoppedAt,
      }
    }

    const cancelledAt = nowIso()
    const cancelledStatus: DaytonaStatusFile = {
      completedAt: cancelledAt,
      resultSummary: 'Run stopped by operator request.',
      startedAt: cancelledAt,
      status: 'failed',
      updatedAt: cancelledAt,
    }

    let manifest: DaytonaRunManifest | null = null
    try {
      manifest = await downloadJsonFile<DaytonaRunManifest>(sandbox, MANIFEST_PATH)
    } catch (error) {
      logServerError('provider/daytona:stopRun:manifest', error, {
        runId,
        sandboxId: sandbox.id,
        sandboxState: sandbox.state,
      })
    }

    if (manifest) {
      try {
        await writeJsonFile(sandbox, STATUS_PATH, cancelledStatus)
        await writeJsonFile(sandbox, RESULT_PATH, {
          artifacts: [],
          summary: 'Run stopped by operator request.',
        })
        await appendStructuredLog(sandbox, 'warn', 'cancel', 'Run stopped by operator request.')
      } catch (error) {
        logServerError('provider/daytona:stopRun:write_state', error, {
          runId,
          sandboxId: sandbox.id,
          sandboxState: sandbox.state,
        })
      }
    }

    try {
      if (sandbox.stop) {
        await sandbox.stop(60)
      } else if (sandbox.delete) {
        await sandbox.delete(60)
      }
    } catch (error) {
      logServerError('provider/daytona:stopRun', error, {
        runId,
        sandboxId: sandbox.id,
        sandboxState: sandbox.state,
      })
      const candidate = error as { message?: string; status?: number; statusCode?: number }
      throw new HttpError(
        502,
        candidate?.message?.trim() || 'Managed runtime sandbox shutdown failed.',
      )
    }

    if (manifest) {
      return buildRunFromManifest(manifest, cancelledStatus, sandbox)
    }

    if (fallbackRun) {
      return {
        ...fallbackRun,
        completedAt: cancelledAt,
        resultSummary: 'Run stopped by operator request.',
        status: 'failed',
        updatedAt: cancelledAt,
      }
    }

    return null
  }

  private async getSandbox(runId: string) {
    try {
      return await this.client.get(runId)
    } catch (error) {
      if (isNotFoundError(error)) {
        return null
      }

      throw error
    }
  }
}
