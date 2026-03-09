import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code, bundleId } = body
    
    if (!code) {
      return NextResponse.json(
        { error: "Verification code is required" },
        { status: 400 }
      )
    }
    
    if (!bundleId) {
      return NextResponse.json(
        { error: "Bundle ID is required" },
        { status: 400 }
      )
    }
    
    // Mock verification - in production this would validate against Telegram
    // Simulate a 6-digit code check
    if (code.length !== 6 || !/^\d+$/.test(code)) {
      return NextResponse.json(
        { error: "Invalid verification code format" },
        { status: 400 }
      )
    }
    
    // Mock successful verification
    return NextResponse.json({
      success: true,
      chatId: `chat_${Date.now()}`,
      username: "@user_mock",
      bundleId,
      verifiedAt: new Date()
    })
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    )
  }
}
