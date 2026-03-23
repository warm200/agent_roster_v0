import { NextRequest } from 'next/server'

import { filterAdminUsers } from '@/lib/admin-user-filters'

import {
  adminJson,
  authorizeAdminRequest,
  buildAdminUsers,
  getAdminSnapshotFromRequest,
} from '../_lib'

export async function GET(request: NextRequest) {
  const authError = await authorizeAdminRequest(request)
  if (authError) {
    return authError
  }

  const snapshot = await getAdminSnapshotFromRequest(request)
  const users = filterAdminUsers(snapshot.users, {
    health: request.nextUrl.searchParams.get('health'),
    orderId: request.nextUrl.searchParams.get('order_id'),
    plan: request.nextUrl.searchParams.get('plan'),
    q: request.nextUrl.searchParams.get('q'),
    runId: request.nextUrl.searchParams.get('run_id'),
    status: request.nextUrl.searchParams.get('status'),
  })

  return adminJson(buildAdminUsers({ ...snapshot, users }))
}
