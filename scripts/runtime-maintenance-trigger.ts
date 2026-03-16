import { Command } from 'commander'

import { runRemoteRuntimeMaintenance } from '@/server/services/runtime-maintenance.client'

const program = new Command()

program
  .name('runtime-maintenance-trigger')
  .description('Trigger hosted runtime maintenance over the internal API route.')
  .option('--base-url <url>', 'Override RUNTIME_MAINTENANCE_BASE_URL / NEXTAUTH_URL.')
  .option('--limit <count>', 'Maximum runtimes to reconcile in one batch.', (value) => Number.parseInt(value, 10))
  .option(
    '--stale-minutes <minutes>',
    'Only reconcile runtimes older than this many minutes since last reconcile.',
    (value) => Number.parseInt(value, 10),
  )

program.parse(process.argv)

const options = program.opts<{
  baseUrl?: string
  limit?: number
  staleMinutes?: number
}>()

async function main() {
  const result = await runRemoteRuntimeMaintenance({
    baseUrl: options.baseUrl,
    limit: Number.isFinite(options.limit) ? options.limit : undefined,
    staleMinutes: Number.isFinite(options.staleMinutes) ? options.staleMinutes : undefined,
  })

  console.log(JSON.stringify(result, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
