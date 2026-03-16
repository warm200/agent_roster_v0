import { NextRequest } from 'next/server'

import { adminJson, getAdminSnapshotFromRequest } from './_lib'

export async function GET(request: NextRequest) {
  return adminJson(await getAdminSnapshotFromRequest(request))
}
