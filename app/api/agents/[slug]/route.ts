import { NextRequest, NextResponse } from 'next/server'

import { getCatalogService } from '@/server/services/catalog.service'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params

  const agent = await getCatalogService().getAgentBySlug(slug)

  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
  }

  return NextResponse.json(agent)
}
