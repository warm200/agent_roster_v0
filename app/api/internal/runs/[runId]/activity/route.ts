import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getRunService } from '@/server/services/run.service'

const requestSchema = z.object({
  occurredAt: z.string().datetime().optional(),
})

function isAuthorized(request: NextRequest) {
  const configuredToken = process.env.INTERNAL_API_TOKEN
  if (!configuredToken) {
    return false
  }

  const authorization = request.headers.get('authorization')
  return authorization === `Bearer ${configuredToken}`
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ runId: string }> },
) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { runId } = await context.params
  const body = await request.json().catch(() => ({}))
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid activity payload.' }, { status: 400 })
  }

  const result = await getRunService().recordMeaningfulActivity(runId, parsed.data.occurredAt)
  return NextResponse.json({ result })
}
