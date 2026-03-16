import { AdminUsageDashboard } from '@/components/admin/usage-dashboard'
import { getAdminUsageSnapshot } from '@/server/services/admin-usage.service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AdminUsagePage() {
  const snapshot = await getAdminUsageSnapshot()

  return <AdminUsageDashboard snapshot={snapshot} />
}
