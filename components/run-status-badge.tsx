import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { RunStatus } from '@/lib/types'
import { CheckCircle2, LoaderCircle, Play, XCircle } from 'lucide-react'

const statusConfig: Record<RunStatus, { className: string; icon: React.ReactNode; label: string }> = {
  provisioning: {
    className: 'border-blue-500/30 bg-blue-500/15 text-blue-400',
    icon: <LoaderCircle className="h-3.5 w-3.5 animate-spin" />,
    label: 'Provisioning',
  },
  running: {
    className: 'border-amber-500/30 bg-amber-500/15 text-amber-400',
    icon: <Play className="h-3.5 w-3.5" />,
    label: 'Running',
  },
  completed: {
    className: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-400',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    label: 'Completed',
  },
  failed: {
    className: 'border-red-500/30 bg-red-500/15 text-red-400',
    icon: <XCircle className="h-3.5 w-3.5" />,
    label: 'Failed',
  },
}

interface RunStatusBadgeProps {
  status: RunStatus
  className?: string
}

export function RunStatusBadge({ status, className }: RunStatusBadgeProps) {
  const config = statusConfig[status]

  return (
    <Badge variant="outline" className={cn('gap-1.5', config.className, className)}>
      {config.icon}
      {config.label}
    </Badge>
  )
}
