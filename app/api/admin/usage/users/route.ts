import { NextRequest } from 'next/server'

import {
  adminJson,
  buildAdminUsers,
  getAdminSnapshotFromRequest,
} from '../_lib'

export async function GET(request: NextRequest) {
  return adminJson(buildAdminUsers(await getAdminSnapshotFromRequest(request)))
}
