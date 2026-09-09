import type { AppState, ConnectedSystem, DeliveryMethod } from '../domain/types'
import { allocateSystemId } from './allocate'
import { applySystemStatusToOpen } from './open'
import { defaultOrgId } from './compute'

const CODE_PATTERN = /^[A-Za-z0-9_-]{1,64}$/
const CHANNEL_METHODS: Array<Exclude<DeliveryMethod, 'direct_export'>> = [
  'snapshot_channel',
  'on_demand_query',
  'scheduled_full_push',
]

export type ConnectedSystemInput = {
  id?: string
  name: string
  code: string
  defaultConsumer: string
  status: ConnectedSystem['status']
  methods: Array<Exclude<DeliveryMethod, 'direct_export'>>
  queryMinIntervalMinutes?: number
  pushPeriodMinutes?: number[]
  channelId: string
  responsibleOrgId?: string
  businessContact: string
  techContact: string
  remark?: string
}

export function systemValidationErrors(state: AppState, input: ConnectedSystemInput, existing?: ConnectedSystem): string[] {
  const errors: string[] = []
  const name = input.name.trim()
  if (name.length < 1 || name.length > 100) errors.push('名称须为 1 至 100 字')
  const code = input.code.trim()
  if (!CODE_PATTERN.test(code)) errors.push('编码须为 1 至 64 位字母数字下划线或短横线')
  if (existing && existing.code !== code) errors.push('编码创建后不可改')
  if (!existing && state.connectedSystems.some((item) => item.code === code || item.id === code)) {
    errors.push('编码已存在')
  }
  if (!input.defaultConsumer.trim()) errors.push('默认使用方不能为空')
  if (input.methods.length === 0) errors.push('至少选择一种开放方式')
  for (const method of input.methods) {
    if (!CHANNEL_METHODS.includes(method)) errors.push(`不支持的方式：${method}`)
  }
  if (input.methods.includes('on_demand_query')) {
    if (!input.queryMinIntervalMinutes || input.queryMinIntervalMinutes < 1 || !Number.isInteger(input.queryMinIntervalMinutes)) {
      errors.push('支持按需查询须填写正整数分钟间隔')
    }
  }
  if (input.methods.includes('scheduled_full_push')) {
    const periods = (input.pushPeriodMinutes ?? []).filter((item) => Number.isInteger(item) && item > 0)
    if (periods.length === 0) errors.push('支持定时推送须至少一个正整数分钟周期')
  }
  if (!input.channelId.trim()) errors.push('底座通道引用不能为空')
  if (!input.businessContact.trim()) errors.push('业务联系人不能为空')
  if (!input.techContact.trim()) errors.push('技术联系人不能为空')
  return [...new Set(errors)]
}

export function saveConnectedSystem(
  state: AppState,
  input: ConnectedSystemInput,
): { ok: true; state: AppState; id: string } | { ok: false; reason: string } {
  if (!state.session.permissions.buttons.systemMaintain) return { ok: false, reason: '无系统维护权限' }
  const existing = input.id ? state.connectedSystems.find((item) => item.id === input.id) : undefined
  const errors = systemValidationErrors(state, input, existing)
  if (errors.length > 0) return { ok: false, reason: errors.join('；') }

  const id = existing?.id ?? (state.connectedSystems.some((item) => item.id === input.code.trim()) ? allocateSystemId(state) : input.code.trim())
  const methods = [...input.methods]
  const next: ConnectedSystem = {
    id,
    name: input.name.trim(),
    code: existing?.code ?? input.code.trim(),
    defaultConsumer: input.defaultConsumer.trim(),
    status: input.status,
    methods,
    queryMinIntervalMinutes: methods.includes('on_demand_query') ? input.queryMinIntervalMinutes : undefined,
    pushPeriodMinutes: methods.includes('scheduled_full_push')
      ? [...(input.pushPeriodMinutes ?? [])].filter((item) => item > 0)
      : undefined,
    channelId: input.channelId.trim(),
    responsibleOrgId: input.responsibleOrgId || existing?.responsibleOrgId || defaultOrgId(state),
    businessContact: input.businessContact.trim(),
    techContact: input.techContact.trim(),
    lastValidatedAt: existing?.lastValidatedAt ?? state.clock,
    remark: input.remark?.trim() || undefined,
  }

  const connectedSystems = existing
    ? state.connectedSystems.map((item) => (item.id === id ? next : item))
    : [...state.connectedSystems, next]

  let nextState: AppState = { ...state, connectedSystems }
  if (existing && existing.status !== next.status) {
    nextState = applySystemStatusToOpen(nextState, id, next.status)
  }
  return { ok: true, id, state: nextState }
}

export function disableConnectedSystem(
  state: AppState,
  id: string,
): { ok: true; state: AppState } | { ok: false; reason: string } {
  if (!state.session.permissions.buttons.systemMaintain) return { ok: false, reason: '无系统维护权限' }
  const existing = state.connectedSystems.find((item) => item.id === id)
  if (!existing) return { ok: false, reason: '已对接系统不存在' }
  if (existing.status === 'disabled') return { ok: true, state }
  const connectedSystems = state.connectedSystems.map((item) =>
    item.id === id ? { ...item, status: 'disabled' as const } : item,
  )
  return { ok: true, state: applySystemStatusToOpen({ ...state, connectedSystems }, id, 'disabled') }
}

export function restoreConnectedSystem(
  state: AppState,
  id: string,
): { ok: true; state: AppState } | { ok: false; reason: string } {
  if (!state.session.permissions.buttons.systemMaintain) return { ok: false, reason: '无系统维护权限' }
  const existing = state.connectedSystems.find((item) => item.id === id)
  if (!existing) return { ok: false, reason: '已对接系统不存在' }
  if (existing.status === 'available') return { ok: true, state }
  const connectedSystems = state.connectedSystems.map((item) =>
    item.id === id ? { ...item, status: 'available' as const } : item,
  )
  return { ok: true, state: applySystemStatusToOpen({ ...state, connectedSystems }, id, 'available') }
}

export function stampSystemValidated(
  state: AppState,
  id: string,
): { ok: true; state: AppState } | { ok: false; reason: string } {
  if (!state.session.permissions.buttons.systemMaintain) return { ok: false, reason: '无系统维护权限' }
  const existing = state.connectedSystems.find((item) => item.id === id)
  if (!existing) return { ok: false, reason: '已对接系统不存在' }
  return {
    ok: true,
    state: {
      ...state,
      connectedSystems: state.connectedSystems.map((item) =>
        item.id === id ? { ...item, lastValidatedAt: state.clock } : item,
      ),
    },
  }
}

export function periodLabel(system: ConnectedSystem): string {
  const parts: string[] = []
  if (system.methods.includes('on_demand_query') && system.queryMinIntervalMinutes) {
    const days = system.queryMinIntervalMinutes / 1440
    parts.push(
      Number.isInteger(days)
        ? `查询最小间隔 ${days} 天`
        : `查询最小间隔 ${system.queryMinIntervalMinutes} 分钟`,
    )
  }
  if (!system.methods.includes('on_demand_query')) parts.push('不支持按需查询')
  if (system.pushPeriodMinutes && system.pushPeriodMinutes.length > 0) {
    const labels = system.pushPeriodMinutes.map((minutes) => {
      const days = minutes / 1440
      return Number.isInteger(days) ? `${days} 天` : `${minutes} 分钟`
    })
    parts.push(`推送每 ${labels.join('／')}`)
  }
  return parts.join('；')
}
