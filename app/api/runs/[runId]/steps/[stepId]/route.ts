import { NextRequest, NextResponse } from "next/server"
import { mockRuns } from "@/lib/mock-data"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string; stepId: string }> }
) {
  const { runId, stepId } = await params
  
  try {
    const body = await request.json()
    const { action, editedContent } = body
    
    const run = mockRuns.find(r => r.id === runId)
    
    if (!run) {
      return NextResponse.json(
        { error: "Run not found" },
        { status: 404 }
      )
    }
    
    const step = run.steps.find(s => s.id === stepId)
    
    if (!step) {
      return NextResponse.json(
        { error: "Step not found" },
        { status: 404 }
      )
    }
    
    if (step.status !== "awaiting_approval") {
      return NextResponse.json(
        { error: "Step is not awaiting approval" },
        { status: 400 }
      )
    }
    
    // Handle approval actions
    if (action === "approve") {
      return NextResponse.json({
        ...step,
        status: "approved",
        approvedAt: new Date(),
        approvedBy: "user_mock"
      })
    }
    
    if (action === "reject") {
      return NextResponse.json({
        ...step,
        status: "rejected",
        rejectedAt: new Date(),
        rejectedBy: "user_mock"
      })
    }
    
    if (action === "edit_and_approve") {
      return NextResponse.json({
        ...step,
        status: "approved",
        approvedAt: new Date(),
        approvedBy: "user_mock",
        details: {
          ...step.details,
          editedContent
        },
        wasEdited: true
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
