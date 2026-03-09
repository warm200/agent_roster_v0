import { NextRequest, NextResponse } from "next/server"
import { mockAgents } from "@/lib/mock-data"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  
  const category = searchParams.get("category")
  const riskLevel = searchParams.get("riskLevel")
  const search = searchParams.get("search")
  const featured = searchParams.get("featured")
  
  let agents = mockAgents.filter((agent) => agent.status === "active")
  
  // Filter by category
  if (category && category !== "all") {
    agents = agents.filter(agent => agent.category === category)
  }
  
  // Filter by risk level
  if (riskLevel && riskLevel !== "all") {
    agents = agents.filter(agent => agent.currentVersion.riskProfile.riskLevel === riskLevel)
  }
  
  // Filter by search query
  if (search) {
    const query = search.toLowerCase()
    agents = agents.filter(agent => 
      agent.title.toLowerCase().includes(query) ||
      agent.summary.toLowerCase().includes(query) ||
      agent.category.toLowerCase().includes(query)
    )
  }
  
  // Mock "featured" as the first three active catalog items.
  if (featured === "true") {
    const featuredIds = new Set(mockAgents.slice(0, 3).map((agent) => agent.id))
    agents = agents.filter((agent) => featuredIds.has(agent.id))
  }

  const categories = [...new Set(mockAgents.map((agent) => agent.category))]
  
  return NextResponse.json({
    agents,
    categories,
    total: agents.length
  })
}
