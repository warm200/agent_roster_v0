import { NextRequest, NextResponse } from "next/server"
import { calculateBundleRisk, mockAgents, mockOrders } from "@/lib/mock-data"
import type { Agent } from "@/lib/types"

export async function GET() {
  const bundles = mockOrders.map((order) => ({
    ...order,
    agents: order.items.map((item) => item.agent),
  }))
  
  return NextResponse.json({
    bundles,
    total: bundles.length
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { agentIds } = body
    
    if (!agentIds || !Array.isArray(agentIds) || agentIds.length === 0) {
      return NextResponse.json(
        { error: "At least one agent is required" },
        { status: 400 }
      )
    }
    
    // Validate all agents exist
    const agents = agentIds
      .map((id: string) => mockAgents.find((agent) => agent.id === id))
      .filter((agent): agent is Agent => Boolean(agent))

    if (agents.length !== agentIds.length) {
      return NextResponse.json(
        { error: "One or more agents not found" },
        { status: 400 }
      )
    }
    
    const now = new Date().toISOString()
    const amountCents = agents.reduce((sum, agent) => sum + agent.priceCents, 0)
    
    const orderId = `order-${Date.now()}`
    const newBundle = {
      id: orderId,
      userId: "user-1",
      cartId: "cart-generated",
      paymentProvider: "stripe",
      paymentReference: null,
      amountCents,
      currency: "USD",
      status: "paid" as const,
      items: agents.map((agent) => ({
        id: `oi-${agent.id}`,
        orderId,
        agent,
        agentVersion: agent.currentVersion,
        priceCents: agent.priceCents,
        createdAt: now,
      })),
      channelConfig: null,
      bundleRisk: calculateBundleRisk(agents),
      createdAt: now,
      updatedAt: now,
      paidAt: now,
    }

    mockOrders.unshift(newBundle)
    
    return NextResponse.json(newBundle, { status: 201 })
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    )
  }
}
