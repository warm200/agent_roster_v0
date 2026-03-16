import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getRuntimeMaintenanceService } from '@/server/services/runtime-maintenance.service'

const requestSchema = z.object({
  limit: z.number().int().positive().max(200).optional(),
  staleMinutes: z.number().int().positive().max(24 * 60).optional(),
})

function isAuthorized(request: NextRequest) {
  const configuredToken = process.env.INTERNAL_API_TOKEN
  if (!configuredToken) {
    return false
  }

  const authorization = request.headers.get('authorization')
  return authorization === `Bearer ${configuredToken}`
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid maintenance request.' }, { status: 400 })
  }

  const result = await getRuntimeMaintenanceService().reconcileStaleRuntimes(parsed.data)
  return NextResponse.json({ result })
}
