import { NextRequest, NextResponse } from "next/server"
import { mockAgents } from "@/lib/mock-data"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  
  const agent = mockAgents.find(a => a.slug === slug)
  
  if (!agent) {
    return NextResponse.json(
      { error: "Agent not found" },
      { status: 404 }
    )
  }
  
  return NextResponse.json(agent)
}
