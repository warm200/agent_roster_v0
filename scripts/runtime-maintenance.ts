import { Command } from 'commander'

import { getRuntimeMaintenanceService } from '@/server/services/runtime-maintenance.service'

const program = new Command()

function readPositiveIntEnv(name: string) {
  const raw = process.env[name]
  if (!raw) {
    return undefined
  }
  const value = Number.parseInt(raw, 10)
  return Number.isFinite(value) && value > 0 ? value : undefined
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

program
  .name('runtime-maintenance')
  .description('Reconcile stale managed runtimes and enforce runtime timeout policy.')
  .option('--limit <count>', 'Maximum runtimes to reconcile in one batch.', (value) => Number.parseInt(value, 10))
  .option(
    '--stale-minutes <minutes>',
    'Only reconcile runtimes older than this many minutes since last reconcile.',
    (value) => Number.parseInt(value, 10),
  )
  .option(
    '--interval-seconds <seconds>',
    'Run repeatedly on this interval. Defaults to RUNTIME_MAINTENANCE_INTERVAL_SECONDS when set.',
    (value) => Number.parseInt(value, 10),
  )
  .option('--watch', 'Keep running on an interval instead of exiting after one batch.')

program.parse(process.argv)

const options = program.opts<{
  intervalSeconds?: number
  limit?: number
  staleMinutes?: number
  watch?: boolean
}>()

let stopRequested = false

function resolveIntervalSeconds() {
  if (Number.isFinite(options.intervalSeconds) && (options.intervalSeconds ?? 0) > 0) {
    return options.intervalSeconds
  }
  return readPositiveIntEnv('RUNTIME_MAINTENANCE_INTERVAL_SECONDS')
}

async function runBatch() {
  const result = await getRuntimeMaintenanceService().reconcileStaleRuntimes({
    limit: Number.isFinite(options.limit) ? options.limit : undefined,
    staleMinutes: Number.isFinite(options.staleMinutes) ? options.staleMinutes : undefined,
  })

  console.log(JSON.stringify(result, null, 2))
}

async function main() {
  const intervalSeconds = resolveIntervalSeconds()
  const watch = Boolean(options.watch || intervalSeconds)

  if (!watch) {
    await runBatch()
    return
  }

  const loopIntervalMs = Math.max((intervalSeconds ?? 60) * 1000, 1_000)

  process.on('SIGINT', () => {
    stopRequested = true
  })
  process.on('SIGTERM', () => {
    stopRequested = true
  })

  while (!stopRequested) {
    await runBatch()
    if (stopRequested) {
      break
    }
    await sleep(loopIntervalMs)
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
