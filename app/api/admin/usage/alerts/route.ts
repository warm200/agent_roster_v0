import { NextRequest } from 'next/server'

import {
  adminJson,
  authorizeAdminRequest,
  buildAdminAlerts,
  getAdminSnapshotFromRequest,
} from '../_lib'

export async function GET(request: NextRequest) {
  const authError = await authorizeAdminRequest(request)
  if (authError) {
    return authError
  }

  return adminJson(buildAdminAlerts(await getAdminSnapshotFromRequest(request)))
}
