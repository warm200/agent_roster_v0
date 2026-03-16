import { NextRequest } from 'next/server'

import {
  adminJson,
  buildAdminRuntimeUsage,
  getAdminSnapshotFromRequest,
} from '../_lib'

export async function GET(request: NextRequest) {
  return adminJson(buildAdminRuntimeUsage(await getAdminSnapshotFromRequest(request)))
}
