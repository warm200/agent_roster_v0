import { NextRequest, NextResponse } from 'next/server'

import { HttpError } from '@/server/lib/http'
import { getRequestUserId } from '@/server/lib/request-user'
import { verifySameOrigin } from '@/server/lib/route-security'
import { getTelegramService } from '@/server/services/telegram.service'

export async function POST(request: NextRequest) {
  try {
    const csrfError = verifySameOrigin(request)
    if (csrfError) {
      return csrfError
    }

    const body = await request.json()
    const orderId = body.orderId || body.bundleId
    const botToken = body.botToken || body.code
    const userId = await getRequestUserId(request)

    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 })
    }

    if (!botToken) {
      return NextResponse.json({ error: 'botToken is required' }, { status: 400 })
    }

    const result = await getTelegramService().validateToken({
      orderId,
      userId,
      botToken: String(botToken),
    })

    return NextResponse.json({
      botUsername: result.bot.username ?? 'YourAgentBot',
      channelConfig: result.config,
      deprecated: true,
      orderId,
    })
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}
