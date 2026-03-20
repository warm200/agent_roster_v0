import type { Run, RuntimeInstanceState, RunStatus } from './types'

function hasReadyControlUiSummary(resultSummary: string | null | undefined) {
  return Boolean(resultSummary?.includes('Open Control UI'))
}

export function canOpenRunControlUi(input: Pick<Run, 'usesRealWorkspace' | 'resultSummary' | 'status'> & {
  runtimeState?: RuntimeInstanceState | null
}) {
  if (!input.usesRealWorkspace) {
    return false
  }

  const runtimeActive = input.runtimeState ? input.runtimeState === 'running' : input.status === 'running'
  return runtimeActive && hasReadyControlUiSummary(input.resultSummary)
}

export function getRunControlUiBlockedReason(input: Pick<Run, 'resultSummary' | 'status'> & {
  runtimeState?: RuntimeInstanceState | null
}) {
  const runtimeState = input.runtimeState ?? mapRunStatusToRuntimeState(input.status)

  if (runtimeState === 'provisioning') {
    return 'Control UI is still starting. Try again in a few moments.'
  }

  if (
    runtimeState === 'failed' ||
    runtimeState === 'stopped' ||
    runtimeState === 'archived' ||
    runtimeState === 'deleted'
  ) {
    return 'Control UI is unavailable because this run is no longer active.'
  }

  return 'Control UI is still starting. Try again in a few moments.'
}

function mapRunStatusToRuntimeState(status: RunStatus): RuntimeInstanceState {
  switch (status) {
    case 'provisioning':
      return 'provisioning'
    case 'running':
      return 'running'
    case 'completed':
      return 'stopped'
    case 'failed':
    default:
      return 'failed'
  }
}
