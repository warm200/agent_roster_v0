import { NextRequest, NextResponse } from "next/server"
import { mockAgents } from "@/lib/mock-data"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { agentIds, email, telegramChatId } = body
    
    if (!agentIds || !Array.isArray(agentIds) || agentIds.length === 0) {
      return NextResponse.json(
        { error: "At least one agent is required" },
        { status: 400 }
      )
    }
    
    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      )
    }
    
    // Validate all agents exist
    const agents = agentIds.map((id: string) => mockAgents.find(a => a.id === id))
    if (agents.some(a => !a)) {
      return NextResponse.json(
        { error: "One or more agents not found" },
        { status: 400 }
      )
    }
    
    // Calculate total price
    const subtotal = agents.reduce((sum, agent) => sum + (agent?.pricing.basePrice || 0), 0)
    const tax = subtotal * 0.08 // 8% tax
    const total = subtotal + tax
    
    // Mock order creation
    const order = {
      id: `order_${Date.now()}`,
      status: "pending",
      agentIds,
      email,
      telegramChatId: telegramChatId || null,
      subtotal,
      tax,
      total,
      currency: "USD",
      createdAt: new Date(),
      // In a real implementation, this would return a Stripe checkout URL
      checkoutUrl: `/checkout/success?orderId=order_${Date.now()}`
    }
    
    return NextResponse.json(order, { status: 201 })
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    )
  }
}
