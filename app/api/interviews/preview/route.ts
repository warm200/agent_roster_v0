import { NextRequest, NextResponse } from 'next/server'

import { previewInterviewRequestSchema } from '@/lib/schemas'
import { HttpError } from '@/server/lib/http'
import { getAuthenticatedRequestUserId } from '@/server/lib/request-user'
import { AgentNotFoundError, getCatalogService } from '@/server/services/catalog.service'

function logPreviewRouteError(kind: string, error: unknown) {
  if (process.env.NODE_ENV === 'test') {
    return
  }

  console.error('[api/interviews/preview]', kind, error)
}

async function resolveAgentSlug(agentId?: string, slug?: string) {
  if (slug) {
    return slug
  }

  if (!agentId) {
    throw new HttpError(400, 'slug or agentId is required')
  }

  const catalogService = getCatalogService()
  const agents = await catalogService.listAgents()
  const agent = agents.find((candidate) => candidate.id === agentId)

  if (!agent) {
    throw new AgentNotFoundError(agentId)
  }

  return agent.slug
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthenticatedRequestUserId(request)

    const body = await request.json().catch(() => null)
    const parsed = previewInterviewRequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'slug or agentId plus messages are required' },
        { status: 400 },
      )
    }

    const agentSlug = await resolveAgentSlug(parsed.data.agentId, parsed.data.slug)
    const catalogService = getCatalogService()
    const preview = await catalogService.previewInterview({
      agentSlug,
      messages: parsed.data.messages,
      userId,
    })

    return NextResponse.json(preview)
  } catch (error) {
    if (error instanceof AgentNotFoundError) {
      logPreviewRouteError('agent_not_found', {
        message: error.message,
      })
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    if (error instanceof HttpError) {
      logPreviewRouteError('http_error', {
        message: error.message,
        status: error.status,
      })
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    logPreviewRouteError('unexpected_error', error)

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unable to generate preview reply',
      },
      { status: 500 },
    )
  }
}
