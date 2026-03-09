import { NextRequest, NextResponse } from "next/server"
import { mockRunLogs, mockRuns } from "@/lib/mock-data"
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
      const now = new Date().toISOString()
      run.status = "failed"
      run.resultSummary = "Run cancelled before completion."
      run.updatedAt = now
      run.completedAt = now
      mockRunLogs[run.id] = [
        ...(mockRunLogs[run.id] ?? []),
        {
          timestamp: now,
          level: "warn",
          step: "cancel",
          message: "Run cancelled from the run detail workbench.",
        },
      ]

      return NextResponse.json(getRunSummary({
        ...run,
      }))
    }
    
    if (action === "retry") {
      const order = getOrderById(run.orderId)

      if (!order) {
        return NextResponse.json(
          { error: "Order not found for this run" },
          { status: 404 }
        )
      }

      const retriedRun = createMockRun(order)
      mockRuns.unshift(retriedRun)
      mockRunLogs[retriedRun.id] = [
        {
          timestamp: retriedRun.createdAt,
          level: "info",
          step: "retry",
          message: `Retry requested from run ${run.id}. Provisioning managed workspace.`,
        },
      ]

      return NextResponse.json(getRunSummary(retriedRun))
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
