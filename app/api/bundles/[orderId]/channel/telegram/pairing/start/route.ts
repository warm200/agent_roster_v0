import { NextRequest, NextResponse } from 'next/server'

import { HttpError } from '@/server/lib/http'
import { getRequestUserId } from '@/server/lib/request-user'
import { verifySameOrigin } from '@/server/lib/route-security'
import { getTelegramService } from '@/server/services/telegram.service'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const csrfError = verifySameOrigin(request)
    if (csrfError) {
      return csrfError
    }

    const { orderId } = await params
    const userId = await getRequestUserId(request)
    const result = await getTelegramService().startPairing({
      orderId,
      userId,
      origin: request.nextUrl.origin,
    })

    return NextResponse.json({
      botUsername: result.botUsername ?? 'YourAgentBot',
      pairingCommand: result.pairingCommand,
      channelConfig: result.config,
      orderId,
    })
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    return NextResponse.json({ error: 'Unable to start pairing' }, { status: 500 })
  }
}
