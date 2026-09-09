import { eachShanghaiDate, formatDate } from '../demo/clock'
import type {
  AppState,
  CompareOp,
  ConditionNode,
  GroupNode,
  Judgment,
  RecordGroupNode,
  RuleNode,
  Tag,
  TagRefNode,
  TimeWindow,
} from '../domain/types'
import { compareValues } from './compare'
import { metricValueInContext } from './derived'
import {
  dedupeRecords,
  isJudgeable,
  recordsForMetric,
  sortEarliestFirst,
  sortLatestFirst,
} from './records'
import { tagAvailability } from './availability'
import type {
  BoundScope,
  DataRecord,
  EvalContext,
  NodeEval,
  QueryFail,
  TrialResult,
  TrialSample,
} from './types'
import {
  blocked,
  buildEvalContext,
  combineAnd,
  combineOr,
  dataPartition,
  isBlocked,
  isFail,
  QUERY_FAIL_REASON,
  queryFail,
} from './types'
import { inAnyInterval, resolveWindows, type ResolvedInterval } from './window'

export type { Tri, NodeEval, TrialResult, TrialSample, EvalContext } from './types'
export { buildEvalContext, isBlocked } from './types'

export function evaluateNode(ctx: EvalContext, patientId: string, node: RuleNode): NodeEval {
  return evalNode(ctx, patientId, node, undefined, new Set())
}

export function evaluateTag(
  state: AppState,
  tag: Tag,
  computeAt: string,
  patientId: string,
): NodeEval {
  const availability = tagAvailability(state, tag)
  if (!availability.available) return blocked(availability.reasons.join('；'))
  const ctx = buildEvalContext(state, computeAt)
  if (ctx.simulateFailure) return blocked(QUERY_FAIL_REASON)
  return evalNode(ctx, patientId, tag.logic, undefined, new Set([tag.id]))
}

export function trialCompute(state: AppState, tagId: string): TrialResult {
  const tag = state.tags.find((item) => item.id === tagId)
  if (!tag) return { unavailableReason: '标签不存在' }
  const availability = tagAvailability(state, tag)
  if (!availability.available) return { unavailableReason: availability.reasons.join('；') }
  if (state.session.simulateFailure) return { unavailableReason: QUERY_FAIL_REASON }

  const ctx = buildEvalContext(state, state.clock)
  const partition = dataPartition(state)
  const hitPatientIds: string[] = []
  const samples: TrialSample[] = []

  for (const patient of partition.patients) {
    const result = evalNode(ctx, patient.id, tag.logic, undefined, new Set([tag.id]))
    if (isBlocked(result)) return { unavailableReason: result.reason }
    if (result === 'satisfy') {
      hitPatientIds.push(patient.id)
      samples.push({ patientId: patient.id, maskedName: maskPatientName(patient.name) })
    }
  }

  return { hitPatientIds, samples }
}

export function maskPatientName(name: string): string {
  const chars = [...name]
  const first = chars[0]
  if (!first) return '*'
  return `${first}*`
}

function evalNode(
  ctx: EvalContext,
  patientId: string,
  node: RuleNode,
  bound: BoundScope | undefined,
  seenTags: Set<string>,
): NodeEval {
  if (node.kind === 'condition') return evalCondition(ctx, patientId, node, bound)
  if (node.kind === 'tag_ref') return evalTagRef(ctx, patientId, node, bound, seenTags)
  if (node.kind === 'record_group') return evalRecordGroup(ctx, patientId, node, seenTags)
  return evalGroup(ctx, patientId, node, bound, seenTags)
}

function evalGroup(
  ctx: EvalContext,
  patientId: string,
  node: GroupNode,
  bound: BoundScope | undefined,
  seenTags: Set<string>,
): NodeEval {
  if (node.children.length === 0) return 'unknown'
  if (node.sameEncounter && !bound?.encounterId) {
    return evalSameEncounter(ctx, patientId, node, seenTags)
  }
  const parts = node.children.map((child) => evalNode(ctx, patientId, child, bound, seenTags))
  return node.operator === 'and' ? combineAnd(parts) : combineOr(parts)
}

function evalSameEncounter(
  ctx: EvalContext,
  patientId: string,
  node: GroupNode,
  seenTags: Set<string>,
): NodeEval {
  if (ctx.simulateFailure) return blocked(QUERY_FAIL_REASON)
  const encounters = ctx.encounters.filter((item) => item.patientId === patientId)
  if (encounters.length === 0) return 'not_satisfy'
  const parts = encounters.map((encounter) => {
    const bound: BoundScope = { encounterId: encounter.id }
    const inner = node.children.map((child) => evalNode(ctx, patientId, child, bound, seenTags))
    return node.operator === 'and' ? combineAnd(inner) : combineOr(inner)
  })
  return combineOr(parts)
}

function evalTagRef(
  ctx: EvalContext,
  patientId: string,
  node: TagRefNode,
  bound: BoundScope | undefined,
  seenTags: Set<string>,
): NodeEval {
  if (seenTags.has(node.tagId)) return blocked('标签引用存在循环')
  const tag = ctx.tags.find((item) => item.id === node.tagId)
  if (!tag || tag.status === 'deleted') {
    return blocked(`引用的基础标签已删除`)
  }
  if (tag.status === 'manually_disabled') {
    return blocked(`引用的基础标签「${tag.name}」已人工停用`)
  }
  if (tag.type === 'composite') {
    return blocked('不能引用复合标签')
  }
  if (bound && !supportsPerRecord(tag.logic)) {
    return blocked(`引用的基础标签「${tag.name}」不支持逐次评价`)
  }
  const nextSeen = new Set(seenTags)
  nextSeen.add(node.tagId)
  return evalNode(ctx, patientId, tag.logic, bound, nextSeen)
}

function supportsPerRecord(node: RuleNode): boolean {
  if (node.kind === 'condition') {
    return node.judgment.type === 'direct_compare' || hasComparePayload(node.judgment)
  }
  if (node.kind === 'tag_ref') return false
  if (node.kind === 'record_group') return false
  return node.children.every(supportsPerRecord)
}

function hasComparePayload(judgment: Judgment): boolean {
  return 'op' in judgment && 'value' in judgment
}

function evalCondition(
  ctx: EvalContext,
  patientId: string,
  node: ConditionNode,
  bound: BoundScope | undefined,
): NodeEval {
  const metric = ctx.metrics.find((item) => item.id === node.metricId)
  if (!metric) return blocked('依赖指标不存在')
  if (metric.status === 'disabled') return blocked(`依赖指标「${metric.name}」已停用`)

  if (metric.kind === 'derived') {
    return evalDerivedCondition(ctx, patientId, metric, node)
  }

  if (bound) {
    return evalBoundCondition(ctx, patientId, metric, node, bound)
  }

  const judgment = node.judgment
  switch (judgment.type) {
    case 'direct_compare':
      return evalDirect(ctx, patientId, metric, judgment.op, judgment.value)
    case 'latest':
      return evalLatest(ctx, patientId, metric, judgment.window, judgment.op, judgment.value)
    case 'exists':
      return evalCountCompare(ctx, patientId, metric, judgment.window, 'gte', 1, judgment.filter)
    case 'count':
      return evalCountCompare(
        ctx,
        patientId,
        metric,
        judgment.window,
        judgment.op,
        judgment.value,
        judgment.filter,
      )
    case 'zero_records':
      return evalZeroRecords(ctx, patientId, metric, judgment.window)
    case 'recent_n':
      return evalRecentN(ctx, patientId, metric, judgment.window, judgment.n, judgment.op, judgment.value)
    case 'consecutive_dates':
      return evalConsecutiveDates(
        ctx,
        patientId,
        metric,
        judgment.window,
        judgment.n,
        judgment.daily,
        judgment.op,
        judgment.value,
      )
    case 'first_abnormal':
      return evalFirstAbnormal(ctx, patientId, metric, judgment.window, judgment.op, judgment.value)
    case 'change':
      return evalChange(ctx, patientId, metric, judgment.mode, judgment.op, judgment.value)
    default:
      return 'unknown'
  }
}

function evalDerivedCondition(
  ctx: EvalContext,
  patientId: string,
  metric: NonNullable<EvalContext['metrics'][number]>,
  node: ConditionNode,
): NodeEval {
  const judgment = node.judgment
  const computed = metricValueInContext(ctx, metric, patientId)
  if (computed.status === 'error') return blocked(computed.error)
  if (computed.status === 'unknown') return 'unknown'
  if (judgment.type === 'direct_compare') {
    return compareValues(computed.value, judgment.op, judgment.value, metric.valueType)
  }
  if ('op' in judgment && 'value' in judgment) {
    return compareValues(computed.value, judgment.op, judgment.value, metric.valueType)
  }
  return 'unknown'
}

function evalBoundCondition(
  ctx: EvalContext,
  patientId: string,
  metric: NonNullable<EvalContext['metrics'][number]>,
  node: ConditionNode,
  bound: BoundScope,
): NodeEval {
  if (metric.grain === '患者') {
    return evalCondition(ctx, patientId, node, undefined)
  }
  const payload = comparePayload(node.judgment)
  if (!payload) return 'unknown'
  const records = recordsForMetric(ctx, metric, patientId, bound)
  if (isFail(records)) return blocked(records.reason)
  const record = records[0]
  if (!record) return 'unknown'
  if (!isJudgeable(record)) return 'unknown'
  return compareValues(record.value, payload.op, payload.value, metric.valueType)
}

function comparePayload(judgment: Judgment): { op: CompareOp; value: unknown } | null {
  if (judgment.type === 'exists') {
    return judgment.filter ?? { op: 'eq', value: true }
  }
  if ('op' in judgment && 'value' in judgment) {
    return { op: judgment.op, value: judgment.value }
  }
  return null
}

function evalDirect(
  ctx: EvalContext,
  patientId: string,
  metric: NonNullable<EvalContext['metrics'][number]>,
  op: CompareOp,
  value: unknown,
): NodeEval {
  const records = recordsForMetric(ctx, metric, patientId)
  if (isFail(records)) return blocked(records.reason)
  const latest = sortLatestFirst(records)[0]
  if (!latest) return 'unknown'
  if (!isJudgeable(latest)) return 'unknown'
  return compareValues(latest.value, op, value, metric.valueType)
}

function loadWindowed(
  ctx: EvalContext,
  patientId: string,
  metric: NonNullable<EvalContext['metrics'][number]>,
  window: TimeWindow,
): { intervals: ResolvedInterval[]; records: DataRecord[] } | QueryFail | { emptyAnchors: true } {
  if (ctx.simulateFailure && metric.grain !== '患者') return queryFail()
  const intervals = resolveWindows(ctx, patientId, window)
  if (isFail(intervals)) return intervals
  if (window.kind === 'event' && intervals.length === 0) return { emptyAnchors: true }
  const records = recordsForMetric(ctx, metric, patientId)
  if (isFail(records)) return records
  return { intervals, records }
}

function evalLatest(
  ctx: EvalContext,
  patientId: string,
  metric: NonNullable<EvalContext['metrics'][number]>,
  window: TimeWindow,
  op: CompareOp,
  value: unknown,
): NodeEval {
  if (window.kind === 'event' && window.occurrence === 'any') {
    return evalLatestAny(ctx, patientId, metric, window, op, value)
  }
  const loaded = loadWindowed(ctx, patientId, metric, window)
  if (isFail(loaded)) return blocked(loaded.reason)
  if ('emptyAnchors' in loaded) return 'not_satisfy'
  const inWindow = loaded.records.filter((record) =>
    inAnyInterval(record.businessTime, loaded.intervals, ctx.computeAt),
  )
  const latest = sortLatestFirst(inWindow.filter(isJudgeable))[0]
  if (!latest) return 'not_satisfy'
  return compareValues(latest.value, op, value, metric.valueType)
}

function evalLatestAny(
  ctx: EvalContext,
  patientId: string,
  metric: NonNullable<EvalContext['metrics'][number]>,
  window: TimeWindow,
  op: CompareOp,
  value: unknown,
): NodeEval {
  const intervals = resolveWindows(ctx, patientId, window)
  if (isFail(intervals)) return blocked(intervals.reason)
  if (intervals.length === 0) return 'not_satisfy'
  const records = recordsForMetric(ctx, metric, patientId)
  if (isFail(records)) return blocked(records.reason)
  const parts: NodeEval[] = intervals.map((interval) => {
    const latest = sortLatestFirst(
      records.filter(
        (record) =>
          isJudgeable(record) && inAnyInterval(record.businessTime, [interval], ctx.computeAt),
      ),
    )[0]
    if (!latest) return 'not_satisfy'
    return compareValues(latest.value, op, value, metric.valueType)
  })
  return combineOr(parts)
}

function evalCountCompare(
  ctx: EvalContext,
  patientId: string,
  metric: NonNullable<EvalContext['metrics'][number]>,
  window: TimeWindow,
  op: CompareOp,
  threshold: number,
  filter: { op: CompareOp; value: unknown } | undefined,
): NodeEval {
  if (window.kind === 'event' && window.occurrence === 'any') {
    return evalExistsAny(ctx, patientId, metric, window, op, threshold, filter)
  }
  const loaded = loadWindowed(ctx, patientId, metric, window)
  if (isFail(loaded)) return blocked(loaded.reason)
  if ('emptyAnchors' in loaded) return 'not_satisfy'
  const inWindow = loaded.records.filter((record) =>
    inAnyInterval(record.businessTime, loaded.intervals, ctx.computeAt),
  )
  const matching = inWindow.filter((record) => {
    if (!isJudgeable(record)) return false
    if (!filter) return true
    return compareValues(record.value, filter.op, filter.value, metric.valueType) === 'satisfy'
  })
  const count = matching.length
  return compareValues(count, op, threshold, 'integer')
}

function evalExistsAny(
  ctx: EvalContext,
  patientId: string,
  metric: NonNullable<EvalContext['metrics'][number]>,
  window: TimeWindow,
  op: CompareOp,
  threshold: number,
  filter: { op: CompareOp; value: unknown } | undefined,
): NodeEval {
  const intervals = resolveWindows(ctx, patientId, window)
  if (isFail(intervals)) return blocked(intervals.reason)
  if (intervals.length === 0) return 'not_satisfy'
  const records = recordsForMetric(ctx, metric, patientId)
  if (isFail(records)) return blocked(records.reason)
  const seen = new Set<string>()
  const union: DataRecord[] = []
  for (const interval of intervals) {
    for (const record of records) {
      if (!inAnyInterval(record.businessTime, [interval], ctx.computeAt)) continue
      if (seen.has(record.grainKey)) continue
      seen.add(record.grainKey)
      union.push(record)
    }
  }
  const matching = union.filter((record) => {
    if (!isJudgeable(record)) return false
    if (!filter) return true
    return compareValues(record.value, filter.op, filter.value, metric.valueType) === 'satisfy'
  })
  return compareValues(matching.length, op, threshold, 'integer')
}

function evalZeroRecords(
  ctx: EvalContext,
  patientId: string,
  metric: NonNullable<EvalContext['metrics'][number]>,
  window: TimeWindow,
): NodeEval {
  const loaded = loadWindowed(ctx, patientId, metric, window)
  if (isFail(loaded)) return blocked(loaded.reason)
  if ('emptyAnchors' in loaded) return 'satisfy'
  const inWindow = loaded.records.filter((record) =>
    inAnyInterval(record.businessTime, loaded.intervals, ctx.computeAt),
  )
  return inWindow.length === 0 ? 'satisfy' : 'not_satisfy'
}

function evalRecentN(
  ctx: EvalContext,
  patientId: string,
  metric: NonNullable<EvalContext['metrics'][number]>,
  window: TimeWindow,
  n: number,
  op: CompareOp,
  value: unknown,
): NodeEval {
  const loaded = loadWindowed(ctx, patientId, metric, window)
  if (isFail(loaded)) return blocked(loaded.reason)
  if ('emptyAnchors' in loaded) return 'not_satisfy'
  const judgeable = sortLatestFirst(
    loaded.records.filter(
      (record) =>
        isJudgeable(record) && inAnyInterval(record.businessTime, loaded.intervals, ctx.computeAt),
    ),
  )
  if (judgeable.length < n) return 'not_satisfy'
  const taken = judgeable.slice(0, n)
  const parts = taken.map((record) => compareValues(record.value, op, value, metric.valueType))
  return combineAnd(parts)
}

function evalConsecutiveDates(
  ctx: EvalContext,
  patientId: string,
  metric: NonNullable<EvalContext['metrics'][number]>,
  window: TimeWindow,
  n: number,
  daily: 'any_satisfy' | 'all_valid_satisfy',
  op: CompareOp,
  value: unknown,
): NodeEval {
  const loaded = loadWindowed(ctx, patientId, metric, window)
  if (isFail(loaded)) return blocked(loaded.reason)
  if ('emptyAnchors' in loaded) return 'not_satisfy'
  const interval = loaded.intervals[0]
  if (!interval) return 'not_satisfy'
  const inWindow = loaded.records.filter((record) =>
    inAnyInterval(record.businessTime, loaded.intervals, ctx.computeAt),
  )
  const byDate = new Map<string, DataRecord[]>()
  for (const record of inWindow) {
    const date = formatDate(record.businessTime)
    const list = byDate.get(date) ?? []
    list.push(record)
    byDate.set(date, list)
  }
  const days = eachShanghaiDate(interval.start, interval.end)
  const dayHits: boolean[] = days.map((date) => {
    const rows = (byDate.get(date) ?? []).filter(isJudgeable)
    if (rows.length === 0) return false
    const results = rows.map((record) => compareValues(record.value, op, value, metric.valueType))
    if (daily === 'all_valid_satisfy') {
      return results.every((item) => item === 'satisfy')
    }
    return results.some((item) => item === 'satisfy')
  })
  return hasConsecutive(dayHits, n) ? 'satisfy' : 'not_satisfy'
}

function hasConsecutive(flags: boolean[], n: number): boolean {
  let run = 0
  for (const flag of flags) {
    run = flag ? run + 1 : 0
    if (run >= n) return true
  }
  return false
}

function evalFirstAbnormal(
  ctx: EvalContext,
  patientId: string,
  metric: NonNullable<EvalContext['metrics'][number]>,
  window: TimeWindow,
  op: CompareOp,
  value: unknown,
): NodeEval {
  if (ctx.simulateFailure && metric.grain !== '患者') return blocked(QUERY_FAIL_REASON)
  const records = recordsForMetric(ctx, metric, patientId)
  if (isFail(records)) return blocked(records.reason)
  const history = sortEarliestFirst(records.filter(isJudgeable))
  const first = history.find(
    (record) => compareValues(record.value, op, value, metric.valueType) === 'satisfy',
  )
  if (!first) return 'not_satisfy'
  const intervals = resolveWindows(ctx, patientId, window)
  if (isFail(intervals)) return blocked(intervals.reason)
  if (intervals.length === 0) return 'not_satisfy'
  return inAnyInterval(first.businessTime, intervals, ctx.computeAt) ? 'satisfy' : 'not_satisfy'
}

function evalChange(
  ctx: EvalContext,
  patientId: string,
  metric: NonNullable<EvalContext['metrics'][number]>,
  mode: 'absolute' | 'rate',
  op: CompareOp,
  threshold: number,
): NodeEval {
  if (ctx.simulateFailure && metric.grain !== '患者') return blocked(QUERY_FAIL_REASON)
  const records = recordsForMetric(ctx, metric, patientId)
  if (isFail(records)) return blocked(records.reason)
  const latestTwo = sortLatestFirst(records.filter(isJudgeable)).slice(0, 2)
  const current = latestTwo[0]
  const previous = latestTwo[1]
  if (!current || !previous) return 'not_satisfy'
  const currentNum = Number(current.value)
  const previousNum = Number(previous.value)
  if (!Number.isFinite(currentNum) || !Number.isFinite(previousNum)) return 'unknown'
  if (mode === 'absolute') {
    return compareValues(currentNum - previousNum, op, threshold, 'number')
  }
  if (previousNum === 0) return 'unknown'
  const rate = ((currentNum - previousNum) / Math.abs(previousNum)) * 100
  return compareValues(rate, op, threshold, 'number')
}

function evalRecordGroup(
  ctx: EvalContext,
  patientId: string,
  node: RecordGroupNode,
  seenTags: Set<string>,
): NodeEval {
  if (ctx.simulateFailure) return blocked(QUERY_FAIL_REASON)
  if (node.children.length === 0) return 'unknown'
  const units = recordUnits(ctx, patientId, node)
  if (isFail(units)) return blocked(units.reason)
  const evaluated = units.map((unit) => {
    const bound: BoundScope =
      node.grain === '就诊' ? { encounterId: unit.grainKey } : { observationId: unit.grainKey }
    const parts = node.children.map((child) => evalNode(ctx, patientId, child, bound, seenTags))
    const inner = node.operator === 'and' ? combineAnd(parts) : combineOr(parts)
    return { unit, inner }
  })

  const outer = node.outer
  if (outer.type === 'exists') {
    const hits = evaluated.filter((item) => item.inner === 'satisfy')
    return hits.length >= 1 ? 'satisfy' : evaluated.some((item) => isBlocked(item.inner))
      ? (evaluated.find((item) => isBlocked(item.inner))?.inner ?? 'not_satisfy')
      : 'not_satisfy'
  }
  if (outer.type === 'count') {
    const blockedItem = evaluated.find((item) => isBlocked(item.inner))
    if (blockedItem) return blockedItem.inner
    const count = evaluated.filter((item) => item.inner === 'satisfy').length
    return compareValues(count, outer.op, outer.value, 'integer')
  }
  if (outer.type === 'recent_n') {
    const blockedItem = evaluated.find((item) => isBlocked(item.inner))
    if (blockedItem) return blockedItem.inner
    const judgeable = evaluated
      .filter((item) => item.inner !== 'unknown')
      .sort((a, b) => (a.unit.businessTime < b.unit.businessTime ? 1 : -1))
    if (judgeable.length < outer.n) return 'not_satisfy'
    const taken = judgeable.slice(0, outer.n)
    return taken.every((item) => item.inner === 'satisfy') ? 'satisfy' : 'not_satisfy'
  }

  const blockedItem = evaluated.find((item) => isBlocked(item.inner))
  if (blockedItem) return blockedItem.inner
  const intervals = resolveWindows(ctx, patientId, outer.window)
  if (isFail(intervals)) return blocked(intervals.reason)
  const interval = intervals[0]
  if (!interval) return 'not_satisfy'
  const byDate = new Map<string, NodeEval[]>()
  for (const item of evaluated) {
    if (!inAnyInterval(item.unit.businessTime, intervals, ctx.computeAt)) continue
    const date = formatDate(item.unit.businessTime)
    const list = byDate.get(date) ?? []
    list.push(item.inner)
    byDate.set(date, list)
  }
  const days = eachShanghaiDate(interval.start, interval.end)
  const flags = days.map((date) => {
    const rows = (byDate.get(date) ?? []).filter((item) => item !== 'unknown')
    if (rows.length === 0) return false
    if (outer.daily === 'all_valid_satisfy') return rows.every((item) => item === 'satisfy')
    return rows.some((item) => item === 'satisfy')
  })
  return hasConsecutive(flags, outer.n) ? 'satisfy' : 'not_satisfy'
}

function recordUnits(
  ctx: EvalContext,
  patientId: string,
  node: RecordGroupNode,
): Array<{ grainKey: string; businessTime: string; encounterId?: string }> | QueryFail {
  const windowed = resolveWindows(ctx, patientId, node.outer.window)
  if (isFail(windowed)) return windowed
  if (node.grain === '就诊') {
    const rows = ctx.encounters
      .filter(
        (item) =>
          item.patientId === patientId &&
          inAnyInterval(item.visitTime, windowed, ctx.computeAt),
      )
      .map((item) => ({ grainKey: item.id, businessTime: item.visitTime, encounterId: item.id }))
    return dedupeByKey(rows)
  }
  const rows = ctx.observations
    .filter(
      (item) =>
        item.patientId === patientId &&
        !item.revoked &&
        inAnyInterval(item.observedAt, windowed, ctx.computeAt) &&
        item.ingestedAt <= ctx.computeAt &&
        item.observedAt <= ctx.computeAt,
    )
    .map((item) => ({
      grainKey: item.observationId,
      businessTime: item.observedAt,
      encounterId: item.encounterId ?? undefined,
    }))
  return dedupeByKey(rows)
}

function dedupeByKey<T extends { grainKey: string; businessTime: string }>(rows: T[]): T[] {
  const asRecords: DataRecord[] = rows.map((row) => ({
    patientId: '',
    grainKey: row.grainKey,
    businessTime: row.businessTime,
    ingestedAt: row.businessTime,
    revoked: false,
    unjudgeable: false,
    value: row,
  }))
  return dedupeRecords(asRecords).map((record) => record.value as T)
}


