import { NextRequest, NextResponse } from "next/server"
import { createMockRun, getOrderById, getRunById, getRunSummary } from "@/lib/mock-selectors"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params
  
  const run = getRunById(runId)
  
  if (!run) {
    return NextResponse.json(
      { error: "Run not found" },
      { status: 404 }
    )
  }
  
  return NextResponse.json(getRunSummary(run))
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params
  
  try {
    const body = await request.json()
    const { action } = body
    
    const run = getRunById(runId)
    
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
        status: "failed",
        resultSummary: "Run cancelled before completion.",
        updatedAt: new Date().toISOString(),
        completedAt: new Date().toISOString()
      })
    }
    
    if (action === "retry") {
      const order = getOrderById(run.orderId)

      if (!order) {
        return NextResponse.json(
          { error: "Order not found for this run" },
          { status: 404 }
        )
      }

      return NextResponse.json(createMockRun(order))
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
