import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json(
    {
      measurementId: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? null,
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  )
}
