import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    { error: 'Deprecated endpoint. Use POST /api/checkout/session instead.' },
    { status: 410 },
  )
}
