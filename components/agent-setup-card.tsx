'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

import type { AgentProviderKeyName, AgentSetup, RiskLevel } from '@/lib/types'
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
import { Eye, EyeOff, KeyRound } from 'lucide-react'
import { toast } from 'sonner'

type AgentSetupFormState = {
  defaultAgentSlug: string
  workspace: string
  timeFormat: AgentSetup['timeFormat']
  modelPrimary: string
  modelFallbacks: string
  subagentsMaxConcurrent: string
}

type VendorApiKeyFormState = Record<AgentProviderKeyName, string>
type VendorApiKeyVisibilityState = Record<AgentProviderKeyName, boolean>

type SetupAgentOption = {
  riskLevel: RiskLevel
  slug: string
  summary: string
  title: string
  version: string
}

const DEFAULT_PROVIDER_KEY_STATUS: AgentSetup['providerKeyStatus'] = {
  anthropic: false,
  google: false,
  openai: false,
  openrouter: false,
}

const DEFAULT_VENDOR_API_KEYS: VendorApiKeyFormState = {
  anthropic: '',
  google: '',
  openai: '',
  openrouter: '',
}

const DEFAULT_KEY_VISIBILITY: VendorApiKeyVisibilityState = {
  anthropic: false,
  google: false,
  openai: false,
  openrouter: false,
}

const PROVIDER_LABELS: Record<AgentProviderKeyName, string> = {
  anthropic: 'Anthropic',
  google: 'Google Gemini',
  openai: 'OpenAI',
  openrouter: 'OpenRouter',
}

const PROVIDER_PLACEHOLDERS: Record<AgentProviderKeyName, string> = {
  anthropic: 'sk-ant-api03-...',
  google: 'AIza...',
  openai: 'sk-proj-...',
  openrouter: 'sk-or-...',
}

function buildDefaultAgentSetup(defaultAgentSlug: string | null): AgentSetup {
  return {
    defaultAgentSlug,
    workspace: '~/.openclaw/workspace',
    timeFormat: 'auto',
    modelPrimary: '',
    modelFallbacks: [],
    providerKeyStatus: DEFAULT_PROVIDER_KEY_STATUS,
    subagentsMaxConcurrent: 1,
  }
}

function toFormState(agentSetup: AgentSetup | null | undefined, defaultAgentSlug: string | null): AgentSetupFormState {
  const next = agentSetup ?? buildDefaultAgentSetup(defaultAgentSlug)

  return {
    defaultAgentSlug: next.defaultAgentSlug ?? defaultAgentSlug ?? '',
    workspace: next.workspace ?? '~/.openclaw/workspace',
    timeFormat: next.timeFormat,
    modelPrimary: next.modelPrimary ?? '',
    modelFallbacks: next.modelFallbacks.join(', '),
    subagentsMaxConcurrent: String(next.subagentsMaxConcurrent ?? 1),
  }
}

function buildRiskTone(riskLevel: RiskLevel) {
  switch (riskLevel) {
    case 'high':
      return 'border-red-500/40 bg-red-500/10 text-red-200'
    case 'medium':
      return 'border-amber-500/40 bg-amber-500/10 text-amber-100'
    default:
      return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100'
  }
}

export function AgentSetupCard(props: {
  availableAgents: SetupAgentOption[]
  initialSetup?: AgentSetup | null
  onSaved: (agentSetup: AgentSetup) => void
  orderId: string
}) {
  const { availableAgents, initialSetup, onSaved, orderId } = props
  const defaultAgentSlug = availableAgents[0]?.slug ?? null
  const [form, setForm] = useState(() => toFormState(initialSetup, defaultAgentSlug))
  const [vendorApiKeys, setVendorApiKeys] = useState<VendorApiKeyFormState>(DEFAULT_VENDOR_API_KEYS)
  const [keyVisibility, setKeyVisibility] = useState<VendorApiKeyVisibilityState>(DEFAULT_KEY_VISIBILITY)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setForm(toFormState(initialSetup, defaultAgentSlug))
    setVendorApiKeys(DEFAULT_VENDOR_API_KEYS)
    setKeyVisibility(DEFAULT_KEY_VISIBILITY)
  }, [defaultAgentSlug, initialSetup])

  const providerKeyStatus = initialSetup?.providerKeyStatus ?? DEFAULT_PROVIDER_KEY_STATUS
  const selectedDefaultAgent = useMemo(
    () => availableAgents.find((agent) => agent.slug === form.defaultAgentSlug) ?? availableAgents[0] ?? null,
    [availableAgents, form.defaultAgentSlug],
  )

  const handleSave = async () => {
    setIsSaving(true)

    try {
      const agentSetup: Omit<AgentSetup, 'providerKeyStatus'> = {
        defaultAgentSlug: form.defaultAgentSlug || defaultAgentSlug,
        workspace: form.workspace.trim() || null,
        timeFormat: form.timeFormat,
        modelPrimary: form.modelPrimary.trim() || null,
        modelFallbacks: form.modelFallbacks
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
        subagentsMaxConcurrent: Number.parseInt(form.subagentsMaxConcurrent, 10) || null,
      }
      const nextVendorApiKeys = Object.fromEntries(
        Object.entries(vendorApiKeys)
          .map(([provider, value]) => [provider, value.trim()])
          .filter(([, value]) => Boolean(value)),
      ) as Partial<Record<AgentProviderKeyName, string>>
      const order = await updateOrderAgentSetup(orderId, {
        agentSetup,
        vendorApiKeys: Object.keys(nextVendorApiKeys).length > 0 ? nextVendorApiKeys : undefined,
      })
      onSaved(
        order.agentSetup ?? {
          ...agentSetup,
          providerKeyStatus,
        },
      )
      setVendorApiKeys(DEFAULT_VENDOR_API_KEYS)
      setKeyVisibility(DEFAULT_KEY_VISIBILITY)
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
          Choose the default agent for inbound messages, then set OpenClaw `agents.defaults` and provider keys for this bundle.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <div>
            <Label>Default Agent</Label>
            <p className="mt-1 text-xs text-muted-foreground">
              OpenClaw sends the first Telegram message to this agent. It can delegate to the others through agent-to-agent routing.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {availableAgents.map((agent) => {
              const selected = agent.slug === form.defaultAgentSlug

              return (
                <button
                  key={agent.slug}
                  type="button"
                  className={`rounded-xl border p-4 text-left transition ${
                    selected
                      ? 'border-primary bg-primary/10 shadow-[0_0_0_1px_hsl(var(--primary)/0.45)]'
                      : 'border-border bg-card hover:border-primary/40 hover:bg-accent/40'
                  }`}
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      defaultAgentSlug: agent.slug,
                    }))
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{agent.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{agent.summary}</p>
                    </div>
                    <span
                      className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-medium uppercase tracking-[0.16em] ${buildRiskTone(
                        agent.riskLevel,
                      )}`}
                    >
                      {agent.riskLevel}
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">v{agent.version}</p>
                </button>
              )
            })}
          </div>
          {selectedDefaultAgent ? (
            <p className="text-xs text-muted-foreground">
              Defaulting inbound chat to <span className="font-medium text-foreground">{selectedDefaultAgent.title}</span>.
            </p>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="agent-setup-workspace">Workspace Base</Label>
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
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <Label htmlFor="agent-setup-model-primary">Primary Model</Label>
                <Link
                  href="https://docs.openclaw.ai/concepts/model-providers"
                  target="_blank"
                  rel="noreferrer"
                  className="block text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  Model refs use <code className="rounded bg-muted px-1 py-0.5 text-[11px] text-foreground">provider/model</code>
                </Link>
              </div>
            </div>
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
              placeholder="openai/gpt-5-mini, openrouter/openai/gpt-4.1-mini"
            />
          <p className="text-xs text-muted-foreground">
              Comma-separated values write to OpenClaw `agents.defaults.model.fallbacks`.
          </p>
        </div>
        </div>

        <div className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg border border-border/70 bg-background p-2">
              <KeyRound className="h-4 w-4" />
            </div>
            <div>
              <Label>Bring Your Own Provider Keys</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Stored server-side and injected into OpenClaw `env` for this bundle only. Leave blank to keep an existing saved key.
              </p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {(Object.keys(PROVIDER_LABELS) as AgentProviderKeyName[]).map((provider) => (
              <div key={provider} className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor={`agent-setup-provider-${provider}`}>{PROVIDER_LABELS[provider]} API Key</Label>
                  <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    {providerKeyStatus[provider] ? 'saved' : 'not set'}
                  </span>
                </div>
                <div className="relative">
                  <Input
                    id={`agent-setup-provider-${provider}`}
                    type={keyVisibility[provider] ? 'text' : 'password'}
                    value={vendorApiKeys[provider]}
                    onChange={(event) =>
                      setVendorApiKeys((current) => ({
                        ...current,
                        [provider]: event.target.value,
                      }))
                    }
                    placeholder={providerKeyStatus[provider] ? 'Saved key on file' : PROVIDER_PLACEHOLDERS[provider]}
                    className="pr-11"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1 h-7 w-7"
                    onClick={() =>
                      setKeyVisibility((current) => ({
                        ...current,
                        [provider]: !current[provider],
                      }))
                    }
                    aria-label={`${keyVisibility[provider] ? 'Hide' : 'Show'} ${PROVIDER_LABELS[provider]} API key`}
                  >
                    {keyVisibility[provider] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
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
