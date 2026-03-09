import { NextRequest, NextResponse } from "next/server"
import { mockOrders } from "@/lib/mock-data"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const orderId = body.orderId || body.bundleId
    const botToken = body.botToken || body.code

    if (!orderId) {
      return NextResponse.json(
        { error: "orderId is required" },
        { status: 400 }
      )
    }

    if (!botToken) {
      return NextResponse.json(
        { error: "botToken is required" },
        { status: 400 }
      )
    }

    const order = mockOrders.find((item) => item.id === orderId)

    if (!order) {
      return NextResponse.json(
        { error: "Bundle not found" },
        { status: 404 }
      )
    }

    if (!String(botToken).includes(":")) {
      return NextResponse.json(
        { error: "Invalid bot token format" },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()

    order.channelConfig = {
      id: order.channelConfig?.id ?? `channel-${orderId}`,
      orderId,
      channelType: "telegram",
      botTokenSecretRef: `encrypted:${String(botToken).slice(0, 6)}`,
      tokenStatus: "validated",
      recipientBindingStatus: order.channelConfig?.recipientBindingStatus ?? "pending",
      recipientExternalId: order.channelConfig?.recipientExternalId ?? null,
      appliesToScope: "run",
      createdAt: order.channelConfig?.createdAt ?? now,
      updatedAt: now,
    }
    order.updatedAt = now

    return NextResponse.json({
      botUsername: "YourAgentBot",
      channelConfig: order.channelConfig,
      deprecated: true,
      orderId,
    })
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    )
  }
}
