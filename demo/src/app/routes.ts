export const ROUTES = {
  workbench: '/',
  tags: '/tags',
  tagNew: '/tags/new',
  tagDetail: '/tags/:id',
  recognition: '/recognition',
  recognitionBatch: '/recognition/:tagId/batches/:batchId',
  cohorts: '/cohorts',
  cohortNew: '/cohorts/new',
  cohortDetail: '/cohorts/:id',
  open: '/open',
  openNew: '/open/new',
  openDetail: '/open/:id',
  analytics: '/analytics',
  admin: '/admin',
  adminDatasets: '/admin/datasets',
  adminMetrics: '/admin/metrics',
  adminSystems: '/admin/systems',
  adminAuth: '/admin/auth',
  adminScopes: '/admin/scopes',
  patient: '/patients/:id',
} as const

export function tagDetailPath(id: string): string {
  return `/tags/${encodeURIComponent(id)}`
}

export function tagNewPath(type: 'basic' | 'composite' = 'basic'): string {
  return `/tags/new?type=${type}`
}

export function recognitionBatchPath(tagId: string, batchId: string): string {
  return `/recognition/${encodeURIComponent(tagId)}/batches/${encodeURIComponent(batchId)}`
}

export function cohortDetailPath(id: string): string {
  return `/cohorts/${encodeURIComponent(id)}`
}

export function openDetailPath(id: string): string {
  return `/open/${encodeURIComponent(id)}`
}

export function openListPath(filters?: { type?: string; status?: string }): string {
  const params = new URLSearchParams()
  if (filters?.type && filters.type !== 'all') params.set('type', filters.type)
  if (filters?.status && filters.status !== 'all') params.set('status', filters.status)
  const query = params.toString()
  return query ? `${ROUTES.open}?${query}` : ROUTES.open
}

export function openNewPath(input?: { type?: string; snapshotId?: string; cohortId?: string }): string {
  const params = new URLSearchParams()
  if (input?.type) params.set('type', input.type)
  if (input?.snapshotId) params.set('snapshotId', input.snapshotId)
  if (input?.cohortId) params.set('cohortId', input.cohortId)
  const query = params.toString()
  return query ? `${ROUTES.openNew}?${query}` : ROUTES.openNew
}

export function patientPath(id: string, from?: string): string {
  const base = `/patients/${encodeURIComponent(id)}`
  return from ? `${base}?from=${encodeURIComponent(from)}` : base
}

export const HTTP_CHECK_PATHS = [
  ROUTES.workbench,
  ROUTES.tags,
  ROUTES.recognition,
  ROUTES.cohorts,
  ROUTES.open,
  ROUTES.analytics,
  ROUTES.adminDatasets,
  ROUTES.adminAuth,
  ROUTES.adminScopes,
  ROUTES.adminMetrics,
  ROUTES.adminSystems,
] as const
