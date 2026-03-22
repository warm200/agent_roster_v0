import Image from 'next/image'

import { cn } from '@/lib/utils'

export function BrandLogo({
  className,
  priority = false,
  size = 32,
}: {
  className?: string
  priority?: boolean
  size?: number
}) {
  return (
    <Image
      alt="OpenRoster logo"
      className={cn('shrink-0 object-contain dark:invert', className)}
      height={size}
      priority={priority}
      src="/logo.png"
      width={size}
    />
  )
}
