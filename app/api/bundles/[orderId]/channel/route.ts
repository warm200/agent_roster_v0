import { NextResponse } from 'next/server'
import { mockOrders } from '@/lib/mock-data'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params
  const order = mockOrders.find((item) => item.id === orderId)

  if (!order) {
    return NextResponse.json({ error: 'Bundle not found' }, { status: 404 })
  }

  return NextResponse.json({
    botUsername: 'YourAgentBot',
    channelConfig: order.channelConfig,
    orderId,
  })
}
