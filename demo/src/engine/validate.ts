import type { AppState, Metric, RuleLogic, RuleNode, Tag, TagType } from '../domain/types'
import { opsForValueType } from './compare'
import { metricReferences } from './availability'
import { judgmentHasThreshold } from './logicTree'

export function validateLogic(state: AppState, node: RuleLogic, tagType: TagType): string[] {
  return validateNode(state, node, tagType, true)
}

function validateNode(state: AppState, node: RuleNode, tagType: TagType, isRoot: boolean): string[] {
  if (node.kind === 'group') {
    if (node.children.length === 0) return [isRoot ? '空规则不能发布或保存为生效修改' : '空组不能发布或保存为生效修改']
    return node.children.flatMap((child) => validateNode(state, child, tagType, false))
  }
  if (node.kind === 'record_group') {
    const errors = validateRecordGroupOuter(node.outer)
    if (node.children.length === 0) errors.push(isRoot ? '空规则不能发布或保存为生效修改' : '空组不能发布或保存为生效修改')
    return [...errors, ...node.children.flatMap((child) => validateNode(state, child, tagType, false))]
  }
  if (node.kind === 'tag_ref') {
    if (tagType !== 'composite') return ['仅复合标签可引用基础标签']
    const ref = state.tags.find((item) => item.id === node.tagId)
    if (!ref) return ['引用的标签不存在']
    if (ref.type !== 'basic') return ['不能引用复合标签']
    if (ref.status !== 'published') return [`引用的基础标签「${ref.name}」须为已发布`]
    return []
  }
  const metric = state.metrics.find((item) => item.id === node.metricId)
  if (!metric) return ['条件未选择指标']
  if (!metric.applicableJudgments.includes(node.judgment.type)) {
    return [`指标「${metric.name}」不支持该判断方式`]
  }
  const errors: string[] = []
  if (!judgmentHasThreshold(node.judgment)) errors.push(`指标「${metric.name}」的阈值必填`)
  if ('op' in node.judgment) {
    if (!opsForValueType(metric.valueType).includes(node.judgment.op)) {
      errors.push(`指标「${metric.name}」不支持该比较符`)
    }
  }
  if (node.judgment.type === 'count' && (!Number.isInteger(node.judgment.value) || node.judgment.value < 0)) {
    errors.push('次数阈值须为非负整数')
  }
  if (
    (node.judgment.type === 'recent_n' || node.judgment.type === 'consecutive_dates') &&
    (!Number.isInteger(node.judgment.n) || node.judgment.n < 1)
  ) {
    errors.push('N 须为正整数')
  }
  if (node.judgment.type === 'exists' && node.judgment.filter) {
    if (node.judgment.filter.value === null || node.judgment.filter.value === undefined || node.judgment.filter.value === '') {
      errors.push('存在判断的过滤值必填')
    }
  }
  if ('value' in node.judgment && node.judgment.op === 'between') {
    const bounds = node.judgment.value
    if (!Array.isArray(bounds) || bounds.length !== 2 || Number(bounds[0]) > Number(bounds[1])) {
      errors.push('区间起点不得大于终点')
    }
  }
  if ('value' in node.judgment && (node.judgment.op === 'in' || node.judgment.op === 'not_in')) {
    if (!Array.isArray(node.judgment.value) || node.judgment.value.length === 0) {
      errors.push('枚举多选不能为空')
    }
  }
  if ('window' in node.judgment && node.judgment.window.kind === 'event') {
    if (node.judgment.window.offsetBeforeDays < 0 || node.judgment.window.offsetAfterDays < 0) {
      errors.push('事件偏移天数不能为负')
    }
  }
  if ('window' in node.judgment && node.judgment.window.kind === 'fixed') {
    if (node.judgment.window.start > node.judgment.window.end) errors.push('固定窗口起点不得晚于终点')
  }
  return errors
}

function validateRecordGroupOuter(judgment: Extract<RuleNode, { kind: 'record_group' }>['outer']): string[] {
  const errors: string[] = []
  if (judgment.type === 'count' && (!Number.isInteger(judgment.value) || judgment.value < 0)) {
    errors.push('记录条件组的次数阈值须为非负整数')
  }
  if (
    (judgment.type === 'recent_n' || judgment.type === 'consecutive_dates') &&
    (!Number.isInteger(judgment.n) || judgment.n < 1)
  ) {
    errors.push('记录条件组的 N 须为正整数')
  }
  if ('value' in judgment && !judgmentHasThreshold(judgment)) {
    errors.push('记录条件组的外层阈值必填')
  }
  if (judgment.window.kind === 'event' && (judgment.window.offsetBeforeDays < 0 || judgment.window.offsetAfterDays < 0)) {
    errors.push('记录条件组的事件偏移天数不能为负')
  }
  if (judgment.window.kind === 'fixed' && judgment.window.start > judgment.window.end) {
    errors.push('记录条件组的固定窗口起点不得晚于终点')
  }
  return errors
}

export function validateTagBasics(tag: Pick<Tag, 'name' | 'responsibleOrgId' | 'suggestion'>): string[] {
  const errors: string[] = []
  const name = tag.name.trim()
  if (name.length < 1 || name.length > 100) errors.push('名称去首尾空白后须为 1 至 100 字')
  if (!tag.responsibleOrgId) errors.push('责任组织必填')
  if (tag.suggestion && tag.suggestion.length > 2000) errors.push('处置建议至多 2000 字')
  return errors
}

export function validateTag(state: AppState, tag: Tag, mode: 'draft' | 'strict'): string[] {
  const errors = validateTagBasics(tag)
  if (mode === 'strict') errors.push(...validateLogic(state, tag.logic, tag.type))
  if (tag.autoRecognitionEnabled) {
    if (tag.status !== 'published' && mode === 'strict') errors.push('未发布不能开启自动识别')
    if (!tag.autoRecognitionIntervalDays || tag.autoRecognitionIntervalDays < 1) {
      errors.push('自动识别周期须为正整数天')
    }
  }
  return errors
}

export function validateMetricDraft(metric: Metric, state?: AppState): string[] {
  const errors: string[] = []
  if (metric.name.trim().length < 1 || metric.name.trim().length > 100) errors.push('名称去首尾空白后须为 1 至 100 字')
  if (metric.applicableJudgments.length === 0) errors.push('无判断方式不能保存')
  if (metric.kind === 'field_binding' && (!metric.binding?.datasetId || !metric.binding.field)) {
    errors.push('字段绑定须选择来源字段')
  }
  if (metric.kind === 'derived') {
    if (!metric.derived) errors.push('衍生指标须配置计算关系')
    else {
      if (metric.derived.inputMetricIds.length === 0) errors.push('衍生指标须选择输入')
      if (new Set(metric.derived.inputMetricIds).size !== metric.derived.inputMetricIds.length) {
        errors.push('衍生指标输入不能重复')
      }
      if (metric.derived.function === 'arithmetic' && !metric.derived.formula?.trim()) {
        errors.push('算术衍生须填写公式')
      }
      if (metric.derived.function === 'arithmetic' && metric.derived.inputMetricIds.length > 1 && !metric.derived.association) {
        errors.push('算术衍生须声明多输入取值与关联方式')
      }
      if (metric.derived.function === 'date_diff') {
        const { dateStartMetricId, dateEndMetricId } = metric.derived
        if (!dateStartMetricId || !dateEndMetricId || metric.derived.inputMetricIds.length !== 2) {
          errors.push('日期差须分别指定起点和终点')
        }
        if (dateStartMetricId && dateStartMetricId === dateEndMetricId) errors.push('日期差起点和终点不能相同')
        if (!metric.derived.dateDiffUnit) errors.push('日期差须指定结果单位')
        if (!metric.derived.association) errors.push('日期差须声明输入关联方式')
      }
      if (!['arithmetic', 'date_diff'].includes(metric.derived.function)) {
        if (metric.derived.inputMetricIds.length !== 1) errors.push('窗口统计只能选择一个输入指标')
        if (!Number.isInteger(metric.derived.windowDays) || (metric.derived.windowDays ?? 0) < 1) {
          errors.push('窗口天数须为正整数')
        }
        if (!metric.derived.observationGrain) errors.push('窗口统计须指定观察粒度')
        if (metric.derived.filter && (metric.derived.filter.value === '' || metric.derived.filter.value == null)) {
          errors.push('窗口过滤已开启时过滤值必填')
        }
      }
      if (state) {
        const inputs = metric.derived.inputMetricIds
          .map((id) => state.metrics.find((item) => item.id === id))
          .filter((item): item is Metric => Boolean(item))
        if (inputs.length !== metric.derived.inputMetricIds.length) errors.push('衍生指标存在无效输入')
        if (metric.derived.association === 'same_observation' && inputs.some((item) => !item.observationKey && !item.associatedObservationKey)) {
          errors.push('选择的输入缺少观察关联键，不能按同次观察计算')
        }
        if (metric.derived.function === 'date_diff' && inputs.some((item) => item.valueType !== 'datetime')) {
          errors.push('日期差起止输入必须是日期时间指标')
        }
        if (metric.derived.observationGrain && inputs[0] && inputs[0].grain !== metric.derived.observationGrain) {
          errors.push('观察粒度必须与输入指标粒度一致')
        }
      }
    }
  }
  return errors
}

export function bindingCompatible(previous: Metric, next: Metric): boolean {
  return previous.valueType === next.valueType && previous.unit === next.unit && previous.grain === next.grain
}

export function canChangeMetricBinding(
  state: AppState,
  previous: Metric,
  next: Metric,
): { ok: true } | { ok: false; reason: string } {
  if (bindingCompatible(previous, next)) return { ok: true }
  const refs = metricReferences(state, previous.id)
  if (refs.tags.length === 0 && refs.derived.length === 0) return { ok: true }
  return { ok: false, reason: '类型／单位／粒度不兼容，受影响标签仍在引用该指标' }
}

export function trimName(name: string): string {
  return name.trim()
}
