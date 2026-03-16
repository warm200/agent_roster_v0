import { NextRequest } from 'next/server'

import {
  adminJson,
  buildAdminBlockers,
  getAdminSnapshotFromRequest,
} from '../_lib'

export async function GET(request: NextRequest) {
  return adminJson(buildAdminBlockers(await getAdminSnapshotFromRequest(request)))
}
