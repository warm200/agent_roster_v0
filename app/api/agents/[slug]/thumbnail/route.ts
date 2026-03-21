import path from 'node:path'

import { NextResponse } from 'next/server'

import { getLocalAgentThumbnail } from '@/server/services/local-agent-files'

const CONTENT_TYPES: Record<string, string> = {
  '.gif': 'image/gif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params
  const thumbnail = await getLocalAgentThumbnail(slug)

  if (!thumbnail) {
    return NextResponse.json({ error: 'Thumbnail not found' }, { status: 404 })
  }

  const extension = path.extname(thumbnail.absolutePath).toLowerCase()
  return new NextResponse(thumbnail.contents, {
    headers: {
      'cache-control': 'public, max-age=300',
      'content-type': CONTENT_TYPES[extension] ?? 'application/octet-stream',
    },
  })
}
