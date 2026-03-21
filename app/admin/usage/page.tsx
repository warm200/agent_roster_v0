import { AdminUsageDashboard } from '@/components/admin/usage-dashboard'
import { getAdminRunsPage } from '@/server/services/admin-runs.service'
import { getAdminUsageSnapshot } from '@/server/services/admin-usage.service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AdminUsagePage({
  searchParams,
}: {
  searchParams: Promise<{ end?: string; range?: string; runs_page?: string; runs_q?: string; start?: string; tab?: string }>
}) {
  const params = await searchParams
  const [snapshot, runsPage] = await Promise.all([
    getAdminUsageSnapshot({
      end: params.end,
      range: params.range,
      start: params.start,
    }),
    getAdminRunsPage({
      page: params.runs_page,
      query: params.runs_q,
    }),
  ])

  return <AdminUsageDashboard initialTab={params.tab} runsPage={runsPage} snapshot={snapshot} />
}
