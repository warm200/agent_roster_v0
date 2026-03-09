import { NextRequest, NextResponse } from 'next/server'

import { AGENT_CATEGORIES } from '@/lib/constants'
import { getCatalogService } from '@/server/services/catalog.service'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const category = searchParams.get('category')
  const riskLevel = searchParams.get('riskLevel')
  const search = searchParams.get('search') ?? undefined
  const featured = searchParams.get('featured') === 'true'

  const agents = await getCatalogService().listAgents({
    category:
      category && category !== 'all' && AGENT_CATEGORIES.includes(category as (typeof AGENT_CATEGORIES)[number])
        ? (category as (typeof AGENT_CATEGORIES)[number])
        : undefined,
    riskLevel:
      riskLevel && riskLevel !== 'all' && ['low', 'medium', 'high'].includes(riskLevel)
        ? (riskLevel as 'low' | 'medium' | 'high')
        : undefined,
    search,
    featured,
  })

  return NextResponse.json({
    agents,
    categories: AGENT_CATEGORIES,
    total: agents.length,
  })
}
