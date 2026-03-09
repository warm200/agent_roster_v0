import { NextRequest, NextResponse } from "next/server"
import { mockUserBundles, mockAgents } from "@/lib/mock-data"

export async function GET() {
  // Enrich bundles with agent data
  const enrichedBundles = mockUserBundles.map(bundle => ({
    ...bundle,
    agents: bundle.agentIds.map(id => mockAgents.find(a => a.id === id)).filter(Boolean)
  }))
  
  return NextResponse.json({
    bundles: enrichedBundles,
    total: enrichedBundles.length
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { agentIds, telegramChatId } = body
    
    if (!agentIds || !Array.isArray(agentIds) || agentIds.length === 0) {
      return NextResponse.json(
        { error: "At least one agent is required" },
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
    const totalPrice = agents.reduce((sum, agent) => sum + (agent?.pricing.basePrice || 0), 0)
    
    // Mock bundle creation
    const newBundle = {
      id: `bundle_${Date.now()}`,
      orderId: `order_${Date.now()}`,
      userId: "user_mock",
      agentIds,
      telegramChatId: telegramChatId || null,
      status: "active" as const,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      totalPaid: totalPrice
    }
    
    return NextResponse.json(newBundle, { status: 201 })
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    )
  }
}
