import type { AppState, CompareOp, Judgment, RuleLogic, RuleNode, TimeWindow } from './types'

function opLabel(op: CompareOp): string {
  const map: Record<CompareOp, string> = {
    eq: '=',
    neq: '≠',
    gt: '>',
    gte: '≥',
    lt: '<',
    lte: '≤',
    between: '介于',
    in: '属于',
    not_in: '不属于',
  }
  return map[op]
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '（未填）'
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (Array.isArray(value)) return value.map((item) => String(item)).join('、')
  return String(value)
}

export function windowLabel(window: TimeWindow): string {
  if (window.kind === 'relative_days') return `近 ${window.days} 天`
  if (window.kind === 'fixed') return `${window.start} 至 ${window.end}`
  const occ = window.occurrence === 'first' ? '首次' : window.occurrence === 'latest' ? '最近一次' : '任一次'
  return `事件「${window.eventType}」${occ}前 ${window.offsetBeforeDays} 天后 ${window.offsetAfterDays} 天`
}

function judgmentLabel(state: AppState, metricId: string, judgment: Judgment): string {
  const metric = state.metrics.find((item) => item.id === metricId)?.name ?? metricId
  switch (judgment.type) {
    case 'direct_compare':
      return `${metric} ${opLabel(judgment.op)} ${formatValue(judgment.value)}`
    case 'latest':
      return `${windowLabel(judgment.window)}最新一次${metric} ${opLabel(judgment.op)} ${formatValue(judgment.value)}`
    case 'exists': {
      const filter = judgment.filter
        ? ` ${metric} ${opLabel(judgment.filter.op)} ${formatValue(judgment.filter.value)}`
        : metric
      return `${windowLabel(judgment.window)}存在${filter}`
    }
    case 'count':
      return `${windowLabel(judgment.window)}${metric}次数 ${opLabel(judgment.op)} ${formatValue(judgment.value)}`
    case 'zero_records':
      return `${windowLabel(judgment.window)}${metric}次数为 0`
    case 'recent_n':
      return `${windowLabel(judgment.window)}最近 ${judgment.n} 次${metric}均 ${opLabel(judgment.op)} ${formatValue(judgment.value)}`
    case 'consecutive_dates': {
      const daily = judgment.daily === 'all_valid_satisfy' ? '当天全部有效观察满足' : '当天存在一次满足'
      return `${windowLabel(judgment.window)}连续 ${judgment.n} 天（${daily}）${metric} ${opLabel(judgment.op)} ${formatValue(judgment.value)}`
    }
    case 'first_abnormal':
      return `${windowLabel(judgment.window)}首次异常${metric} ${opLabel(judgment.op)} ${formatValue(judgment.value)}`
    case 'change': {
      const mode = judgment.mode === 'rate' ? '变化率' : '绝对变化'
      return `较前${mode}${metric} ${opLabel(judgment.op)} ${formatValue(judgment.value)}`
    }
    default:
      return metric
  }
}

export function summarizeLogic(state: AppState, node: RuleLogic | RuleNode): string {
  if (node.kind === 'condition') {
    return judgmentLabel(state, node.metricId, node.judgment)
  }
  if (node.kind === 'tag_ref') {
    const tag = state.tags.find((item) => item.id === node.tagId)
    return `引用「${tag?.name ?? node.tagId}」`
  }
  if (node.kind === 'record_group') {
    const inner = node.children.map((child) => summarizeLogic(state, child)).join(node.operator === 'and' ? ' 且 ' : ' 或 ')
    const outer = outerSummary(node)
    return `记录条件组（${node.grain}，${node.operator}，${outer}）：${inner || '空'}`
  }
  const joiner = node.operator === 'and' ? ' 且 ' : ' 或 '
  const body = node.children.map((child) => summarizeLogic(state, child)).join(joiner)
  const same = node.sameEncounter ? '（同次就诊）' : ''
  if (node.children.length === 0) return `空组${same}`
  return node.children.length > 1 ? `(${body})${same}` : `${body}${same}`
}

function outerSummary(node: Extract<RuleNode, { kind: 'record_group' }>): string {
  const outer = node.outer
  if (outer.type === 'exists') return `${windowLabel(outer.window)}存在`
  if (outer.type === 'count') {
    return `${windowLabel(outer.window)}次数 ${opLabel(outer.op)} ${outer.value}`
  }
  if (outer.type === 'recent_n') {
    return `${windowLabel(outer.window)}最近 ${outer.n} 次`
  }
  const daily = outer.daily === 'all_valid_satisfy' ? '当天全部有效观察满足' : '当天存在一次满足'
  return `${windowLabel(outer.window)}连续 ${outer.n} 天（${daily}）`
}

export function summarizeIncludeExclude(includeSummaries: string[], excludeSummaries: string[]): string {
  const includePart =
    includeSummaries.length > 0 ? `纳入全部：${includeSummaries.join('；')}` : '纳入：无'
  if (excludeSummaries.length === 0) return includePart
  return `${includePart}。排除命中任一：${excludeSummaries.join('；')}`
}

export function cohortConditionText(state: AppState, includeTagIds: string[], excludeTagIds: string[]): string {
  const include = includeTagIds.map((id) => tagDisplayName(state, id)).join(' 且 ') || '无'
  const exclude = excludeTagIds.map((id) => tagDisplayName(state, id)).join('、')
  return exclude ? `纳入 ${include}；排除命中任一 ${exclude}` : `纳入 ${include}`
}

export function tagDisplayName(state: AppState, tagId: string): string {
  const tag = state.tags.find((item) => item.id === tagId)
  if (!tag) return `${tagId}（已删除）`
  if (tag.status === 'deleted') return `${tag.name}（已删除标签）`
  return tag.name
}
