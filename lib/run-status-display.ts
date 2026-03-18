import type { RunStatus, RuntimeInstanceState } from './types'

export type RunStatusDisplayKey =
  | 'provisioning'
  | 'running'
  | 'stopped'
  | 'archived'
  | 'released'
  | 'completed'
  | 'failed'

export function getRunStatusDisplay(
  status: RunStatus,
  runtimeState?: RuntimeInstanceState | null,
): { key: RunStatusDisplayKey; label: string } {
  switch (runtimeState) {
    case 'provisioning':
      return { key: 'provisioning', label: 'Provisioning' }
    case 'running':
      return { key: 'running', label: 'Running' }
    case 'stopped':
      return { key: 'stopped', label: 'Stopped' }
    case 'archived':
      return { key: 'archived', label: 'Archived' }
    case 'deleted':
      return { key: 'released', label: 'Released' }
    case 'failed':
      return { key: 'failed', label: 'Failed' }
    default:
      break
  }

  switch (status) {
    case 'provisioning':
      return { key: 'provisioning', label: 'Provisioning' }
    case 'running':
      return { key: 'running', label: 'Running' }
    case 'failed':
      return { key: 'failed', label: 'Failed' }
    case 'completed':
    default:
      return { key: 'completed', label: 'Completed' }
  }
}
