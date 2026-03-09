import { NextRequest, NextResponse } from "next/server"
import { mockRunLogs, mockRuns } from "@/lib/mock-data"
import { createMockRun, getOrderById, getRunSummary } from "@/lib/mock-selectors"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  
  const status = searchParams.get("status")
  const orderId = searchParams.get("orderId")
  const limit = parseInt(searchParams.get("limit") || "50")
  const offset = parseInt(searchParams.get("offset") || "0")
  
  let runs = [...mockRuns]
  
  // Filter by status
  if (status && status !== "all") {
    runs = runs.filter(run => run.status === status)
  }
  
  // Filter by agent
  if (orderId) {
    runs = runs.filter(run => run.orderId === orderId)
  }
  
  // Sort by date (newest first)
  runs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  
  // Paginate
  const total = runs.length
  runs = runs.slice(offset, offset + limit)
  
  return NextResponse.json({
    runs: runs.map(getRunSummary),
    total,
    limit,
    offset,
    hasMore: offset + runs.length < total
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { orderId } = body
    
    if (!orderId) {
      return NextResponse.json(
        { error: "orderId is required" },
        { status: 400 }
      )
    }

    const order = getOrderById(orderId)

    if (!order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      )
    }

    if (order.status !== "paid") {
      return NextResponse.json(
        { error: "Only paid bundles can launch runs" },
        { status: 400 }
      )
    }

    if (
      order.channelConfig?.tokenStatus !== "validated" ||
      order.channelConfig?.recipientBindingStatus !== "paired"
    ) {
      return NextResponse.json(
        { error: "Telegram setup must be completed before launching a run" },
        { status: 400 }
      )
    }
    
    const newRun = createMockRun(order)
    mockRuns.unshift(newRun)
    mockRunLogs[newRun.id] = [
      {
        timestamp: newRun.createdAt,
        level: "info",
        step: "init",
        message: "Run requested from purchased bundle. Provisioning managed workspace.",
      },
    ]
    
    return NextResponse.json(getRunSummary(newRun), { status: 201 })
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    )
  }
}
