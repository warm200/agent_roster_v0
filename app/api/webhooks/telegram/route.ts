import { NextRequest, NextResponse } from 'next/server'

import { HttpError, logServerError } from '@/server/lib/http'
import { getRunService } from '@/server/services/run.service'
import { getTelegramService, type TelegramUpdate } from '@/server/services/telegram.service'

const CREDITS_EXHAUSTED_FRAGMENT = 'no credits remaining'

function isCreditsExhaustedWakeError(error: unknown) {
  return (
    error instanceof HttpError &&
    error.status === 409 &&
    error.message.toLowerCase().includes(CREDITS_EXHAUSTED_FRAGMENT)
  )
}

function buildCreditsExhaustedWakeNotice() {
  return '[OpenRoster] Unable to wake your sandbox because no runtime credits remain on the current subscription. Add credits or upgrade, then send another message to retry.'
}

function buildWakeInProgressNotice() {
  return "[OpenRoster] Your OpenClaw is having coffee and coming back for your message. The agent will reply once it's back at its desk."
}

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
      try {
        const wake = await getRunService().wakeStoppedRunForOrder(orderId)

        if (wake.outcome === 'resumed') {
          try {
            await getTelegramService().sendPairedMessage?.({
              orderId,
              text: buildWakeInProgressNotice(),
            })
          } catch (sendError) {
            logServerError('api/webhooks/telegram:wake:resume_notice', sendError, {
              orderId,
              runId: wake.runId,
            })
          }
        }

        return NextResponse.json({
          ...result,
          wake,
        })
      } catch (error) {
        if (isCreditsExhaustedWakeError(error)) {
          try {
            await getTelegramService().sendPairedMessage?.({
              orderId,
              text: buildCreditsExhaustedWakeNotice(),
            })
          } catch (sendError) {
            logServerError('api/webhooks/telegram:wake:credits_notice', sendError, {
              orderId,
            })
          }

          return NextResponse.json({
            ...result,
            wake: {
              occurredAt: new Date().toISOString(),
              orderId,
              outcome: 'blocked',
              reason: 'credits_exhausted',
              runId: null,
            },
          })
        }

        throw error
      }
    }

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    return NextResponse.json({ error: 'Unable to process Telegram webhook' }, { status: 500 })
  }
}
