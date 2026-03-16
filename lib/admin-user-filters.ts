import type { AdminUserRecord } from './admin-usage-data'

type AdminUserFilters = {
  health?: string | null
  orderId?: string | null
  plan?: string | null
  q?: string | null
  runId?: string | null
  status?: string | null
}

export function buildAdminUserSearchText(user: AdminUserRecord) {
  return [
    user.id,
    user.name,
    user.email,
    ...user.orderIds,
    ...user.runTimeline.map((run) => run.id),
  ]
    .join(' ')
    .toLowerCase()
}

export function filterAdminUsers(users: AdminUserRecord[], filters: AdminUserFilters) {
  const query = filters.q?.trim().toLowerCase() ?? ''
  const orderQuery = filters.orderId?.trim().toLowerCase() ?? ''
  const runQuery = filters.runId?.trim().toLowerCase() ?? ''
  const planFilter = filters.plan?.trim().toLowerCase() ?? 'all'
  const statusFilter = filters.status?.trim().toLowerCase() ?? 'all'
  const healthFilter = filters.health?.trim().toLowerCase() ?? 'all'

  return users.filter((user) => {
    if (planFilter !== 'all' && user.currentPlan !== planFilter) {
      return false
    }

    if (statusFilter !== 'all' && user.latestRunStatus !== statusFilter) {
      return false
    }

    if (healthFilter !== 'all' && user.health !== healthFilter) {
      return false
    }

    if (orderQuery && !user.orderIds.some((orderId) => orderId.toLowerCase().includes(orderQuery))) {
      return false
    }

    if (runQuery && !user.runTimeline.some((run) => run.id.toLowerCase().includes(runQuery))) {
      return false
    }

    if (!query) {
      return true
    }

    return buildAdminUserSearchText(user).includes(query)
  })
}
