import { AdminUsageDashboard } from '@/components/admin/usage-dashboard'
import type { AdminDateRange } from '@/lib/admin-usage-data'
import { getAdminUsageSnapshot } from '@/server/services/admin-usage.service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AdminUsagePage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>
}) {
  const params = await searchParams
  const range = params.range as AdminDateRange | undefined
  const snapshot = await getAdminUsageSnapshot(range)

  return <AdminUsageDashboard snapshot={snapshot} />
}
