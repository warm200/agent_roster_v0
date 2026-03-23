import { NextRequest } from 'next/server'

import {
  adminJson,
  authorizeAdminRequest,
  buildAdminBillingHealth,
  getAdminSnapshotFromRequest,
} from '../_lib'

export async function GET(request: NextRequest) {
  const authError = await authorizeAdminRequest(request)
  if (authError) {
    return authError
  }

  return adminJson(buildAdminBillingHealth(await getAdminSnapshotFromRequest(request)))
}
