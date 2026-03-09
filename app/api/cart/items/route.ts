import { NextResponse } from 'next/server'
import { addMockCartItem, getMockCart } from '@/lib/mock-cart-store'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { agentId } = body as { agentId?: string }

    if (!agentId) {
      return NextResponse.json({ error: 'agentId is required' }, { status: 400 })
    }

    const item = addMockCartItem(agentId)

    if (!item) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    return NextResponse.json({
      cart: getMockCart(),
      item,
    })
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}
