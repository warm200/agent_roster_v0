import { NextRequest, NextResponse } from 'next/server'

import { type AdminDateRange, type AdminUsageSnapshot } from '@/lib/admin-usage-data'
import { getAdminUsageSnapshot } from '@/server/services/admin-usage.service'

export function getAdminRange(request: NextRequest): AdminDateRange | undefined {
  const value = request.nextUrl.searchParams.get('range')
  return value === '24h' || value === '7d' || value === '30d' ? value : undefined
}

export async function getAdminSnapshotFromRequest(request: NextRequest) {
  return getAdminUsageSnapshot(getAdminRange(request))
}

export function adminJson(data: unknown) {
  return NextResponse.json(data, {
    headers: {
      'cache-control': 'no-store',
    },
    status: 200,
  })
}

export function buildAdminOverview(snapshot: AdminUsageSnapshot) {
  return {
    alerts: snapshot.alerts,
    environment: snapshot.environment,
    generatedAt: snapshot.generatedAt,
    implementationNote: snapshot.implementationNote,
    overviewMetrics: snapshot.overviewMetrics,
    selectedRange: snapshot.selectedRange,
    windowLabel: snapshot.windowLabel,
  }
}

export function buildAdminAlerts(snapshot: AdminUsageSnapshot) {
  return {
    alerts: snapshot.alerts,
    generatedAt: snapshot.generatedAt,
    selectedRange: snapshot.selectedRange,
    windowLabel: snapshot.windowLabel,
  }
}

export function buildAdminFunnel(snapshot: AdminUsageSnapshot) {
  return {
    blockedLaunches: snapshot.blockedLaunches,
    generatedAt: snapshot.generatedAt,
    launchFunnel: snapshot.launchFunnel,
    selectedRange: snapshot.selectedRange,
    windowLabel: snapshot.windowLabel,
  }
}

export function buildAdminRuntimeUsage(snapshot: AdminUsageSnapshot) {
  return {
    generatedAt: snapshot.generatedAt,
    runtimeUsage: snapshot.runtimeUsage,
    selectedRange: snapshot.selectedRange,
    windowLabel: snapshot.windowLabel,
  }
}

export function buildAdminBillingHealth(snapshot: AdminUsageSnapshot) {
  return {
    billingHealth: snapshot.billingHealth,
    generatedAt: snapshot.generatedAt,
    selectedRange: snapshot.selectedRange,
    windowLabel: snapshot.windowLabel,
  }
}

export function buildAdminUsers(snapshot: AdminUsageSnapshot) {
  return {
    generatedAt: snapshot.generatedAt,
    selectedRange: snapshot.selectedRange,
    users: snapshot.users,
    windowLabel: snapshot.windowLabel,
  }
}

export function buildAdminAlwaysOn(snapshot: AdminUsageSnapshot) {
  return {
    alwaysOnShadow: snapshot.alwaysOnShadow,
    generatedAt: snapshot.generatedAt,
    selectedRange: snapshot.selectedRange,
    windowLabel: snapshot.windowLabel,
  }
}
