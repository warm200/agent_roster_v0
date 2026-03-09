import { NextRequest, NextResponse } from 'next/server'

import { HttpError } from '@/server/lib/http'
import { getRequestUserId } from '@/server/lib/request-user'
import { getTelegramService } from '@/server/services/telegram.service'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const { orderId } = await params
    const userId = await getRequestUserId(request)
    const channelConfig = await getTelegramService().getChannelConfig({ orderId, userId })

    return NextResponse.json({
      orderId,
      channelConfig,
    })
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const { orderId } = await params
    const userId = await getRequestUserId(request)
    const channelConfig = await getTelegramService().disconnectChannel({ orderId, userId })

    return NextResponse.json({
      orderId,
      channelConfig,
    })
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    return NextResponse.json({ error: 'Unable to disconnect Telegram channel' }, { status: 500 })
  }
}
