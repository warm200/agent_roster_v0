import { NextRequest } from 'next/server'

import {
  adminJson,
  buildAdminOverview,
  getAdminSnapshotFromRequest,
} from '../_lib'

export async function GET(request: NextRequest) {
  return adminJson(buildAdminOverview(await getAdminSnapshotFromRequest(request)))
}
