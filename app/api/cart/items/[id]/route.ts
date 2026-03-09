import { NextResponse } from 'next/server'
import { getMockCart, removeMockCartItem } from '@/lib/mock-cart-store'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const removed = removeMockCartItem(id)

  if (!removed) {
    return NextResponse.json({ error: 'Cart item not found' }, { status: 404 })
  }

  return NextResponse.json({
    cart: getMockCart(),
    removedItemId: id,
  })
}
