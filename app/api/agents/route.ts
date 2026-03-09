import { NextRequest, NextResponse } from "next/server"
import { mockAgents, mockCategories } from "@/lib/mock-data"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  
  const category = searchParams.get("category")
  const riskLevel = searchParams.get("riskLevel")
  const search = searchParams.get("search")
  const featured = searchParams.get("featured")
  
  let agents = [...mockAgents]
  
  // Filter by category
  if (category && category !== "all") {
    agents = agents.filter(agent => agent.category === category)
  }
  
  // Filter by risk level
  if (riskLevel && riskLevel !== "all") {
    agents = agents.filter(agent => agent.riskLevel === riskLevel)
  }
  
  // Filter by search query
  if (search) {
    const query = search.toLowerCase()
    agents = agents.filter(agent => 
      agent.name.toLowerCase().includes(query) ||
      agent.shortDescription.toLowerCase().includes(query) ||
      agent.capabilities.some(cap => cap.toLowerCase().includes(query))
    )
  }
  
  // Filter featured
  if (featured === "true") {
    agents = agents.filter(agent => agent.featured)
  }
  
  return NextResponse.json({
    agents,
    categories: mockCategories,
    total: agents.length
  })
}
