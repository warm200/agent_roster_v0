import { NextRequest, NextResponse } from "next/server"
import { mockRuns, mockAgents } from "@/lib/mock-data"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  
  const status = searchParams.get("status")
  const agentId = searchParams.get("agentId")
  const bundleId = searchParams.get("bundleId")
  const limit = parseInt(searchParams.get("limit") || "50")
  const offset = parseInt(searchParams.get("offset") || "0")
  
  let runs = [...mockRuns]
  
  // Filter by status
  if (status && status !== "all") {
    runs = runs.filter(run => run.status === status)
  }
  
  // Filter by agent
  if (agentId) {
    runs = runs.filter(run => run.agentId === agentId)
  }
  
  // Filter by bundle
  if (bundleId) {
    runs = runs.filter(run => run.bundleId === bundleId)
  }
  
  // Sort by date (newest first)
  runs.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
  
  // Paginate
  const total = runs.length
  runs = runs.slice(offset, offset + limit)
  
  // Enrich with agent data
  const enrichedRuns = runs.map(run => ({
    ...run,
    agent: mockAgents.find(a => a.id === run.agentId)
  }))
  
  return NextResponse.json({
    runs: enrichedRuns,
    total,
    limit,
    offset,
    hasMore: offset + runs.length < total
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { agentId, bundleId, triggerMessage } = body
    
    if (!agentId || !bundleId) {
      return NextResponse.json(
        { error: "agentId and bundleId are required" },
        { status: 400 }
      )
    }
    
    // Mock run creation
    const newRun = {
      id: `run_${Date.now()}`,
      bundleId,
      agentId,
      status: "queued" as const,
      startedAt: new Date(),
      completedAt: null,
      durationSeconds: null,
      triggerType: "manual" as const,
      triggerMessage: triggerMessage || null,
      steps: [],
      cost: null
    }
    
    return NextResponse.json(newRun, { status: 201 })
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    )
  }
}
