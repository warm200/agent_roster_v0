import { NextRequest } from 'next/server'

import {
  adminJson,
  buildAdminFunnel,
  getAdminSnapshotFromRequest,
} from '../_lib'

export async function GET(request: NextRequest) {
  return adminJson(buildAdminFunnel(await getAdminSnapshotFromRequest(request)))
}
