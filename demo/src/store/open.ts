import { addMinutes, isAtOrAfter, minutesBetween } from '../demo/clock'
import type {
  AppState,
  ConnectedSystem,
  DeliveryMethod,
  OpenConfig,
  OpenConfigStatus,
  OpenConfigType,
  OpenDeliveryRecord,
  Snapshot,
} from '../domain/types'
import { computeIncludeExclude, includeExcludeAvailability } from '../engine/includeExclude'
import { allocateDeliveryId, allocateOpenId, allocateResultVersion } from './allocate'
import { defaultOrgId } from './compute'
import { buildSnapshotCsv } from './csv'

export const PAUSE_MANUAL = '人工暂停'
export const PAUSE_SYSTEM_DISABLED = '系统停用'
export const PAUSE_SYSTEM_RESTORED = '系统已恢复，待人工恢复'

export const DATASET_METHODS: DeliveryMethod[] = ['direct_export', 'snapshot_channel']
export const SUBSCRIPTION_METHODS: DeliveryMethod[] = ['on_demand_query', 'scheduled_full_push']

export type OpenConfigInput = {
  id?: string
  name: string
  type: OpenConfigType
  consumer: string
  purpose: string
  description?: string
  boundSnapshotId?: string
  boundDynamicCohortId?: string
  method: DeliveryMethod
  systemId?: string
  responsibleOrgId?: string
  validUntil?: string | null
  pushPeriodMinutes?: number
}

export type OpenRuntime = {
  status: OpenConfigStatus
  statusNote?: string
  pauseReasons: string[]
  dependencyReasons: string[]
  displayReasons: string[]
  blocked: boolean
}

export function openStatusLabel(status: OpenConfigStatus): string {
  if (status === 'enabled') return '授权已启用'
  if (status === 'paused') return '已暂停'
  if (status === 'expired') return '已到期'
  return '草稿'
}

export function openTypeLabel(type: OpenConfigType): string {
  return type === 'dataset_delivery' ? '数据集交付' : '标签订阅'
}

export function methodLabel(method: DeliveryMethod): string {
  if (method === 'direct_export') return '直接导出'
  if (method === 'snapshot_channel') return '一次性快照通道交付'
  if (method === 'on_demand_query') return '按需查询'
  if (method === 'scheduled_full_push') return '定时全量推送'
  return method
}

export function methodsForType(type: OpenConfigType): DeliveryMethod[] {
  return type === 'dataset_delivery' ? DATASET_METHODS : SUBSCRIPTION_METHODS
}

export function consumerAfterSystemSelect(currentConsumer: string, system: ConnectedSystem): string {
  return currentConsumer.trim() === '' ? system.defaultConsumer : currentConsumer
}

export function deriveOpenStatus(clock: string, config: OpenConfig): OpenConfigStatus {
  if (!config.enabledAt) return 'draft'
  if (config.validUntil && isAtOrAfter(clock, config.validUntil)) return 'expired'
  if (config.pendingResumeAfterExpiry) return 'expired'
  if ((config.pauseReasons ?? []).length > 0) return 'paused'
  return 'enabled'
}

export function openStatus(state: AppState, config: OpenConfig): OpenConfigStatus {
  return deriveOpenStatus(state.clock, config)
}

export function openStatusNote(state: AppState, config: OpenConfig): string | undefined {
  const status = openStatus(state, config)
  if (status === 'expired' && config.pendingResumeAfterExpiry && !(config.validUntil && isAtOrAfter(state.clock, config.validUntil))) {
    return '期限已调整，待恢复'
  }
  return undefined
}

export function collectOpenDependencyReasons(state: AppState, config: OpenConfig): string[] {
  const reasons: string[] = []
  if (config.type === 'dataset_delivery') {
    if (config.boundSnapshotId) {
      const snapshot = state.snapshots.find((item) => item.id === config.boundSnapshotId)
      if (!snapshot) reasons.push('绑定的快照不存在')
    }
  } else if (config.boundDynamicCohortId) {
    const cohort = state.dynamicCohorts.find((item) => item.id === config.boundDynamicCohortId)
    if (!cohort) reasons.push('绑定的动态人群不存在')
    else {
      const availability = includeExcludeAvailability(state, cohort.includeTagIds, cohort.excludeTagIds)
      if (!availability.ok) {
        reasons.push(...availability.reason.split('；').map((item) => item.trim()).filter(Boolean))
      }
    }
  }
  if (config.method !== 'direct_export' && config.systemId) {
    const system = state.connectedSystems.find((item) => item.id === config.systemId)
    if (!system) reasons.push('已对接系统不存在')
    else if (!system.methods.includes(config.method)) reasons.push('已对接系统不支持当前方式')
  }
  return unique(reasons)
}

export function openRuntime(state: AppState, config: OpenConfig): OpenRuntime {
  const status = openStatus(state, config)
  const pauseReasons = [...(config.pauseReasons ?? [])]
  const dependencyReasons = collectOpenDependencyReasons(state, config)
  const statusNote = openStatusNote(state, config)
  const displayReasons = unique([
    ...(statusNote ? [statusNote] : []),
    ...pauseReasons,
    ...dependencyReasons,
  ])
  return {
    status,
    statusNote,
    pauseReasons,
    dependencyReasons,
    displayReasons,
    blocked: status !== 'enabled' || dependencyReasons.length > 0,
  }
}

export function syncOpenStatuses(state: AppState): AppState {
  let changed = false
  const openConfigs = state.openConfigs.map((config) => {
    const status = deriveOpenStatus(state.clock, config)
    if (status === config.status) return config
    changed = true
    return { ...config, status }
  })
  return changed ? { ...state, openConfigs } : state
}

export function replaceOpen(state: AppState, config: OpenConfig): AppState {
  const exists = state.openConfigs.some((item) => item.id === config.id)
  const openConfigs = exists
    ? state.openConfigs.map((item) => (item.id === config.id ? config : item))
    : [...state.openConfigs, config]
  return syncOpenStatuses({ ...state, openConfigs })
}

function unique(items: string[]): string[] {
  return [...new Set(items)]
}

function deliveryRecordsOf(config: OpenConfig): OpenDeliveryRecord[] {
  return config.deliveryRecords ?? []
}

export function saveOpenConfig(
  state: AppState,
  input: OpenConfigInput,
): { ok: true; state: AppState; id: string } | { ok: false; reason: string } {
  const existing = input.id ? state.openConfigs.find((item) => item.id === input.id) : undefined
  if (!existing && !state.session.permissions.buttons.openCreate) {
    return { ok: false, reason: '无开放新建权限' }
  }
  if (existing && !state.session.permissions.buttons.openEdit) {
    return { ok: false, reason: '无开放编辑权限' }
  }

  const id = existing?.id ?? allocateOpenId(state)
  const locked = Boolean(existing?.enabledAt)
  const type = locked ? existing!.type : input.type
  const consumer = locked ? existing!.consumer : input.consumer.trim()
  const systemId = locked
    ? existing!.systemId
    : input.method === 'direct_export'
      ? undefined
      : input.systemId || undefined
  const boundSnapshotId = locked
    ? existing!.boundSnapshotId
    : type === 'dataset_delivery'
      ? input.boundSnapshotId || undefined
      : undefined
  const boundDynamicCohortId = locked
    ? existing!.boundDynamicCohortId
    : type === 'tag_subscription'
      ? input.boundDynamicCohortId || undefined
      : undefined

  let method = input.method
  if (locked) {
    if (existing!.method === 'direct_export' || !existing!.systemId) {
      method = 'direct_export'
    } else {
      const system = state.connectedSystems.find((item) => item.id === existing!.systemId)
      const allowed = methodsForType(type).filter((item) => item !== 'direct_export' && system?.methods.includes(item))
      method = allowed.includes(input.method) ? input.method : existing!.method
    }
  }

  const validUntil = input.validUntil ?? null
  const validity = applyValidityChange(state, existing, validUntil)

  let nextPushAt = existing?.nextPushAt
  const pushPeriodMinutes = method === 'scheduled_full_push' ? input.pushPeriodMinutes : undefined
  if (existing?.enabledAt && method === 'scheduled_full_push' && pushPeriodMinutes) {
    const hasPush = deliveryRecordsOf(existing).some((item) => item.kind === 'push')
    if (!hasPush) nextPushAt = addMinutes(existing.enabledAt, pushPeriodMinutes)
  }

  const next: OpenConfig = {
    id,
    name: input.name.trim(),
    type,
    status: existing?.status ?? 'draft',
    consumer,
    purpose: input.purpose.trim(),
    description: input.description?.trim() || undefined,
    boundSnapshotId,
    boundDynamicCohortId,
    method,
    systemId,
    responsibleOrgId: input.responsibleOrgId || existing?.responsibleOrgId || defaultOrgId(state),
    scopeId: existing?.scopeId ?? state.currentScopeId,
    validUntil,
    enabledAt: existing?.enabledAt,
    pendingResumeAfterExpiry: validity.pendingResumeAfterExpiry,
    pauseReasons: existing?.pauseReasons ?? [],
    dependencyReasons: existing?.dependencyReasons ?? [],
    pushPeriodMinutes,
    nextPushAt,
    lastResult: existing?.lastResult,
    deliveryRecords: existing ? deliveryRecordsOf(existing) : [],
    frozenCsv: existing?.frozenCsv,
    frozenCsvAt: existing?.frozenCsvAt,
    createdBy: existing?.createdBy ?? state.operatorId,
    createdAt: existing?.createdAt ?? state.clock,
    updatedBy: state.operatorId,
    updatedAt: state.clock,
  }

  return { ok: true, id, state: replaceOpen(state, { ...next, status: deriveOpenStatus(state.clock, next) }) }
}

function applyValidityChange(
  state: AppState,
  existing: OpenConfig | undefined,
  nextValidUntil: string | null | undefined,
): { pendingResumeAfterExpiry?: boolean } {
  if (!existing?.enabledAt) return { pendingResumeAfterExpiry: undefined }
  const wasExpired =
    deriveOpenStatus(state.clock, existing) === 'expired' ||
    Boolean(existing.pendingResumeAfterExpiry) ||
    Boolean(existing.validUntil && isAtOrAfter(state.clock, existing.validUntil))
  const nextExpiredNow = Boolean(nextValidUntil && isAtOrAfter(state.clock, nextValidUntil))
  if (nextExpiredNow) return { pendingResumeAfterExpiry: false }
  if (wasExpired) return { pendingResumeAfterExpiry: true }
  return { pendingResumeAfterExpiry: existing.pendingResumeAfterExpiry }
}

export function enableErrors(state: AppState, config: OpenConfig): string[] {
  const errors: string[] = []
  if (!state.session.permissions.buttons.openEnable) errors.push('无启用权限')
  const name = config.name.trim()
  if (name.length < 1 || name.length > 100) errors.push('名称须为 1 至 100 字')
  const purpose = config.purpose.trim()
  if (purpose.length < 1 || purpose.length > 500) errors.push('用途须为 1 至 500 字')
  if (config.description && config.description.length > 1000) errors.push('说明至多 1000 字')
  if (!config.consumer.trim()) errors.push('使用方不能为空')
  if (!config.responsibleOrgId) errors.push('责任组织不能为空')
  if (config.type === 'dataset_delivery') {
    if (!DATASET_METHODS.includes(config.method)) errors.push('数据集交付须选择直接导出或一次性快照通道交付')
    if (!config.boundSnapshotId) errors.push('未绑定已确认快照')
    else if (!state.snapshots.some((item) => item.id === config.boundSnapshotId)) errors.push('绑定的快照不存在')
  } else {
    if (!SUBSCRIPTION_METHODS.includes(config.method)) errors.push('标签订阅须选择按需查询或定时全量推送')
    if (!config.boundDynamicCohortId) errors.push('未绑定动态人群')
    else {
      const cohort = state.dynamicCohorts.find((item) => item.id === config.boundDynamicCohortId)
      if (!cohort) errors.push('绑定的动态人群不存在')
      else {
        const availability = includeExcludeAvailability(state, cohort.includeTagIds, cohort.excludeTagIds)
        if (!availability.ok) errors.push(availability.reason)
      }
    }
  }
  if (config.method === 'direct_export') {
    if (config.systemId) errors.push('直接导出不选择已对接系统')
  } else {
    if (!config.systemId) errors.push('未选择已对接系统')
    else {
      const system = state.connectedSystems.find((item) => item.id === config.systemId)
      if (!system) errors.push('已对接系统不存在')
      else {
        if (system.status !== 'available') errors.push('已对接系统已停用，不能启用')
        if (!system.methods.includes(config.method)) errors.push('已对接系统不支持当前方式')
        if (config.method === 'scheduled_full_push') {
          const allowed = system.pushPeriodMinutes ?? []
          if (!config.pushPeriodMinutes || !allowed.includes(config.pushPeriodMinutes)) {
            errors.push('须选择系统声明的推送周期')
          }
        }
      }
    }
  }
  if (config.validUntil && isAtOrAfter(state.clock, config.validUntil)) {
    errors.push('截止时间必须在当前之后')
  }
  return unique(errors)
}

export function enableOpenConfig(
  state: AppState,
  id: string,
): { ok: true; state: AppState } | { ok: false; reason: string } {
  const config = state.openConfigs.find((item) => item.id === id)
  if (!config) return { ok: false, reason: '开放配置不存在' }
  if (config.enabledAt && openStatus(state, config) !== 'draft') {
    return { ok: false, reason: '已启用过的配置请使用恢复' }
  }
  const errors = enableErrors(state, config)
  if (errors.length > 0) return { ok: false, reason: errors.join('；') }
  const enabledAt = state.clock
  const next: OpenConfig = {
    ...config,
    enabledAt,
    pendingResumeAfterExpiry: false,
    pauseReasons: [],
    status: 'enabled',
    updatedAt: state.clock,
    updatedBy: state.operatorId,
    nextPushAt:
      config.method === 'scheduled_full_push' && config.pushPeriodMinutes
        ? addMinutes(enabledAt, config.pushPeriodMinutes)
        : config.nextPushAt,
  }
  return { ok: true, state: replaceOpen(state, next) }
}

export function pauseOpenConfig(
  state: AppState,
  id: string,
): { ok: true; state: AppState } | { ok: false; reason: string } {
  if (!state.session.permissions.buttons.openPause) return { ok: false, reason: '无暂停权限' }
  const config = state.openConfigs.find((item) => item.id === id)
  if (!config) return { ok: false, reason: '开放配置不存在' }
  if (!config.enabledAt) return { ok: false, reason: '草稿不能暂停' }
  const status = openStatus(state, config)
  if (status === 'expired') return { ok: false, reason: '已到期配置不能暂停' }
  const pauseReasons = unique([...(config.pauseReasons ?? []), PAUSE_MANUAL])
  const next: OpenConfig = {
    ...config,
    pauseReasons,
    status: 'paused',
    updatedAt: state.clock,
    updatedBy: state.operatorId,
  }
  return { ok: true, state: replaceOpen(state, next) }
}

export function resumeOpenConfig(
  state: AppState,
  id: string,
): { ok: true; state: AppState } | { ok: false; reason: string } {
  if (!state.session.permissions.buttons.openResume) return { ok: false, reason: '无恢复权限' }
  const config = state.openConfigs.find((item) => item.id === id)
  if (!config) return { ok: false, reason: '开放配置不存在' }
  if (!config.enabledAt) return { ok: false, reason: '草稿请使用启用' }
  const status = openStatus(state, config)
  if (status === 'enabled' && (config.pauseReasons ?? []).length === 0 && !config.pendingResumeAfterExpiry) {
    return { ok: false, reason: '当前无需恢复' }
  }
  const probe: OpenConfig = {
    ...config,
    pauseReasons: [],
    pendingResumeAfterExpiry: false,
  }
  const errors = enableErrors(
    {
      ...state,
      session: {
        ...state.session,
        permissions: {
          ...state.session.permissions,
          buttons: { ...state.session.permissions.buttons, openEnable: true },
        },
      },
    },
    probe,
  )
  const filtered = errors.filter((item) => item !== '无启用权限')
  if (config.validUntil && isAtOrAfter(state.clock, config.validUntil)) {
    if (!filtered.includes('截止时间必须在当前之后')) filtered.push('截止时间必须在当前之后')
  }
  const system = config.systemId ? state.connectedSystems.find((item) => item.id === config.systemId) : undefined
  if (system && system.status !== 'available') {
    if (!filtered.includes('已对接系统已停用，不能启用')) filtered.push('已对接系统已停用，不能启用')
  }
  const deps = collectOpenDependencyReasons(state, config)
  filtered.push(...deps)
  const uniqueErrors = unique(filtered)
  if (uniqueErrors.length > 0) return { ok: false, reason: uniqueErrors.join('；') }

  const next: OpenConfig = {
    ...config,
    pauseReasons: [],
    pendingResumeAfterExpiry: false,
    status: 'enabled',
    updatedAt: state.clock,
    updatedBy: state.operatorId,
  }
  return { ok: true, state: replaceOpen(state, next) }
}

export function operationBlocks(state: AppState, config: OpenConfig): string[] {
  const runtime = openRuntime(state, config)
  const reasons: string[] = []
  if (runtime.status === 'draft') reasons.push('草稿不能下载或计算')
  if (runtime.status === 'paused') reasons.push(...(runtime.pauseReasons.length > 0 ? runtime.pauseReasons : ['已暂停']))
  if (runtime.status === 'expired') reasons.push(runtime.statusNote ?? '已到期')
  reasons.push(...runtime.dependencyReasons)
  if (config.systemId) {
    const system = state.connectedSystems.find((item) => item.id === config.systemId)
    if (system?.status === 'disabled' && !reasons.includes(PAUSE_SYSTEM_DISABLED)) {
      reasons.push(PAUSE_SYSTEM_DISABLED)
    }
  }
  return unique(reasons)
}

function phonesFromPatients(state: AppState, snapshot: Snapshot): Record<string, string | null> {
  const phones: Record<string, string | null> = {}
  for (const member of snapshot.members) {
    const patient = state.patients.find((item) => item.id === member.patientId)
    phones[member.patientId] = patient?.phone ?? null
  }
  return phones
}

function scopeAllowsSnapshot(state: AppState, snapshot: Snapshot): string | null {
  if (snapshot.scopeId !== state.currentScopeId) return '患者范围权限不足，不能下载'
  const missing = snapshot.members.filter((member) => !state.patients.some((patient) => patient.id === member.patientId))
  if (missing.length > 0) return '患者范围权限不足，不能下载'
  return null
}

function ensureFrozenCsv(
  state: AppState,
  config: OpenConfig,
): { ok: true; state: AppState; config: OpenConfig; csv: string } | { ok: false; reason: string } {
  if (config.frozenCsv) return { ok: true, state, config, csv: config.frozenCsv }
  if (!config.boundSnapshotId) return { ok: false, reason: '未绑定快照' }
  const snapshot = state.snapshots.find((item) => item.id === config.boundSnapshotId)
  if (!snapshot) return { ok: false, reason: '绑定的快照不存在' }
  const scopeError = scopeAllowsSnapshot(state, snapshot)
  if (scopeError) return { ok: false, reason: scopeError }
  const csv = buildSnapshotCsv(snapshot, phonesFromPatients(state, snapshot))
  const next: OpenConfig = {
    ...config,
    frozenCsv: csv,
    frozenCsvAt: state.clock,
    updatedAt: state.clock,
    updatedBy: state.operatorId,
  }
  return { ok: true, csv, config: next, state: replaceOpen(state, next) }
}

function appendDelivery(state: AppState, config: OpenConfig, record: Omit<OpenDeliveryRecord, 'id'>): AppState {
  const withId: OpenDeliveryRecord = { ...record, id: allocateDeliveryId(state) }
  return replaceOpen(state, {
    ...config,
    deliveryRecords: [...deliveryRecordsOf(config), withId],
    updatedAt: state.clock,
    updatedBy: state.operatorId,
  })
}

export function downloadOpenCsv(
  state: AppState,
  id: string,
): { ok: true; state: AppState; csv: string } | { ok: false; reason: string } {
  if (!state.session.permissions.buttons.openExport) return { ok: false, reason: '无导出权限' }
  const config = state.openConfigs.find((item) => item.id === id)
  if (!config) return { ok: false, reason: '开放配置不存在' }
  if (config.type !== 'dataset_delivery' || config.method !== 'direct_export') {
    return { ok: false, reason: '仅直接导出可下载 CSV' }
  }
  const blocks = operationBlocks(state, config)
  if (blocks.length > 0) return { ok: false, reason: blocks.join('；') }
  const frozen = ensureFrozenCsv(state, config)
  if (!frozen.ok) return frozen
  const recorded = appendDelivery(frozen.state, frozen.config, {
    at: state.clock,
    by: state.operatorId,
    kind: 'download',
    patientCount: frozen.config.boundSnapshotId
      ? frozen.state.snapshots.find((item) => item.id === frozen.config.boundSnapshotId)?.members.length
      : undefined,
  })
  const latest = recorded.openConfigs.find((item) => item.id === id)
  return { ok: true, state: recorded, csv: latest?.frozenCsv ?? frozen.csv }
}

export function simulateChannelDelivery(
  state: AppState,
  id: string,
): { ok: true; state: AppState; csv: string } | { ok: false; reason: string } {
  const config = state.openConfigs.find((item) => item.id === id)
  if (!config) return { ok: false, reason: '开放配置不存在' }
  if (config.type !== 'dataset_delivery' || config.method !== 'snapshot_channel') {
    return { ok: false, reason: '仅一次性快照通道交付可模拟通道交付' }
  }
  const blocks = operationBlocks(state, config)
  if (blocks.length > 0) return { ok: false, reason: blocks.join('；') }
  const frozen = ensureFrozenCsv(state, config)
  if (!frozen.ok) return frozen
  const recorded = appendDelivery(frozen.state, frozen.config, {
    at: state.clock,
    by: state.operatorId,
    kind: 'channel',
    patientCount: frozen.state.snapshots.find((item) => item.id === frozen.config.boundSnapshotId)?.members.length,
  })
  const latest = recorded.openConfigs.find((item) => item.id === id)
  return { ok: true, state: recorded, csv: latest?.frozenCsv ?? frozen.csv }
}

export function computeSubscriptionResult(
  state: AppState,
  configId: string,
): { ok: true; patientIds: string[]; computedAt: string } | { ok: false; reason: string } {
  const config = state.openConfigs.find((item) => item.id === configId)
  if (!config) return { ok: false, reason: '开放配置不存在' }
  if (config.type !== 'tag_subscription') return { ok: false, reason: '仅标签订阅可计算' }
  const cohort = config.boundDynamicCohortId
    ? state.dynamicCohorts.find((item) => item.id === config.boundDynamicCohortId)
    : undefined
  if (!cohort) return { ok: false, reason: '绑定的动态人群不存在' }
  const computed = computeIncludeExclude(state, cohort.includeTagIds, cohort.excludeTagIds)
  if ('unavailableReason' in computed) return { ok: false, reason: computed.unavailableReason }
  return { ok: true, patientIds: computed.hitPatientIds, computedAt: computed.computedAt }
}

function persistSubscriptionSuccess(
  state: AppState,
  config: OpenConfig,
  result: { patientIds: string[]; computedAt: string },
  kind: 'query' | 'push',
  reused: boolean,
): { state: AppState; resultVersion: string; computedAt: string; patientIds: string[] } {
  const resultVersion = reused && config.lastResult ? config.lastResult.resultVersion : allocateResultVersion(state)
  const computedAt = reused && config.lastResult ? config.lastResult.computedAt : result.computedAt
  const patientIds = reused && config.lastResult ? config.lastResult.patientIds : result.patientIds
  const lastResult = reused && config.lastResult ? config.lastResult : { resultVersion, computedAt, patientIds }
  let next: OpenConfig = {
    ...config,
    lastResult,
    updatedAt: state.clock,
    updatedBy: state.operatorId,
  }
  if (kind === 'push' && !reused && config.pushPeriodMinutes && config.nextPushAt) {
    next = { ...next, nextPushAt: addMinutes(config.nextPushAt, config.pushPeriodMinutes) }
  }
  const withResult = replaceOpen(state, next)
  const stored = withResult.openConfigs.find((item) => item.id === config.id) ?? next
  const recorded = appendDelivery(withResult, stored, {
    at: state.clock,
    by: state.operatorId,
    kind,
    reused,
    resultVersion,
    computedAt,
    patientCount: patientIds.length,
  })
  return { state: recorded, resultVersion, computedAt, patientIds }
}

export function queryOpenConfig(
  state: AppState,
  id: string,
):
  | { ok: true; state: AppState; reused: boolean; patientIds: string[]; resultVersion: string; computedAt: string }
  | { ok: false; reason: string } {
  const config = state.openConfigs.find((item) => item.id === id)
  if (!config) return { ok: false, reason: '开放配置不存在' }
  if (config.type !== 'tag_subscription' || config.method !== 'on_demand_query') {
    return { ok: false, reason: '仅按需查询订阅可模拟查询' }
  }
  const blocks = operationBlocks(state, config)
  if (blocks.length > 0) return { ok: false, reason: blocks.join('；') }

  const system = config.systemId ? state.connectedSystems.find((item) => item.id === config.systemId) : undefined
  const interval = system?.queryMinIntervalMinutes ?? 0
  if (config.lastResult && interval > 0) {
    const elapsed = minutesBetween(config.lastResult.computedAt, state.clock)
    if (elapsed < interval) {
      return {
        ok: true,
        reused: true,
        ...persistSubscriptionSuccess(state, config, config.lastResult, 'query', true),
      }
    }
  }

  const computed = computeSubscriptionResult(state, id)
  if (!computed.ok) return computed
  return {
    ok: true,
    reused: false,
    ...persistSubscriptionSuccess(state, config, computed, 'query', false),
  }
}

export function pushOpenConfig(
  state: AppState,
  id: string,
):
  | { ok: true; state: AppState; reused: boolean; patientIds: string[]; resultVersion: string; computedAt: string }
  | { ok: false; reason: string } {
  const config = state.openConfigs.find((item) => item.id === id)
  if (!config) return { ok: false, reason: '开放配置不存在' }
  if (config.type !== 'tag_subscription' || config.method !== 'scheduled_full_push') {
    return { ok: false, reason: '仅定时全量推送可推进推送' }
  }
  const blocks = operationBlocks(state, config)
  if (blocks.length > 0) return { ok: false, reason: blocks.join('；') }
  if (config.nextPushAt && !isAtOrAfter(state.clock, config.nextPushAt)) {
    return { ok: false, reason: '尚未到达下一推送时点' }
  }
  const computed = computeSubscriptionResult(state, id)
  if (!computed.ok) return computed
  return {
    ok: true,
    reused: false,
    ...persistSubscriptionSuccess(state, config, computed, 'push', false),
  }
}

export function advanceToNextPush(
  state: AppState,
  id: string,
): ReturnType<typeof pushOpenConfig> {
  const config = state.openConfigs.find((item) => item.id === id)
  if (!config) return { ok: false, reason: '开放配置不存在' }
  if (!config.nextPushAt) return { ok: false, reason: '未设置下一推送时点' }
  const moved = syncOpenStatuses({ ...state, clock: config.nextPushAt })
  return pushOpenConfig(moved, id)
}

export function simulateOpenExpiry(
  state: AppState,
  id: string,
): { ok: true; state: AppState } | { ok: false; reason: string } {
  const config = state.openConfigs.find((item) => item.id === id)
  if (!config) return { ok: false, reason: '开放配置不存在' }
  if (!config.validUntil) return { ok: false, reason: '未指定截止时间，不能模拟到期' }
  return { ok: true, state: syncOpenStatuses({ ...state, clock: config.validUntil }) }
}

export function applySystemStatusToOpen(state: AppState, systemId: string, status: 'available' | 'disabled'): AppState {
  const openConfigs = state.openConfigs.map((config) => {
    if (config.systemId !== systemId) return config
    if (!config.enabledAt) return config
    const current = deriveOpenStatus(state.clock, config)
    if (current === 'expired' || current === 'draft') return config
    if (status === 'disabled') {
      const pauseReasons = unique([
        ...(config.pauseReasons ?? []).filter((item) => item !== PAUSE_SYSTEM_RESTORED),
        PAUSE_SYSTEM_DISABLED,
      ])
      return { ...config, pauseReasons, status: 'paused' as const }
    }
    if (!(config.pauseReasons ?? []).includes(PAUSE_SYSTEM_DISABLED)) return config
    const pauseReasons = unique([
      ...(config.pauseReasons ?? []).filter((item) => item !== PAUSE_SYSTEM_DISABLED),
      PAUSE_SYSTEM_RESTORED,
    ])
    return { ...config, pauseReasons, status: 'paused' as const }
  })
  return syncOpenStatuses({ ...state, openConfigs })
}

export function displayOpenName(config: OpenConfig): string {
  return config.name.trim() || '未命名开放配置'
}
