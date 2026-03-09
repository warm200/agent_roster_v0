'use client'

import { cn } from '@/lib/utils'
import type { RiskLevel } from '@/lib/types'
import { Shield, ShieldAlert, ShieldCheck } from 'lucide-react'

interface RiskBadgeProps {
  level: RiskLevel
  showLabel?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const config: Record<RiskLevel, { label: string; icon: typeof Shield; className: string }> = {
  low: {
    label: 'Low Risk',
    icon: ShieldCheck,
    className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  },
  medium: {
    label: 'Medium Risk',
    icon: Shield,
    className: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  },
  high: {
    label: 'High Risk',
    icon: ShieldAlert,
    className: 'bg-red-500/15 text-red-400 border-red-500/30',
  },
}

const sizes = {
  sm: 'text-xs px-1.5 py-0.5 gap-1',
  md: 'text-sm px-2 py-1 gap-1.5',
  lg: 'text-base px-3 py-1.5 gap-2',
}

const iconSizes = {
  sm: 12,
  md: 14,
  lg: 16,
}

export function RiskBadge({ level, showLabel = true, size = 'md', className }: RiskBadgeProps) {
  const { label, icon: Icon, className: colorClass } = config[level]

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium border rounded-full',
        colorClass,
        sizes[size],
        className
      )}
    >
      <Icon size={iconSizes[size]} />
      {showLabel && <span>{label}</span>}
    </span>
  )
}
