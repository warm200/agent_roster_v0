import { Badge } from '@/components/ui/badge'
import { getRunStatusDisplay, type RunStatusDisplayKey } from '@/lib/run-status-display'
import { cn } from '@/lib/utils'
import type { RunStatus, RuntimeInstanceState } from '@/lib/types'
import { Archive, CheckCircle2, LoaderCircle, PauseCircle, Play, XCircle } from 'lucide-react'

const statusConfig: Record<RunStatusDisplayKey, { className: string; icon: React.ReactNode }> = {
  provisioning: {
    className: 'border-blue-500/30 bg-blue-500/15 text-blue-400',
    icon: <LoaderCircle className="h-3.5 w-3.5 animate-spin" />,
  },
  running: {
    className: 'border-amber-500/30 bg-amber-500/15 text-amber-400',
    icon: <Play className="h-3.5 w-3.5" />,
  },
  stopped: {
    className: 'border-sky-500/30 bg-sky-500/15 text-sky-300',
    icon: <PauseCircle className="h-3.5 w-3.5" />,
  },
  archived: {
    className: 'border-violet-500/30 bg-violet-500/15 text-violet-300',
    icon: <Archive className="h-3.5 w-3.5" />,
  },
  released: {
    className: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-400',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  completed: {
    className: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-400',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  failed: {
    className: 'border-red-500/30 bg-red-500/15 text-red-400',
    icon: <XCircle className="h-3.5 w-3.5" />,
  },
}

interface RunStatusBadgeProps {
  status: RunStatus
  runtimeState?: RuntimeInstanceState | null
  className?: string
}

export function RunStatusBadge({ status, runtimeState, className }: RunStatusBadgeProps) {
  const display = getRunStatusDisplay(status, runtimeState)
  const config = statusConfig[display.key]

  return (
    <Badge variant="outline" className={cn('gap-1.5', config.className, className)}>
      {config.icon}
      {display.label}
    </Badge>
  )
}
