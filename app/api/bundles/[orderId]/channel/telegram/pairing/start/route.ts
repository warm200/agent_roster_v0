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

  if (order.channelConfig?.tokenStatus !== 'validated') {
    return NextResponse.json(
      { error: 'Validate the bot token before starting pairing' },
      { status: 400 }
    )
  }

  const now = new Date().toISOString()

  order.channelConfig = {
    ...order.channelConfig,
    recipientBindingStatus: 'paired',
    recipientExternalId: order.channelConfig.recipientExternalId ?? `telegram-user-${Date.now()}`,
    updatedAt: now,
  }
  order.updatedAt = now

  return NextResponse.json({
    botUsername: 'YourAgentBot',
    channelConfig: order.channelConfig,
    orderId,
  })
}
