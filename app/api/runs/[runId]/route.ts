import { NextRequest, NextResponse } from "next/server"
import { mockRuns, mockAgents } from "@/lib/mock-data"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params
  
  const run = mockRuns.find(r => r.id === runId)
  
  if (!run) {
    return NextResponse.json(
      { error: "Run not found" },
      { status: 404 }
    )
  }
  
  const agent = mockAgents.find(a => a.id === run.agentId)
  
  return NextResponse.json({
    ...run,
    agent
  })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params
  
  try {
    const body = await request.json()
    const { action } = body
    
    const run = mockRuns.find(r => r.id === runId)
    
    if (!run) {
      return NextResponse.json(
        { error: "Run not found" },
        { status: 404 }
      )
    }
    
    // Handle actions
    if (action === "cancel") {
      return NextResponse.json({
        ...run,
        status: "cancelled",
        completedAt: new Date()
      })
    }
    
    if (action === "retry") {
      return NextResponse.json({
        id: `run_${Date.now()}`,
        bundleId: run.bundleId,
        agentId: run.agentId,
        status: "queued",
        startedAt: new Date(),
        completedAt: null,
        durationSeconds: null,
        triggerType: "manual",
        triggerMessage: run.triggerMessage,
        steps: [],
        cost: null
      })
    }
    
    return NextResponse.json(
      { error: "Unknown action" },
      { status: 400 }
    )
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    )
  }
}
