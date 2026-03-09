import { NextResponse } from 'next/server'
import { getMockCart, replaceMockCartItems } from '@/lib/mock-cart-store'
import { mockAgents } from '@/lib/mock-data'

export async function GET() {
  return NextResponse.json(getMockCart())
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { agentIds } = body as { agentIds?: string[] }

    if (!Array.isArray(agentIds)) {
      return NextResponse.json({ error: 'agentIds must be an array' }, { status: 400 })
    }

    const agents = agentIds
      .map((agentId) => mockAgents.find((agent) => agent.id === agentId))
      .filter((agent): agent is NonNullable<typeof agent> => Boolean(agent))

    replaceMockCartItems(agents)

    return NextResponse.json(getMockCart())
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}
