import { NextRequest, NextResponse } from 'next/server'

import { HttpError } from '@/server/lib/http'
import { getRequestUserId } from '@/server/lib/request-user'
import { getTelegramService } from '@/server/services/telegram.service'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const { orderId } = await params
    const userId = await getRequestUserId(request)
    const body = await request.json()
    const { botToken } = body as { botToken?: string }

    if (!botToken?.trim()) {
      return NextResponse.json({ error: 'Bot token is required' }, { status: 400 })
    }

    const result = await getTelegramService().validateToken({
      orderId,
      userId,
      botToken,
    })

    return NextResponse.json({
      botUsername: result.bot.username ?? 'YourAgentBot',
      channelConfig: result.config,
      orderId,
    })
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}
