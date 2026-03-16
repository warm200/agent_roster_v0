import { Command } from 'commander'

import { getRuntimeMaintenanceService } from '@/server/services/runtime-maintenance.service'

const program = new Command()

program
  .name('runtime-maintenance')
  .description('Reconcile stale managed runtimes and enforce runtime timeout policy.')
  .option('--limit <count>', 'Maximum runtimes to reconcile in one batch.', (value) => Number.parseInt(value, 10))
  .option(
    '--stale-minutes <minutes>',
    'Only reconcile runtimes older than this many minutes since last reconcile.',
    (value) => Number.parseInt(value, 10),
  )

program.parse(process.argv)

const options = program.opts<{
  limit?: number
  staleMinutes?: number
}>()

async function main() {
  const result = await getRuntimeMaintenanceService().reconcileStaleRuntimes({
    limit: Number.isFinite(options.limit) ? options.limit : undefined,
    staleMinutes: Number.isFinite(options.staleMinutes) ? options.staleMinutes : undefined,
  })

  console.log(JSON.stringify(result, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
