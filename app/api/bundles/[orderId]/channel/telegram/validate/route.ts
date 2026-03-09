import { NextResponse } from 'next/server'
import { mockOrders } from '@/lib/mock-data'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params
  const order = mockOrders.find((item) => item.id === orderId)

  if (!order) {
    return NextResponse.json({ error: 'Bundle not found' }, { status: 404 })
  }

  try {
    const body = await request.json()
    const { botToken } = body as { botToken?: string }

    if (!botToken?.trim()) {
      return NextResponse.json({ error: 'Bot token is required' }, { status: 400 })
    }

    if (!botToken.includes(':')) {
      return NextResponse.json({ error: 'Invalid bot token format' }, { status: 400 })
    }

    const now = new Date().toISOString()

    order.channelConfig = {
      id: order.channelConfig?.id ?? `channel-${orderId}`,
      orderId,
      channelType: 'telegram',
      botTokenSecretRef: `encrypted:${botToken.slice(0, 6)}`,
      tokenStatus: 'validated',
      recipientBindingStatus: order.channelConfig?.recipientBindingStatus ?? 'pending',
      recipientExternalId: order.channelConfig?.recipientExternalId ?? null,
      appliesToScope: 'run',
      createdAt: order.channelConfig?.createdAt ?? now,
      updatedAt: now,
    }
    order.updatedAt = now

    return NextResponse.json({
      botUsername: 'YourAgentBot',
      channelConfig: order.channelConfig,
      orderId,
    })
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}
