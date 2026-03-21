export const PROVIDER_COST_PER_MINUTE_CENTS = 0.27654
export const PROVIDER_COST_PER_MINUTE_USD = PROVIDER_COST_PER_MINUTE_CENTS / 100

export function estimateInternalCostCentsFromWorkspaceMinutes(workspaceMinutes: number | null | undefined) {
  if (workspaceMinutes == null || workspaceMinutes <= 0) {
    return 0
  }

  return Math.round(workspaceMinutes * PROVIDER_COST_PER_MINUTE_CENTS)
}

export function resolveEstimatedInternalCostCents(input: {
  estimatedInternalCostCents: number | null | undefined
  workspaceMinutes: number | null | undefined
}) {
  const stored = input.estimatedInternalCostCents ?? 0
  const derived = estimateInternalCostCentsFromWorkspaceMinutes(input.workspaceMinutes)
  return Math.max(stored, derived)
}
