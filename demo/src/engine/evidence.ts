import { MET_AGE_ID, MET_DEPT_ID, MET_EYE_SCORE_ID } from '../domain/ids'
import { summarizeIncludeExclude, summarizeLogic } from '../domain/logicSummary'
import type {
  AppState,
  ConditionNode,
  EvidenceSlot,
  Judgment,
  Metric,
  RuleLogic,
  RuleNode,
  Tag,
  TagLogicSnapshot,
  TimeWindow,
} from '../domain/types'
import { walkTagRefs } from './availability'
import { metricValueInContext } from './derived'
import { isJudgeable, recordsForMetric, sortLatestFirst } from './records'
import { compareValues } from './compare'
import type { DataRecord, EvalContext } from './types'
import { buildEvalContext, isFail } from './types'
import { inAnyInterval, resolveWindows } from './window'

export function snapshotTagLogic(state: AppState, tag: Tag, seen = new Set<string>()): TagLogicSnapshot {
  const referencedTags: TagLogicSnapshot[] = []
  const refs = new Set<string>()
  walkTagRefs(tag.logic, refs)
  const nextSeen = new Set(seen)
  nextSeen.add(tag.id)
  for (const id of refs) {
    if (nextSeen.has(id)) continue
    const ref = state.tags.find((item) => item.id === id)
    if (!ref) continue
    referencedTags.push(snapshotTagLogic(state, ref, nextSeen))
  }
  return {
    tagId: tag.id,
    tagName: tag.name,
    logicSummary: summarizeLogic(state, tag.logic),
    expandedLogic: structuredClone(tag.logic),
    referencedTags,
  }
}

export function findTagLogicSnapshot(
  snapshots: TagLogicSnapshot[] | undefined,
  tagId: string,
): TagLogicSnapshot | undefined {
  if (!snapshots) return undefined
  for (const item of snapshots) {
    if (item.tagId === tagId) return item
    const nested = findTagLogicSnapshot(item.referencedTags, tagId)
    if (nested) return nested
  }
  return undefined
}

export function buildTagRuleExplanation(state: AppState, tag: Tag) {
  const snap = snapshotTagLogic(state, tag)
  return {
    sourceType: 'tag' as const,
    tagId: tag.id,
    tagName: tag.name,
    logicSummary: snap.logicSummary,
    expandedLogic: snap.expandedLogic,
    referencedTags: snap.referencedTags,
  }
}

export function buildIncludeExcludeExplanation(
  state: AppState,
  includeTagIds: string[],
  excludeTagIds: string[],
  cohort?: { id: string; name: string },
) {
  const includeTags = includeTagIds
    .map((id) => state.tags.find((item) => item.id === id))
    .filter((item): item is Tag => Boolean(item))
    .map((tag) => snapshotTagLogic(state, tag))
  const excludeTags = excludeTagIds
    .map((id) => state.tags.find((item) => item.id === id))
    .filter((item): item is Tag => Boolean(item))
    .map((tag) => snapshotTagLogic(state, tag))
  const expandedLogic: RuleLogic = {
    kind: 'group',
    id: 'include-exclude-root',
    operator: 'and',
    children: includeTagIds.map((tagId) => ({ kind: 'tag_ref' as const, id: `inc-${tagId}`, tagId })),
  }
  return {
    sourceType: 'cohort_include_exclude' as const,
    logicSummary: summarizeIncludeExclude(
      includeTags.map((item) => `「${item.tagName}」${item.logicSummary}`),
      excludeTags.map((item) => `「${item.tagName}」${item.logicSummary}`),
    ),
    expandedLogic,
    includeTags,
    excludeTags,
    cohortId: cohort?.id,
    cohortName: cohort?.name,
  }
}

export function collectEvidenceSlots(
  state: AppState,
  logic: RuleLogic,
  patientId: string,
  computeAt: string,
): EvidenceSlot[] {
  const ctx = buildEvalContext(state, computeAt)
  if (ctx.simulateFailure) return []
  const slots: EvidenceSlot[] = []
  const seen = new Set<string>()

  function add(slot: EvidenceSlot) {
    const key = `${slot.role}|${slot.metricId}|${slot.observationId ?? slot.encounterId ?? ''}`
    if (seen.has(key)) return
    seen.add(key)
    slots.push(slot)
  }

  function walk(node: RuleNode, tagSeen: Set<string>) {
    if (node.kind === 'condition') {
      const slot = slotFromCondition(ctx, patientId, node)
      if (slot) add(slot)
      return
    }
    if (node.kind === 'tag_ref') {
      if (tagSeen.has(node.tagId)) return
      const tag = ctx.tags.find((item) => item.id === node.tagId)
      if (!tag) return
      const next = new Set(tagSeen)
      next.add(node.tagId)
      walk(tag.logic, next)
      return
    }
    for (const child of node.children) walk(child, tagSeen)
  }

  walk(logic, new Set())
  return slots
}

export function latestEyeScoreSlot(
  state: AppState,
  patientId: string,
  computeAt: string,
): EvidenceSlot | undefined {
  const metric = state.metrics.find((item) => item.id === MET_EYE_SCORE_ID)
  if (!metric) return undefined
  const ctx = buildEvalContext(state, computeAt)
  const records = recordsForMetric(ctx, metric, patientId)
  if (isFail(records)) return undefined
  const latest = sortLatestFirst(records.filter(isJudgeable))[0]
  if (!latest) return undefined
  return recordToSlot(metric, patientId, 'latest_eye_score', latest)
}

function slotFromCondition(ctx: EvalContext, patientId: string, node: ConditionNode): EvidenceSlot | undefined {
  const metric = ctx.metrics.find((item) => item.id === node.metricId)
  if (!metric) return undefined
  const role = slotRole(metric.id, node.judgment)

  if (metric.kind === 'derived') {
    const computed = metricValueInContext(ctx, metric, patientId)
    if (computed.status !== 'value') return undefined
    return {
      role,
      metricId: metric.id,
      patientId,
      value: computed.value,
      businessTime: ctx.computeAt,
      sourceTable: 'derived',
    }
  }

  const record = contributingRecord(ctx, patientId, metric, node.judgment)
  if (!record) return undefined
  return recordToSlot(metric, patientId, role, record)
}

function contributingRecord(
  ctx: EvalContext,
  patientId: string,
  metric: Metric,
  judgment: Judgment,
): DataRecord | undefined {
  const records = recordsForMetric(ctx, metric, patientId)
  if (isFail(records)) return undefined
  if (judgment.type === 'direct_compare') {
    return sortLatestFirst(records.filter(isJudgeable))[0]
  }
  if ('window' in judgment) {
    return pickWindowed(ctx, patientId, metric, records, judgment)
  }
  return sortLatestFirst(records.filter(isJudgeable))[0]
}

function pickWindowed(
  ctx: EvalContext,
  patientId: string,
  metric: Metric,
  records: DataRecord[],
  judgment: Extract<Judgment, { window: TimeWindow }>,
): DataRecord | undefined {
  const intervals = resolveWindows(ctx, patientId, judgment.window)
  if (isFail(intervals) || intervals.length === 0) return undefined
  const inWindow = records.filter((record) => inAnyInterval(record.businessTime, intervals, ctx.computeAt))
  const judgeable = inWindow.filter(isJudgeable)
  if (judgment.type === 'exists') {
    const matching = judgment.filter
      ? judgeable.filter(
          (record) => compareValues(record.value, judgment.filter!.op, judgment.filter!.value, metric.valueType) === 'satisfy',
        )
      : judgeable
    return sortLatestFirst(matching)[0]
  }
  return sortLatestFirst(judgeable)[0]
}

function recordToSlot(metric: Metric, patientId: string, role: string, record: DataRecord): EvidenceSlot {
  return {
    role,
    metricId: metric.id,
    patientId,
    value: record.value,
    businessTime: record.businessTime,
    ingestedAt: record.ingestedAt,
    observationId: record.observationId,
    encounterId: record.encounterId,
    sourceTable: metric.binding?.tableName ?? (metric.kind === 'derived' ? 'derived' : metric.id),
  }
}

function slotRole(metricId: string, judgment: Judgment): string {
  if (metricId === MET_AGE_ID) return 'age'
  if (metricId === MET_EYE_SCORE_ID) return 'latest_eye_score'
  if (metricId === MET_DEPT_ID) return 'ophthalmology_visit'
  return `${metricId}:${judgment.type}`
}