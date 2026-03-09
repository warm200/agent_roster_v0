import { NextRequest, NextResponse } from "next/server"
import { mockAgents } from "@/lib/mock-data"
import type { Agent } from "@/lib/types"

const getPreviewResponse = (agent: Agent, message: string): string => {
  const lower = message.toLowerCase()

  if (agent.category === "inbox") {
    if (lower.includes("how") || lower.includes("work")) {
      return "I analyze incoming emails and categorize them into four buckets: Urgent (needs immediate attention), Follow-up (requires action within 24-48 hours), FYI (informational, no action needed), and Spam. I look at sender importance, subject line keywords, and content to make these decisions."
    }
    if (lower.includes("priorit")) {
      return "I prioritize based on several factors: sender relationship (VIPs, direct reports, managers), urgency indicators in the subject, deadlines mentioned in the email body, and your historical response patterns. High-priority emails get flagged immediately."
    }
    if (lower.includes("summar")) {
      return "For long threads, I extract the key points: who said what, what decisions were made, what actions are pending, and any deadlines mentioned. You get a 2-3 sentence summary so you can catch up quickly."
    }
    return "I help manage your inbox by categorizing, prioritizing, and summarizing emails. What specific aspect would you like to know more about?"
  }

  if (agent.category === "calendar") {
    if (lower.includes("focus") || lower.includes("protect")) {
      return "I analyze your calendar patterns to identify optimal focus time blocks. I'll suggest blocking 2-3 hour chunks in the morning when you're typically most productive, and I'll decline or reschedule meeting requests that would fragment these blocks."
    }
    if (lower.includes("conflict") || lower.includes("reschedule")) {
      return "When conflicts arise, I evaluate meeting importance, attendee availability, and your preferences. I'll suggest alternative times that work for all parties, minimizing back-and-forth. I never reschedule without your approval."
    }
    return "I optimize your calendar by protecting focus time and resolving scheduling conflicts. What would you like to know more about?"
  }

  if (agent.category === "docs") {
    if (lower.includes("summar")) {
      return "I process documents in chunks, extracting key information: main arguments, supporting data, action items, and conclusions. For a 20-page report, I can produce a 1-page executive summary highlighting what matters most."
    }
    if (lower.includes("extract") || lower.includes("key point")) {
      return "I identify action items (tasks assigned to specific people), deadlines, decisions made, and open questions. These are formatted as a structured list you can immediately act on."
    }
    return "I summarize documents and extract key information. What type of documents are you working with?"
  }

  if (agent.category === "automation") {
    if (lower.includes("workflow") || lower.includes("automate")) {
      return "I can connect multiple services via their APIs. For example: when a new email arrives matching certain criteria, extract data, update a spreadsheet, and notify your team via Slack. All configured through simple rules."
    }
    return "I automate workflows across your tools and services. What processes are you looking to automate?"
  }

  if (agent.category === "analytics") {
    if (lower.includes("track") || lower.includes("metric")) {
      return "I track time spent in different applications, meeting frequency and duration, focus time vs. fragmented time, and communication patterns. All data stays local; nothing is shared externally."
    }
    return "I provide insights into your productivity patterns. What metrics are you most interested in?"
  }

  return `As ${agent.title}, I can help you with ${agent.category}-related tasks. Could you be more specific about what you'd like to know?`
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const agentId = typeof body?.agentId === "string" ? body.agentId.trim() : ""
  const message = typeof body?.message === "string" ? body.message.trim() : ""

  if (!agentId || !message) {
    return NextResponse.json(
      { error: "agentId and message are required" },
      { status: 400 }
    )
  }

  const agent = mockAgents.find((candidate) => candidate.id === agentId)

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 })
  }

  return NextResponse.json({
    content: getPreviewResponse(agent, message),
  })
}
