import { NextRequest } from 'next/server'

import {
  adminJson,
  buildAdminBillingHealth,
  getAdminSnapshotFromRequest,
} from '../_lib'

export async function GET(request: NextRequest) {
  return adminJson(buildAdminBillingHealth(await getAdminSnapshotFromRequest(request)))
}
