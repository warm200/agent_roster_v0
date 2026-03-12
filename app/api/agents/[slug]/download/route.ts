import { NextRequest, NextResponse } from 'next/server'

import { HttpError } from '@/server/lib/http'
import { getLocalAgentArchive } from '@/server/services/local-agent-files'
import { verifyLocalAgentDownloadGrant } from '@/server/services/order.service'

type AgentArchiveLoader = (slug: string) => Promise<{
  contents: Buffer
  fileName: string
} | null>

let agentArchiveLoaderOverride: AgentArchiveLoader | null = null

export function setAgentDownloadArchiveLoaderForTesting(loader: AgentArchiveLoader | null) {
  agentArchiveLoaderOverride = loader
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params
    const expiresAt = request.nextUrl.searchParams.get('expiresAt')
    const signature = request.nextUrl.searchParams.get('signature')

    if (!expiresAt || !signature) {
      return NextResponse.json(
        { error: 'expiresAt and signature are required' },
        { status: 400 },
      )
    }

    verifyLocalAgentDownloadGrant({
      expiresAt,
      signature,
      slug,
    })

    const archive = await (agentArchiveLoaderOverride?.(slug) ?? getLocalAgentArchive(slug))

    if (!archive) {
      return NextResponse.json({ error: 'Agent package not found' }, { status: 404 })
    }

    return new NextResponse(new Uint8Array(archive.contents), {
      headers: {
        'content-disposition': `attachment; filename="${archive.fileName}"`,
        'content-type': 'application/gzip',
      },
      status: 200,
    })
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unable to build agent package',
      },
      { status: 500 },
    )
  }
}
