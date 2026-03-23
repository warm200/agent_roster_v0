import { NextRequest } from 'next/server'

import { adminJson, authorizeAdminRequest, getAdminSnapshotFromRequest } from './_lib'

export async function GET(request: NextRequest) {
  const authError = await authorizeAdminRequest(request)
  if (authError) {
    return authError
  }

  return adminJson(await getAdminSnapshotFromRequest(request))
}
