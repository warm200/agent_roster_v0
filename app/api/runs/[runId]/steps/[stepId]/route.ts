import { NextRequest, NextResponse } from "next/server"
import { getRunById } from "@/lib/mock-selectors"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string; stepId: string }> }
) {
  const { runId, stepId } = await params
  
  try {
    const run = getRunById(runId)
    
    if (!run) {
      return NextResponse.json(
        { error: "Run not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(
      {
        error: `Manual step approvals are not supported for run ${run.id}. Current run details are surfaced through logs and artifacts instead.`,
        runId,
        stepId,
      },
      { status: 409 }
    )
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    )
  }
}
