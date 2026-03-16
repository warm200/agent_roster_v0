import { AdminUsageDashboard } from '@/components/admin/usage-dashboard'
import { getAdminUsageSnapshot } from '@/server/services/admin-usage.service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AdminUsagePage({
  searchParams,
}: {
  searchParams: Promise<{ end?: string; range?: string; start?: string }>
}) {
  const params = await searchParams
  const snapshot = await getAdminUsageSnapshot({
    end: params.end,
    range: params.range,
    start: params.start,
  })

  return <AdminUsageDashboard snapshot={snapshot} />
}
