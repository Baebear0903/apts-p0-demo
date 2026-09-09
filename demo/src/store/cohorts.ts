import type { AppState, ComputeTimeRuleExplanation, DynamicCohort, Snapshot } from '../domain/types'
import { buildIncludeExcludeExplanation } from '../engine/evidence'
import { computeIncludeExclude, includeExcludeAvailability } from '../engine/includeExclude'
import { appendBatch, defaultOrgId, toSnapshotMembers } from './compute'
import { currentDynamicMemberIds, sameIds } from './selectors'
import { allocateCohortId, allocateSnapshotId } from './allocate'

export type QueryResult =
  | { ok: false; reason: string }
  | {
      ok: true
      hitPatientIds: string[]
      computedAt: string
      ruleExplanation: ComputeTimeRuleExplanation
    }

export function queryIncludeExclude(
  state: AppState,
  includeTagIds: string[],
  excludeTagIds: string[],
): QueryResult {
  const computed = computeIncludeExclude(state, includeTagIds, excludeTagIds)
  if ('unavailableReason' in computed) return { ok: false, reason: computed.unavailableReason }
  return {
    ok: true,
    hitPatientIds: computed.hitPatientIds,
    computedAt: computed.computedAt,
    ruleExplanation: buildIncludeExcludeExplanation(state, includeTagIds, excludeTagIds),
  }
}

export function saveDynamicCohort(
  state: AppState,
  input: {
    id?: string
    name: string
    includeTagIds: string[]
    excludeTagIds: string[]
    computed?: { hitPatientIds: string[]; computedAt: string; ruleExplanation: ComputeTimeRuleExplanation }
  },
): { ok: true; state: AppState; cohortId: string } | { ok: false; reason: string } {
  if (!state.session.permissions.buttons.cohortCreate && !input.id) {
    return { ok: false, reason: '无人群新建权限' }
  }
  const name = input.name.trim()
  if (!name) return { ok: false, reason: '名称不能为空' }
  if (input.includeTagIds.length === 0) return { ok: false, reason: '至少选择一个纳入标签' }

  const existing = input.id ? state.dynamicCohorts.find((item) => item.id === input.id) : undefined
  const cohortId = existing?.id ?? allocateCohortId(state)
  let nextState = state
  let lastSuccessful = pickMatchingCompute(input)

  if (lastSuccessful) {
    const explanation = {
      ...lastSuccessful.ruleExplanation,
      cohortId,
      cohortName: name,
    }
    const logics = includeExcludeLogics(state, input.includeTagIds, input.excludeTagIds)
    const appended = appendBatch(nextState, {
      kind: existing ? 'dynamic_refresh' : 'active_search',
      computedAt: lastSuccessful.computedAt,
      cohortId,
      ruleExplanation: explanation,
      patientIds: lastSuccessful.hitPatientIds,
      logics,
    })
    nextState = appended.state
    lastSuccessful = { ...lastSuccessful, batchId: appended.batch.id, ruleExplanation: explanation }
  }

  const cohort: DynamicCohort = {
    id: cohortId,
    name,
    type: 'dynamic',
    responsibleOrgId: defaultOrgId(state),
    includeTagIds: [...input.includeTagIds],
    excludeTagIds: [...input.excludeTagIds],
    scopeId: state.currentScopeId,
    lastSuccessfulComputedAt: lastSuccessful?.computedAt,
    lastSuccessfulMemberIds: lastSuccessful?.hitPatientIds,
    lastSuccessfulBatchId: lastSuccessful?.batchId,
    lastSuccessfulIncludeTagIds: lastSuccessful ? [...input.includeTagIds] : existing?.lastSuccessfulIncludeTagIds,
    lastSuccessfulExcludeTagIds: lastSuccessful ? [...input.excludeTagIds] : existing?.lastSuccessfulExcludeTagIds,
    lastSuccessfulRuleExplanation: lastSuccessful?.ruleExplanation ?? existing?.lastSuccessfulRuleExplanation,
  }

  const dynamicCohorts = existing
    ? nextState.dynamicCohorts.map((item) => (item.id === cohortId ? { ...item, ...cohort } : item))
    : [...nextState.dynamicCohorts, cohort]

  return { ok: true, cohortId, state: { ...nextState, dynamicCohorts } }
}

function pickMatchingCompute(input: {
  includeTagIds: string[]
  excludeTagIds: string[]
  computed?: { hitPatientIds: string[]; computedAt: string; ruleExplanation: ComputeTimeRuleExplanation }
}) {
  if (!input.computed) return undefined
  return {
    hitPatientIds: input.computed.hitPatientIds,
    computedAt: input.computed.computedAt,
    ruleExplanation: input.computed.ruleExplanation,
    batchId: undefined as string | undefined,
  }
}

export function saveActiveSnapshot(
  state: AppState,
  input: {
    name: string
    includeTagIds: string[]
    excludeTagIds: string[]
    retainedPatientIds: string[]
    computed: { hitPatientIds: string[]; computedAt: string; ruleExplanation: ComputeTimeRuleExplanation }
  },
): { ok: true; state: AppState; snapshotId: string } | { ok: false; reason: string } {
  if (!state.session.permissions.buttons.cohortSnapshot) return { ok: false, reason: '无生成快照权限' }
  const name = input.name.trim()
  if (!name) return { ok: false, reason: '名称不能为空' }
  const retained = input.retainedPatientIds.filter((id) => input.computed.hitPatientIds.includes(id))
  if (retained.length === 0) return { ok: false, reason: '0 人不能保存快照' }

  const explanation = structuredClone(input.computed.ruleExplanation)
  const logics = includeExcludeLogics(state, input.includeTagIds, input.excludeTagIds)
  const appended = appendBatch(state, {
    kind: 'active_search',
    computedAt: input.computed.computedAt,
    ruleExplanation: explanation,
    patientIds: input.computed.hitPatientIds,
    logics,
  })
  const snapshotId = allocateSnapshotId(appended.state)
  const snapshot: Snapshot = {
    id: snapshotId,
    name,
    type: 'snapshot',
    responsibleOrgId: defaultOrgId(state),
    sourceType: 'active_query',
    sourceBatchId: appended.batch.id,
    confirmedBy: state.operatorId,
    confirmedAt: state.clock,
    computedAt: input.computed.computedAt,
    members: toSnapshotMembers(state, retained, input.computed.computedAt),
    scopeId: state.currentScopeId,
    ruleExplanation: explanation,
  }
  return { ok: true, snapshotId, state: { ...appended.state, snapshots: [...appended.state.snapshots, snapshot] } }
}

export function refreshDynamicCohort(
  state: AppState,
  cohortId: string,
): { ok: true; state: AppState } | { ok: false; reason: string } {
  if (!state.session.permissions.buttons.cohortRefresh) return { ok: false, reason: '无刷新权限' }
  const cohort = state.dynamicCohorts.find((item) => item.id === cohortId)
  if (!cohort) return { ok: false, reason: '动态人群不存在' }
  const computed = queryIncludeExclude(state, cohort.includeTagIds, cohort.excludeTagIds)
  if (!computed.ok) return { ok: false, reason: computed.reason }

  const explanation = { ...computed.ruleExplanation, cohortId: cohort.id, cohortName: cohort.name }
  const appended = appendBatch(state, {
    kind: 'dynamic_refresh',
    computedAt: computed.computedAt,
    cohortId: cohort.id,
    ruleExplanation: explanation,
    patientIds: computed.hitPatientIds,
    logics: includeExcludeLogics(state, cohort.includeTagIds, cohort.excludeTagIds),
  })
  const next: DynamicCohort = {
    ...cohort,
    lastSuccessfulComputedAt: computed.computedAt,
    lastSuccessfulMemberIds: computed.hitPatientIds,
    lastSuccessfulBatchId: appended.batch.id,
    lastSuccessfulIncludeTagIds: [...cohort.includeTagIds],
    lastSuccessfulExcludeTagIds: [...cohort.excludeTagIds],
    lastSuccessfulRuleExplanation: explanation,
  }
  return {
    ok: true,
    state: {
      ...appended.state,
      dynamicCohorts: appended.state.dynamicCohorts.map((item) => (item.id === cohortId ? next : item)),
    },
  }
}

export function confirmSnapshotFromDynamic(
  state: AppState,
  cohortId: string,
  retainedPatientIds: string[],
  name?: string,
): { ok: true; state: AppState; snapshotId: string } | { ok: false; reason: string } {
  if (!state.session.permissions.buttons.cohortSnapshot) return { ok: false, reason: '无生成快照权限' }
  const cohort = state.dynamicCohorts.find((item) => item.id === cohortId)
  if (!cohort) return { ok: false, reason: '动态人群不存在' }
  const members = currentDynamicMemberIds(state, cohortId)
  if (members === 'not_computed') return { ok: false, reason: '尚未计算，不能确认快照' }
  const allowed = new Set(members)
  const retained = retainedPatientIds.filter((id) => allowed.has(id))
  if (retained.length === 0) return { ok: false, reason: '0 人不能确认快照' }

  const snapshotId = allocateSnapshotId(state)
  const snapshot: Snapshot = {
    id: snapshotId,
    name: (name ?? `${cohort.name}确认快照`).trim(),
    type: 'snapshot',
    responsibleOrgId: defaultOrgId(state),
    sourceType: 'active_query',
    sourceBatchId: cohort.lastSuccessfulBatchId,
    confirmedBy: state.operatorId,
    confirmedAt: state.clock,
    computedAt: cohort.lastSuccessfulComputedAt ?? state.clock,
    members: toSnapshotMembers(state, retained, cohort.lastSuccessfulComputedAt ?? state.clock),
    scopeId: state.currentScopeId,
    ruleExplanation: structuredClone(cohort.lastSuccessfulRuleExplanation),
  }
  return { ok: true, snapshotId, state: { ...state, snapshots: [...state.snapshots, snapshot] } }
}

export function adjustSnapshotMembers(
  state: AppState,
  snapshotId: string,
  retainedPatientIds: string[],
  name?: string,
): { ok: true; state: AppState; snapshotId: string } | { ok: false; reason: string } {
  if (!state.session.permissions.buttons.cohortSnapshot) return { ok: false, reason: '无生成快照权限' }
  const original = state.snapshots.find((item) => item.id === snapshotId)
  if (!original) return { ok: false, reason: '快照不存在' }
  const allowed = new Set(original.members.map((item) => item.patientId))
  const retained = original.members.filter((item) => retainedPatientIds.includes(item.patientId) && allowed.has(item.patientId))
  if (retained.length === 0) return { ok: false, reason: '零人不生成新快照' }

  const nextId = allocateSnapshotId(state)
  const snapshot: Snapshot = {
    ...original,
    id: nextId,
    name: (name ?? `${original.name}调整`).trim(),
    sourceType: 'from_snapshot',
    sourceSnapshotId: original.id,
    sourceBatchId: original.sourceBatchId,
    confirmedBy: state.operatorId,
    confirmedAt: state.clock,
    members: retained.map((item) => ({ ...item })),
    ruleExplanation: structuredClone(original.ruleExplanation),
  }
  return { ok: true, snapshotId: nextId, state: { ...state, snapshots: [...state.snapshots, snapshot] } }
}

export function updateDynamicCohortConditions(
  state: AppState,
  cohortId: string,
  input: { name?: string; includeTagIds: string[]; excludeTagIds: string[] },
): { ok: true; state: AppState } | { ok: false; reason: string } {
  if (!state.session.permissions.buttons.cohortEdit) return { ok: false, reason: '无编辑权限' }
  const cohort = state.dynamicCohorts.find((item) => item.id === cohortId)
  if (!cohort) return { ok: false, reason: '动态人群不存在' }
  if (input.includeTagIds.length === 0) return { ok: false, reason: '至少选择一个纳入标签' }
  const availability = includeExcludeAvailability(state, input.includeTagIds, input.excludeTagIds)
  if (!availability.ok) {
    // 允许保存失效条件，下一次计算再阻断；但缺授权仍阻止
    if (availability.reason.includes('缺标签使用授权')) return { ok: false, reason: availability.reason }
  }
  const name = input.name?.trim() || cohort.name
  const conditionsChanged =
    !sameIds(input.includeTagIds, cohort.includeTagIds) || !sameIds(input.excludeTagIds, cohort.excludeTagIds)
  const next: DynamicCohort = {
    ...cohort,
    name,
    includeTagIds: [...input.includeTagIds],
    excludeTagIds: [...input.excludeTagIds],
    lastSuccessfulMemberIds: conditionsChanged ? cohort.lastSuccessfulMemberIds : cohort.lastSuccessfulMemberIds,
    lastSuccessfulIncludeTagIds: conditionsChanged
      ? cohort.lastSuccessfulIncludeTagIds
      : cohort.lastSuccessfulIncludeTagIds,
  }
  return {
    ok: true,
    state: {
      ...state,
      dynamicCohorts: state.dynamicCohorts.map((item) => (item.id === cohortId ? next : item)),
    },
  }
}

function includeExcludeLogics(state: AppState, includeTagIds: string[], excludeTagIds: string[]) {
  return [...includeTagIds, ...excludeTagIds]
    .map((id) => state.tags.find((item) => item.id === id)?.logic)
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
}