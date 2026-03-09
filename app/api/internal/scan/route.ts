import { NextRequest, NextResponse } from 'next/server'

import { scanAgentVersionRequestSchema } from '@/lib/schemas'
import { runService } from '@/server/services/run.service'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const parsed = scanAgentVersionRequestSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'version is required' }, { status: 400 })
  }

  const riskProfile = runService.scanAgentVersion(parsed.data.version)
  return NextResponse.json({ riskProfile })
}
