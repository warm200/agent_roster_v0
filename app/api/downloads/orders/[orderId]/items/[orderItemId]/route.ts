import { NextRequest, NextResponse } from 'next/server'

import { HttpError } from '@/server/lib/http'
import {
  buildLocalAgentDownloadGrant,
  getOrderService,
  verifyDownloadGrant,
} from '@/server/services/order.service'

function extractLocalAgentSlug(installPackageUrl: string) {
  const match = installPackageUrl.match(/^\/api\/agents\/([^/]+)\/download$/)
  return match?.[1] ?? null
}

export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      orderId: string
      orderItemId: string
    }>
  },
) {
  try {
    const { orderId, orderItemId } = await params
    const expiresAt = request.nextUrl.searchParams.get('expiresAt')
    const signature = request.nextUrl.searchParams.get('signature')

    if (!expiresAt || !signature) {
      return NextResponse.json(
        { error: 'expiresAt and signature are required' },
        { status: 400 },
      )
    }

    verifyDownloadGrant({
      expiresAt,
      orderId,
      orderItemId,
      signature,
    })

    const installPackageUrl = await getOrderService().resolveSignedDownload({
      orderId,
      orderItemId,
    })

    const localAgentSlug = extractLocalAgentSlug(installPackageUrl)

    if (localAgentSlug) {
      const localGrant = buildLocalAgentDownloadGrant({
        baseUrl: request.nextUrl.origin,
        expiresAt: new Date(expiresAt),
        slug: localAgentSlug,
      })

      return NextResponse.redirect(localGrant.downloadUrl)
    }

    return NextResponse.redirect(new URL(installPackageUrl, request.nextUrl.origin))
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    return NextResponse.json({ error: 'Unable to resolve download' }, { status: 500 })
  }
}
