import { NextRequest, NextResponse } from 'next/server'

import { HttpError } from '@/server/lib/http'
import { getRunService } from '@/server/services/run.service'
import { getTelegramService, type TelegramUpdate } from '@/server/services/telegram.service'

export async function POST(request: NextRequest) {
  try {
    const orderId = request.nextUrl.searchParams.get('orderId')

    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 })
    }

    const update = (await request.json()) as TelegramUpdate
    const secretToken = request.headers.get('x-telegram-bot-api-secret-token')
    const result = await getTelegramService().handleWebhook({
      orderId,
      secretToken,
      update,
    })

    if (result.outcome === 'runtime_activity') {
      await getRunService().recordMeaningfulActivityForOrder(orderId)
    }

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    return NextResponse.json({ error: 'Unable to process Telegram webhook' }, { status: 500 })
  }
}
