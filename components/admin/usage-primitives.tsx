import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'
import type { AdminMetricFormat, AdminSignal, OverviewMetric } from '@/lib/admin-usage-data'

const signalClasses: Record<AdminSignal, string> = {
  stable: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
  info: 'border-sky-400/30 bg-sky-400/10 text-sky-200',
  warning: 'border-amber-300/30 bg-amber-300/10 text-amber-100',
  critical: 'border-red-400/30 bg-red-400/10 text-red-200',
}

export function formatMetricValue(value: number, format: AdminMetricFormat) {
  switch (format) {
    case 'percent':
      return `${Math.round(value * 100)}%`
    case 'credits':
      return `${value.toLocaleString('en-US')} cr`
    case 'currency':
      return `$${(value / 100).toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      })}`
    default:
      return value.toLocaleString('en-US')
  }
}

export function formatMinutes(value: number) {
  return `${value.toLocaleString('en-US')} min`
}

export function SignalPill({
  tone,
  children,
  className,
}: {
  tone: AdminSignal
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-[0.18em] uppercase',
        signalClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function Panel({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'rounded-[1.25rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] shadow-[0_24px_60px_rgba(0,0,0,0.24)] backdrop-blur-sm',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="space-y-2">
        <p className="text-[11px] font-medium tracking-[0.24em] uppercase text-amber-100/70">{eyebrow}</p>
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-white">{title}</h2>
          <p className="max-w-3xl text-sm text-zinc-400">{description}</p>
        </div>
      </div>
      {action}
    </div>
  )
}

export function MetricCard({ metric }: { metric: OverviewMetric }) {
  return (
    <Panel className="overflow-hidden">
      <div className="space-y-5 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] tracking-[0.2em] uppercase text-zinc-500">{metric.label}</p>
            <p className="mt-3 text-3xl font-semibold text-white">{formatMetricValue(metric.value, metric.format)}</p>
          </div>
          <SignalPill tone={metric.tone}>{metric.delta}</SignalPill>
        </div>
        <p className="text-sm leading-6 text-zinc-400">{metric.detail}</p>
      </div>
    </Panel>
  )
}

export function MiniStat({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail?: string
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/15 p-4">
      <p className="text-[11px] tracking-[0.2em] uppercase text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      {detail ? <p className="mt-1 text-xs text-zinc-500">{detail}</p> : null}
    </div>
  )
}
