import type { AppState, Metric, RuleNode, Tag } from '../domain/types'

export type Availability = { available: true } | { available: false; reasons: string[] }

export function tagAvailability(state: AppState, tag: Tag): Availability {
  const reasons: string[] = []
  if (tag.status === 'deleted') reasons.push(`标签「${tag.name}」已删除`)
  if (tag.status === 'manually_disabled') reasons.push(`标签「${tag.name}」已人工停用`)
  collectDependencyReasons(state, tag.logic, reasons, new Set([tag.id]))
  return reasons.length > 0 ? { available: false, reasons: unique(reasons) } : { available: true }
}

export function collectDependencyReasons(
  state: AppState,
  node: RuleNode,
  reasons: string[],
  seen: Set<string>,
): void {
  if (node.kind === 'condition') {
    pushMetricReasons(state, node.metricId, reasons)
    return
  }
  if (node.kind === 'tag_ref') {
    if (seen.has(node.tagId)) {
      reasons.push('标签引用存在循环')
      return
    }
    seen.add(node.tagId)
    const ref = state.tags.find((item) => item.id === node.tagId)
    if (!ref || ref.status === 'deleted') {
      reasons.push(ref ? `引用的基础标签「${ref.name}」已删除` : '引用的基础标签已删除')
      return
    }
    if (ref.status === 'manually_disabled') {
      reasons.push(`引用的基础标签「${ref.name}」已人工停用`)
    }
    if (ref.type === 'composite') {
      reasons.push('不能引用复合标签')
      return
    }
    collectDependencyReasons(state, ref.logic, reasons, seen)
    return
  }
  for (const child of node.children) {
    collectDependencyReasons(state, child, reasons, seen)
  }
}

function pushMetricReasons(state: AppState, metricId: string, reasons: string[]): void {
  const metric = state.metrics.find((item) => item.id === metricId)
  if (!metric) {
    reasons.push('依赖指标不存在')
    return
  }
  if (metric.status === 'disabled') {
    reasons.push(`依赖指标「${metric.name}」已停用`)
  }
  if (metric.kind === 'derived') {
    for (const inputId of metric.derived?.inputMetricIds ?? []) {
      const input = state.metrics.find((item) => item.id === inputId)
      if (!input) reasons.push('衍生指标缺少输入')
      else if (input.status === 'disabled') reasons.push(`依赖指标「${input.name}」已停用`)
    }
  }
}

export function walkMetricIds(state: AppState, node: RuleNode, acc: Set<string>, seen = new Set<string>()): void {
  if (node.kind === 'condition') {
    acc.add(node.metricId)
    const metric = state.metrics.find((item) => item.id === node.metricId)
    for (const inputId of metric?.derived?.inputMetricIds ?? []) acc.add(inputId)
    return
  }
  if (node.kind === 'tag_ref') {
    if (seen.has(node.tagId)) return
    seen.add(node.tagId)
    const ref = state.tags.find((item) => item.id === node.tagId)
    if (ref) walkMetricIds(state, ref.logic, acc, seen)
    return
  }
  for (const child of node.children) walkMetricIds(state, child, acc, seen)
}

export function walkTagRefs(node: RuleNode, acc: Set<string>): void {
  if (node.kind === 'tag_ref') {
    acc.add(node.tagId)
    return
  }
  if (node.kind === 'condition') return
  for (const child of node.children) walkTagRefs(child, acc)
}

export function metricReferences(
  state: AppState,
  metricId: string,
): { tags: Tag[]; derived: Metric[] } {
  const tags = state.tags.filter((tag) => {
    if (tag.status === 'deleted') return false
    const ids = new Set<string>()
    walkMetricIds(state, tag.logic, ids)
    return ids.has(metricId)
  })
  const derived = state.metrics.filter(
    (metric) => metric.id !== metricId && metric.derived?.inputMetricIds.includes(metricId),
  )
  return { tags, derived }
}

export function metricReferenceCount(state: AppState, metricId: string): number {
  const refs = metricReferences(state, metricId)
  return refs.tags.length + refs.derived.length
}

export function tagImpact(state: AppState, tagId: string): {
  compositeTags: Tag[]
  recognition: boolean
  dynamicCohorts: string[]
  subscriptions: string[]
} {
  const compositeTags = state.tags.filter((tag) => {
    if (tag.id === tagId || tag.status === 'deleted') return false
    const refs = new Set<string>()
    walkTagRefs(tag.logic, refs)
    return refs.has(tagId)
  })
  const tag = state.tags.find((item) => item.id === tagId)
  const recognition = Boolean(tag?.autoRecognitionEnabled)
  const dynamicCohorts = state.dynamicCohorts
    .filter((cohort) => cohort.includeTagIds.includes(tagId) || cohort.excludeTagIds.includes(tagId))
    .map((cohort) => cohort.name)
  const boundCohortIds = new Set(
    state.dynamicCohorts
      .filter((cohort) => cohort.includeTagIds.includes(tagId) || cohort.excludeTagIds.includes(tagId))
      .map((cohort) => cohort.id),
  )
  const subscriptions = state.openConfigs
    .filter((config) => config.boundDynamicCohortId && boundCohortIds.has(config.boundDynamicCohortId))
    .map((config) => config.name)
  return { compositeTags, recognition, dynamicCohorts, subscriptions }
}

function unique(items: string[]): string[] {
  return [...new Set(items)]
}
