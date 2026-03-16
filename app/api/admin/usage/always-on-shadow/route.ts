import { NextRequest } from 'next/server'

import {
  adminJson,
  buildAdminAlwaysOn,
  getAdminSnapshotFromRequest,
} from '../_lib'

export async function GET(request: NextRequest) {
  return adminJson(buildAdminAlwaysOn(await getAdminSnapshotFromRequest(request)))
}
