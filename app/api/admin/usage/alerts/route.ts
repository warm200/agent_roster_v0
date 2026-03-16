import { NextRequest } from 'next/server'

import {
  adminJson,
  buildAdminAlerts,
  getAdminSnapshotFromRequest,
} from '../_lib'

export async function GET(request: NextRequest) {
  return adminJson(buildAdminAlerts(await getAdminSnapshotFromRequest(request)))
}
