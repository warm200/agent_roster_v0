import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getRuntimeMaintenanceService } from '@/server/services/runtime-maintenance.service'

const requestSchema = z.object({
  limit: z.number().int().positive().max(200).optional(),
  staleMinutes: z.number().int().positive().max(24 * 60).optional(),
})

function getAuthorizedTokens() {
  return [process.env.INTERNAL_API_TOKEN, process.env.CRON_SECRET].filter(
    (value): value is string => Boolean(value),
  )
}

function isAuthorized(request: NextRequest) {
  const configuredTokens = getAuthorizedTokens()
  if (configuredTokens.length === 0) {
    return false
  }

  const authorization = request.headers.get('authorization')
  return configuredTokens.some((token) => authorization === `Bearer ${token}`)
}

function parseRequestInput(request: NextRequest) {
  const limit = request.nextUrl.searchParams.get('limit')
  const staleMinutes = request.nextUrl.searchParams.get('staleMinutes')

  return requestSchema.safeParse({
    limit: limit ? Number.parseInt(limit, 10) : undefined,
    staleMinutes: staleMinutes ? Number.parseInt(staleMinutes, 10) : undefined,
  })
}

async function runMaintenance(request: NextRequest, input: z.infer<typeof requestSchema>) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await getRuntimeMaintenanceService().reconcileStaleRuntimes(input)
  return NextResponse.json({ result })
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid maintenance request.' }, { status: 400 })
  }

  return runMaintenance(request, parsed.data)
}

export async function GET(request: NextRequest) {
  const parsed = parseRequestInput(request)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid maintenance request.' }, { status: 400 })
  }

  return runMaintenance(request, parsed.data)
}
