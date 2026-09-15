import { createInitialState, defaultPermissions } from '../data/seed'
import { addMinutes } from '../demo/clock'
import type {
  AppState,
  ButtonPermissionKey,
  DemoPermissions,
  Metric,
  ModuleKey,
  RuleSamplePartition,
  Tag,
} from '../domain/types'
import { metricReferences, tagImpact } from '../engine/availability'
import { canChangeMetricBinding, validateMetricDraft, validateTag } from '../engine/validate'
import { syncOpenStatuses } from './open'

export {
  allocateBatchId,
  allocateCohortId,
  allocateDeliveryId,
  allocateMetricId,
  allocateOpenId,
  allocateResultVersion,
  allocateReviewId,
  allocateSnapshotId,
  allocateSystemId,
  allocateTagId,
} from './allocate'

export function cloneState<T>(value: T): T {
  return structuredClone(value)
}

export function resetState(): AppState {
  return createInitialState()
}

export function setClock(state: AppState, iso: string): AppState {
  return syncOpenStatuses({ ...state, clock: iso })
}

export function advanceClock(state: AppState, minutes: number): AppState {
  return setClock(state, addMinutes(state.clock, minutes))
}

export function setSimulateFailure(state: AppState, simulateFailure: boolean): AppState {
  return { ...state, session: { ...state.session, simulateFailure } }
}

export function setModulePermission(state: AppState, key: ModuleKey, enabled: boolean): AppState {
  return {
    ...state,
    session: {
      ...state.session,
      permissions: {
        ...state.session.permissions,
        modules: { ...state.session.permissions.modules, [key]: enabled },
      },
    },
  }
}

export function setButtonPermission(state: AppState, key: ButtonPermissionKey, enabled: boolean): AppState {
  return {
    ...state,
    session: {
      ...state.session,
      permissions: {
        ...state.session.permissions,
        buttons: { ...state.session.permissions.buttons, [key]: enabled },
      },
    },
  }
}

export function loadRuleSamples(state: AppState): AppState {
  const workingCopy: RuleSamplePartition = cloneState(state.ruleSamples)
  return {
    ...state,
    session: {
      ...state.session,
      mode: 'ruleSamples',
      ruleSampleWorkingCopy: workingCopy,
    },
  }
}

export function unloadRuleSamples(state: AppState): AppState {
  return {
    ...state,
    session: {
      ...state.session,
      mode: 'business',
      ruleSampleWorkingCopy: null,
    },
  }
}

export function restoreDefaultPermissions(state: AppState): AppState {
  const permissions: DemoPermissions = defaultPermissions()
  return { ...state, session: { ...state.session, permissions } }
}

export function updateRuleSampleWorkingCopy(
  state: AppState,
  updater: (partition: RuleSamplePartition) => RuleSamplePartition,
): AppState {
  const current = state.session.ruleSampleWorkingCopy
  if (!current) return state
  return {
    ...state,
    session: {
      ...state.session,
      ruleSampleWorkingCopy: updater(cloneState(current)),
    },
  }
}

export function setAuthorizedTagIds(state: AppState, authorizedTagIds: string[] | null): AppState {
  return { ...state, session: { ...state.session, authorizedTagIds } }
}

export function upsertMetric(state: AppState, metric: Metric): AppState {
  const existing = state.metrics.find((item) => item.id === metric.id)
  if (existing) {
    const compatibility = canChangeMetricBinding(state, existing, metric)
    if (!compatibility.ok) return state
  }
  const errors = validateMetricDraft(metric, state)
  if (errors.length > 0) return state
  const metrics = existing
    ? state.metrics.map((item) => (item.id === metric.id ? metric : item))
    : [...state.metrics, metric]
  return { ...state, metrics }
}

export function saveMetric(
  state: AppState,
  metric: Metric,
): { ok: true; state: AppState } | { ok: false; errors: string[] } {
  if (!state.session.permissions.buttons.metricMaintain) {
    return { ok: false, errors: ['无指标维护权限'] }
  }
  const errors = validateMetricDraft(metric, state)
  const existing = state.metrics.find((item) => item.id === metric.id)
  if (existing) {
    const compatibility = canChangeMetricBinding(state, existing, metric)
    if (!compatibility.ok) return { ok: false, errors: [compatibility.reason] }
  }
  if (errors.length > 0) return { ok: false, errors }
  const metrics = existing
    ? state.metrics.map((item) => (item.id === metric.id ? { ...metric, name: metric.name.trim() } : item))
    : [...state.metrics, { ...metric, name: metric.name.trim() }]
  return { ok: true, state: { ...state, metrics } }
}

export function disableMetric(state: AppState, metricId: string): AppState {
  return {
    ...state,
    metrics: state.metrics.map((item) => (item.id === metricId ? { ...item, status: 'disabled' } : item)),
  }
}

export function restoreMetric(state: AppState, metricId: string): AppState {
  return {
    ...state,
    metrics: state.metrics.map((item) => (item.id === metricId ? { ...item, status: 'active' } : item)),
  }
}

export function deleteMetric(
  state: AppState,
  metricId: string,
): { ok: true; state: AppState } | { ok: false; reason: string; references: ReturnType<typeof metricReferences> } {
  const references = metricReferences(state, metricId)
  if (references.tags.length > 0 || references.derived.length > 0) {
    return { ok: false, reason: '指标仍被引用，不能删除', references }
  }
  return {
    ok: true,
    state: {
      ...state,
      metrics: state.metrics.filter((item) => item.id !== metricId),
      retiredIds: [...state.retiredIds, metricId],
    },
  }
}

export function upsertTag(state: AppState, tag: Tag): AppState {
  const existing = state.tags.some((item) => item.id === tag.id)
  const tags = existing
    ? state.tags.map((item) => (item.id === tag.id ? tag : item))
    : [...state.tags, tag]
  return { ...state, tags }
}

export function saveTag(
  state: AppState,
  tag: Tag,
  mode: 'draft' | 'strict',
): { ok: true; state: AppState } | { ok: false; errors: string[] } {
  const buttons = state.session.permissions.buttons
  if (mode === 'strict' && tag.status === 'draft' && !buttons.tagPublish) {
    return { ok: false, errors: ['无发布权限'] }
  }
  if (mode === 'draft' && !buttons.tagEdit) {
    return { ok: false, errors: ['无编辑权限'] }
  }
  if (mode === 'strict' && tag.status !== 'draft' && !buttons.tagEdit) {
    return { ok: false, errors: ['无编辑权限'] }
  }
  const next: Tag = {
    ...tag,
    name: tag.name.trim(),
    updatedAt: state.clock,
    updatedBy: state.operatorId,
  }
  const errors = validateTag(state, next, mode)
  if (errors.length > 0) return { ok: false, errors }
  const saved: Tag =
    mode === 'strict' && next.status === 'draft' ? { ...next, status: 'published' } : next
  return { ok: true, state: upsertTag(state, saved) }
}

export function disableTag(state: AppState, tagId: string): AppState {
  return {
    ...state,
    tags: state.tags.map((item) =>
      item.id === tagId ? { ...item, status: 'manually_disabled', updatedAt: state.clock, updatedBy: state.operatorId } : item,
    ),
  }
}

export function restoreTag(state: AppState, tagId: string): AppState {
  return {
    ...state,
    tags: state.tags.map((item) =>
      item.id === tagId && item.status === 'manually_disabled'
        ? { ...item, status: 'published', updatedAt: state.clock, updatedBy: state.operatorId }
        : item,
    ),
  }
}

export function deleteTag(
  state: AppState,
  tagId: string,
): { ok: true; state: AppState; impact: ReturnType<typeof tagImpact> } | { ok: false; reason: string } {
  const tag = state.tags.find((item) => item.id === tagId)
  if (!tag) return { ok: false, reason: '标签不存在' }
  const impact = tagImpact(state, tagId)
  if (tag.status === 'draft' && impact.compositeTags.length > 0) {
    return { ok: false, reason: '草稿仍被引用，不能删除' }
  }
  if (tag.status === 'published') {
    return { ok: false, reason: '已发布标签须先人工停用再删除' }
  }
  if (tag.status === 'deleted') return { ok: false, reason: '标签已删除' }
  return {
    ok: true,
    impact,
    state: {
      ...state,
      tags: state.tags.map((item) =>
        item.id === tagId
          ? {
              ...item,
              status: 'deleted',
              autoRecognitionEnabled: false,
              updatedAt: state.clock,
              updatedBy: state.operatorId,
            }
          : item,
      ),
      retiredIds: [...state.retiredIds, tagId],
    },
  }
}

export { generateAutoRecognitionBatch, removeFromReview, undoRemoveFromReview, confirmRecognitionBatch } from './recognition'
export {
  queryIncludeExclude,
  saveDynamicCohort,
  saveActiveSnapshot,
  refreshDynamicCohort,
  confirmSnapshotFromDynamic,
  adjustSnapshotMembers,
  updateDynamicCohortConditions,
} from './cohorts'
export {
  saveOpenConfig,
  enableOpenConfig,
  pauseOpenConfig,
  resumeOpenConfig,
  downloadOpenCsv,
  simulateChannelDelivery,
  computeSubscriptionResult,
  queryOpenConfig,
  pushOpenConfig,
  advanceToNextPush,
  simulateOpenExpiry,
  consumerAfterSystemSelect,
  openStatus,
  openRuntime,
} from './open'
export { saveConnectedSystem, disableConnectedSystem, restoreConnectedSystem, stampSystemValidated } from './systems'

export function setTagAutoRecognition(
  state: AppState,
  tagId: string,
  enabled: boolean,
  intervalDays?: number,
): { ok: true; state: AppState } | { ok: false; reason: string } {
  const tag = state.tags.find((item) => item.id === tagId)
  if (!tag) return { ok: false, reason: '标签不存在' }
  if (enabled && tag.status !== 'published') return { ok: false, reason: '未发布不能开启自动识别' }
  if (enabled && (!intervalDays || intervalDays < 1)) return { ok: false, reason: '自动识别周期须为正整数天' }
  return {
    ok: true,
    state: {
      ...state,
      tags: state.tags.map((item) =>
        item.id === tagId
          ? {
              ...item,
              autoRecognitionEnabled: enabled,
              autoRecognitionIntervalDays: enabled ? intervalDays : item.autoRecognitionIntervalDays,
              updatedAt: state.clock,
              updatedBy: state.operatorId,
            }
          : item,
      ),
    },
  }
}
