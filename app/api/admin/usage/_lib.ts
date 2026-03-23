import { NextRequest, NextResponse } from 'next/server'

import type { AdminUsageSnapshot } from '@/lib/admin-usage-data'
import { requireAdminApiRequest } from '@/server/lib/route-security'
import { getAdminUsageSnapshot } from '@/server/services/admin-usage.service'

export function getAdminWindowInput(request: NextRequest) {
  return {
    end: request.nextUrl.searchParams.get('end'),
    range: request.nextUrl.searchParams.get('range'),
    start: request.nextUrl.searchParams.get('start'),
  }
}

export async function getAdminSnapshotFromRequest(request: NextRequest) {
  return getAdminUsageSnapshot(getAdminWindowInput(request))
}

export async function authorizeAdminRequest(request: NextRequest) {
  return requireAdminApiRequest(request)
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
    customEndDate: snapshot.customEndDate,
    customStartDate: snapshot.customStartDate,
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
    customEndDate: snapshot.customEndDate,
    customStartDate: snapshot.customStartDate,
    generatedAt: snapshot.generatedAt,
    selectedRange: snapshot.selectedRange,
    windowLabel: snapshot.windowLabel,
  }
}

export function buildAdminFunnel(snapshot: AdminUsageSnapshot) {
  return {
    blockedLaunches: snapshot.blockedLaunches,
    customEndDate: snapshot.customEndDate,
    customStartDate: snapshot.customStartDate,
    generatedAt: snapshot.generatedAt,
    launchFunnel: snapshot.launchFunnel,
    selectedRange: snapshot.selectedRange,
    windowLabel: snapshot.windowLabel,
  }
}

export function buildAdminBlockers(snapshot: AdminUsageSnapshot) {
  return {
    blockedLaunches: snapshot.blockedLaunches,
    customEndDate: snapshot.customEndDate,
    customStartDate: snapshot.customStartDate,
    generatedAt: snapshot.generatedAt,
    selectedRange: snapshot.selectedRange,
    windowLabel: snapshot.windowLabel,
  }
}

export function buildAdminRuntimeUsage(snapshot: AdminUsageSnapshot) {
  return {
    customEndDate: snapshot.customEndDate,
    customStartDate: snapshot.customStartDate,
    generatedAt: snapshot.generatedAt,
    runtimeUsage: snapshot.runtimeUsage,
    selectedRange: snapshot.selectedRange,
    windowLabel: snapshot.windowLabel,
  }
}

export function buildAdminBillingHealth(snapshot: AdminUsageSnapshot) {
  return {
    billingHealth: snapshot.billingHealth,
    customEndDate: snapshot.customEndDate,
    customStartDate: snapshot.customStartDate,
    generatedAt: snapshot.generatedAt,
    selectedRange: snapshot.selectedRange,
    windowLabel: snapshot.windowLabel,
  }
}

export function buildAdminUsers(snapshot: AdminUsageSnapshot) {
  return {
    customEndDate: snapshot.customEndDate,
    customStartDate: snapshot.customStartDate,
    generatedAt: snapshot.generatedAt,
    selectedRange: snapshot.selectedRange,
    users: snapshot.users,
    windowLabel: snapshot.windowLabel,
  }
}

export function buildAdminAlwaysOn(snapshot: AdminUsageSnapshot) {
  return {
    alwaysOnShadow: snapshot.alwaysOnShadow,
    customEndDate: snapshot.customEndDate,
    customStartDate: snapshot.customStartDate,
    generatedAt: snapshot.generatedAt,
    selectedRange: snapshot.selectedRange,
    windowLabel: snapshot.windowLabel,
  }
}
