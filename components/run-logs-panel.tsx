import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDateTime } from '@/lib/utils'
import type { RunLog } from '@/lib/types'

const levelClassName: Record<RunLog['level'], string> = {
  debug: 'text-slate-400',
  error: 'text-red-400',
  info: 'text-emerald-400',
  warn: 'text-amber-400',
}

interface RunLogsPanelProps {
  logs: RunLog[]
}

export function RunLogsPanel({ logs }: RunLogsPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Logs</CardTitle>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Logs will appear once the run starts emitting events.</p>
        ) : (
          <div className="space-y-3">
            {logs.map((log, index) => (
              <div key={`${log.timestamp}-${index}`} className="rounded-lg border border-border bg-secondary/40 p-3">
                <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                  <span className={levelClassName[log.level]}>{log.level.toUpperCase()}</span>
                  <span className="text-muted-foreground">{log.step}</span>
                  <span className="text-muted-foreground">{formatDateTime(log.timestamp)}</span>
                </div>
                <p className="text-sm text-foreground">{log.message}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
