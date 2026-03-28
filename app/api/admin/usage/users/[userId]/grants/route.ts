import { getToken } from 'next-auth/jwt'
import { NextRequest, NextResponse } from 'next/server'

import { grantAdminRuntimeCreditsRequestSchema } from '@/lib/schemas'
import { getSubscriptionService } from '@/server/services/subscription.service'
import { verifySameOrigin } from '@/server/lib/route-security'

import { authorizeAdminRequest } from '../../../_lib'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const authError = await authorizeAdminRequest(request)
  if (authError) {
    return authError
  }

  const csrfError = verifySameOrigin(request)
  if (csrfError) {
    return csrfError
  }

  const body = grantAdminRuntimeCreditsRequestSchema.parse(await request.json())
  const { userId } = await params
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
  })

  const grant = await getSubscriptionService().grantAdminRuntimeCredits({
    credits: body.credits,
    expiresAt: body.expiresAt,
    grantedByUserId: typeof token?.sub === 'string' ? token.sub : null,
    note: body.note ?? null,
    userId,
  })

  return NextResponse.json(
    { grant },
    {
      headers: {
        'cache-control': 'no-store',
      },
      status: 200,
    },
  )
}
