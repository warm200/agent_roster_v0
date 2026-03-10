import {
  Daytona,
  DaytonaNotFoundError,
  type DaytonaConfig,
  type Sandbox,
  SandboxState,
} from '@daytonaio/sdk'

import type { Order, Run, RunLog, RunResult, RunStatus } from '@/lib/types'

import { HttpError } from '../lib/http'
import type { RunProvider } from './run-provider.interface'

type DaytonaRunManifest = {
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

type DaytonaSandboxLike = Pick<Sandbox, 'createdAt' | 'errorReason' | 'id' | 'state'> & {
  fs: DaytonaFsLike
  process: DaytonaProcessLike
}

const DAYTONA_ROOT = '/tmp/agent-roster'
const MANIFEST_PATH = `${DAYTONA_ROOT}/manifest.json`
const STATUS_PATH = `${DAYTONA_ROOT}/status.json`
const RESULT_PATH = `${DAYTONA_ROOT}/result.json`
const LOG_PATH = `${DAYTONA_ROOT}/run.log`
const SCRIPT_PATH = `${DAYTONA_ROOT}/runner.py`

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

function buildManifest(order: Order, runId: string, createdAt: string): DaytonaRunManifest {
  return {
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

function mapSandboxStateToStatus(state?: string): RunStatus {
  switch (state) {
    case SandboxState.STARTED:
      return 'running'
    case SandboxState.ERROR:
    case SandboxState.BUILD_FAILED:
    case SandboxState.DESTROYED:
    case SandboxState.DESTROYING:
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

function buildBootstrapScript() {
  return `#!/usr/bin/env python3
import json
from datetime import datetime, timezone
from pathlib import Path
import time
import traceback

ROOT = Path("${DAYTONA_ROOT}")
MANIFEST_PATH = ROOT / "manifest.json"
STATUS_PATH = ROOT / "status.json"
RESULT_PATH = ROOT / "result.json"

def now_iso():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

def append_log(level, step, message):
    print(f"{now_iso()}|{level}|{step}|{message}", flush=True)

def write_status(status, started_at=None, completed_at=None, result_summary=None):
    payload = {
        "status": status,
        "startedAt": started_at,
        "completedAt": completed_at,
        "updatedAt": now_iso(),
        "resultSummary": result_summary,
    }
    STATUS_PATH.write_text(json.dumps(payload), encoding="utf-8")

def main():
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    started_at = now_iso()
    write_status("running", started_at=started_at)
    append_log("info", "bootstrap", f"Sandbox ready for order {manifest['orderId']}.")
    time.sleep(1)
    append_log("info", "channel", f"Telegram recipient: {manifest['recipientExternalId'] or 'pending pairing record'}")
    time.sleep(1)

    for title in manifest["agentTitles"]:
        append_log("info", "agent", f"Prepared {title} inside managed Daytona workspace.")
        time.sleep(1)

    summary = "Daytona workspace completed bundle " + manifest["orderId"] + ". Agents prepared: " + ", ".join(manifest["agentTitles"]) + ". Next step: review Telegram-triggered outputs and exported package artifacts."
    RESULT_PATH.write_text(json.dumps({"summary": summary, "artifacts": []}), encoding="utf-8")
    write_status("completed", started_at=started_at, completed_at=now_iso(), result_summary=summary)
    append_log("info", "complete", "Run completed successfully in Daytona.")

if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        error = f"{type(exc).__name__}: {exc}"
        append_log("error", "crash", error)
        append_log("debug", "traceback", traceback.format_exc().strip().replace("\\n", " | "))
        write_status("failed", started_at=now_iso(), completed_at=now_iso(), result_summary=error)
        raise
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

async function downloadJsonFile<T>(
  sandbox: DaytonaSandboxLike,
  path: string,
): Promise<T | null> {
  try {
    const buffer = await sandbox.fs.downloadFile(path)
    return JSON.parse(buffer.toString('utf8')) as T
  } catch (error) {
    if (isNotFoundError(error)) {
      return null
    }

    throw error
  }
}

async function downloadTextFile(sandbox: DaytonaSandboxLike, path: string) {
  try {
    const buffer = await sandbox.fs.downloadFile(path)
    return buffer.toString('utf8')
  } catch (error) {
    if (isNotFoundError(error)) {
      return ''
    }

    throw error
  }
}

export class DaytonaRunProvider implements RunProvider {
  readonly name = 'daytona'

  private readonly client: DaytonaClientLike

  constructor(options: DaytonaRunProviderOptions = {}) {
    const config: DaytonaConfig = {
      apiKey: resolveDaytonaApiKey(options.apiKey),
      apiUrl: options.apiUrl ?? process.env.DAYTONA_API_URL ?? 'https://app.daytona.io/api',
      target: options.target ?? process.env.DAYTONA_TARGET,
    }

    this.client = options.clientFactory ? options.clientFactory(config) : new Daytona(config)
  }

  async createRun(order: Order): Promise<Run> {
    const createdAt = nowIso()
    const runId = `run-${Date.now()}`
    const manifest = buildManifest(order, runId, createdAt)

    const sandbox = await this.client.create(
      {
        autoArchiveInterval: 60,
        autoDeleteInterval: 120,
        autoStopInterval: 30,
        ephemeral: false,
        labels: {
          app: 'agent-roster',
          orderId: order.id,
          runId,
        },
        language: 'python',
        name: runId,
        networkBlockAll: !manifest.networkEnabled,
      },
      { timeout: 90 },
    )

    await sandbox.fs.uploadFile(Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'), MANIFEST_PATH)
    await sandbox.fs.uploadFile(
      Buffer.from(JSON.stringify(buildInitialStatus(createdAt), null, 2), 'utf8'),
      STATUS_PATH,
    )
    await sandbox.fs.uploadFile(Buffer.from(buildBootstrapScript(), 'utf8'), SCRIPT_PATH)

    const launch = await sandbox.process.executeCommand(
      `bash -lc ${shellQuote(
        `mkdir -p ${DAYTONA_ROOT} && nohup python3 ${SCRIPT_PATH} > ${LOG_PATH} 2>&1 &`,
      )}`,
      undefined,
      undefined,
      20,
    )

    if (launch.exitCode !== 0) {
      throw new HttpError(502, launch.result.trim() || 'Daytona failed to start the sandbox run.')
    }

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
    const status =
      fileStatus ??
      ({
        completedAt: null,
        resultSummary: null,
        startedAt: sandbox.state === SandboxState.STARTED ? sandbox.createdAt ?? manifest.createdAt : null,
        status: mapSandboxStateToStatus(sandbox.state),
        updatedAt: sandbox.createdAt ?? manifest.createdAt,
      } satisfies DaytonaStatusFile)

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

  async stopRun(runId: string): Promise<Run | null> {
    const sandbox = await this.getSandbox(runId)

    if (!sandbox) {
      return null
    }

    const manifest = await downloadJsonFile<DaytonaRunManifest>(sandbox, MANIFEST_PATH)

    if (!manifest) {
      return null
    }

    const stopResponse = await sandbox.process.executeCommand(
      `bash -lc ${shellQuote(`pkill -f ${SCRIPT_PATH} || true`)}`,
      undefined,
      undefined,
      20,
    )

    if (stopResponse.exitCode !== 0) {
      throw new HttpError(502, stopResponse.result.trim() || 'Daytona failed to stop the sandbox run.')
    }

    const cancelledAt = nowIso()
    const cancelledStatus: DaytonaStatusFile = {
      completedAt: cancelledAt,
      resultSummary: 'Run stopped by operator request.',
      startedAt: cancelledAt,
      status: 'failed',
      updatedAt: cancelledAt,
    }

    await sandbox.fs.uploadFile(
      Buffer.from(JSON.stringify(cancelledStatus, null, 2), 'utf8'),
      STATUS_PATH,
    )
    await sandbox.fs.uploadFile(
      Buffer.from(
        JSON.stringify(
          {
            summary: 'Run stopped by operator request.',
            artifacts: [],
          } satisfies RunResult,
          null,
          2,
        ),
        'utf8',
      ),
      RESULT_PATH,
    )

    const appendedLog = await sandbox.process.executeCommand(
      `bash -lc ${shellQuote(
        `printf '%s|warn|cancel|Run stopped by operator request.\\n' '${cancelledAt}' >> ${LOG_PATH}`,
      )}`,
      undefined,
      undefined,
      20,
    )

    if (appendedLog.exitCode !== 0) {
      throw new HttpError(502, appendedLog.result.trim() || 'Daytona failed to append cancellation log.')
    }

    return buildRunFromManifest(manifest, cancelledStatus, sandbox)
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
