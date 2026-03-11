'use client'

import { useEffect, useState } from 'react'

import type { AgentSetup } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { updateOrderAgentSetup } from '@/services/orders.api'
import { toast } from 'sonner'

type AgentSetupFormState = {
  workspace: string
  timeFormat: AgentSetup['timeFormat']
  modelPrimary: string
  modelFallbacks: string
  subagentsMaxConcurrent: string
}

const DEFAULT_AGENT_SETUP: AgentSetup = {
  workspace: '~/.openclaw/workspace',
  timeFormat: 'auto',
  modelPrimary: '',
  modelFallbacks: [],
  subagentsMaxConcurrent: 1,
}

function toFormState(agentSetup?: AgentSetup | null): AgentSetupFormState {
  const next = agentSetup ?? DEFAULT_AGENT_SETUP
  return {
    workspace: next.workspace ?? DEFAULT_AGENT_SETUP.workspace ?? '',
    timeFormat: next.timeFormat,
    modelPrimary: next.modelPrimary ?? '',
    modelFallbacks: next.modelFallbacks.join(', '),
    subagentsMaxConcurrent: String(next.subagentsMaxConcurrent ?? DEFAULT_AGENT_SETUP.subagentsMaxConcurrent ?? 1),
  }
}

export function AgentSetupCard(props: {
  initialSetup?: AgentSetup | null
  onSaved: (agentSetup: AgentSetup) => void
  orderId: string
}) {
  const { initialSetup, onSaved, orderId } = props
  const [form, setForm] = useState(() => toFormState(initialSetup))
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setForm(toFormState(initialSetup))
  }, [initialSetup])

  const handleSave = async () => {
    setIsSaving(true)

    try {
      const agentSetup: AgentSetup = {
        workspace: form.workspace.trim() || null,
        timeFormat: form.timeFormat as AgentSetup['timeFormat'],
        modelPrimary: form.modelPrimary.trim() || null,
        modelFallbacks: form.modelFallbacks
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
        subagentsMaxConcurrent: Number.parseInt(form.subagentsMaxConcurrent, 10) || null,
      }

      const order = await updateOrderAgentSetup(orderId, agentSetup)
      onSaved(order.agentSetup ?? agentSetup)
      toast.success('Agent setup saved')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save agent setup')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agent Setup</CardTitle>
        <CardDescription>
          These values map to OpenClaw `agents.defaults` and will be injected into the sandbox before the gateway starts.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="agent-setup-workspace">Workspace</Label>
          <Input
            id="agent-setup-workspace"
            value={form.workspace}
            onChange={(event) => setForm((current) => ({ ...current, workspace: event.target.value }))}
            placeholder="~/.openclaw/workspace"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="agent-setup-time-format">Time Format</Label>
          <Select
            value={form.timeFormat}
            onValueChange={(value) =>
              setForm((current) => ({
                ...current,
                timeFormat: value as AgentSetup['timeFormat'],
              }))
            }
          >
            <SelectTrigger id="agent-setup-time-format">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto</SelectItem>
              <SelectItem value="12">12-hour</SelectItem>
              <SelectItem value="24">24-hour</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="agent-setup-model-primary">Primary Model</Label>
          <Input
            id="agent-setup-model-primary"
            value={form.modelPrimary}
            onChange={(event) => setForm((current) => ({ ...current, modelPrimary: event.target.value }))}
            placeholder="anthropic/claude-sonnet-4-5"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="agent-setup-subagents">Max Concurrent Subagents</Label>
          <Input
            id="agent-setup-subagents"
            type="number"
            min={1}
            max={16}
            value={form.subagentsMaxConcurrent}
            onChange={(event) =>
              setForm((current) => ({ ...current, subagentsMaxConcurrent: event.target.value }))
            }
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="agent-setup-model-fallbacks">Fallback Models</Label>
          <Input
            id="agent-setup-model-fallbacks"
            value={form.modelFallbacks}
            onChange={(event) => setForm((current) => ({ ...current, modelFallbacks: event.target.value }))}
            placeholder="openai/gpt-5-mini, openrouter/anthropic/claude-3.7-sonnet"
          />
          <p className="text-xs text-muted-foreground">
            Comma-separated. These will be written to `agents.defaults.model.fallbacks`.
          </p>
        </div>

        <div className="md:col-span-2">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                Saving...
              </>
            ) : (
              'Save Agent Setup'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
