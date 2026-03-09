import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { RunArtifact } from '@/lib/types'
import { Download, FileText } from 'lucide-react'

function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

interface RunResultsPanelProps {
  summary: string | null
  artifacts: RunArtifact[]
}

export function RunResultsPanel({ summary, artifacts }: RunResultsPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Results</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="mb-1 text-xs text-muted-foreground">Summary</div>
          <p className="text-sm text-foreground">
            {summary ?? 'No result summary yet. Completed runs will surface a concise outcome here.'}
          </p>
        </div>

        <div>
          <div className="mb-3 text-xs text-muted-foreground">Artifacts</div>
          {artifacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No artifacts available for this run yet.</p>
          ) : (
            <div className="space-y-3">
              {artifacts.map((artifact) => (
                <div key={artifact.id} className="flex flex-col gap-3 rounded-lg border border-border bg-secondary/40 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-background">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">{artifact.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {artifact.type} • {formatFileSize(artifact.size)}
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={artifact.downloadUrl}>
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
