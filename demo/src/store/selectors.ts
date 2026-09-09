import { tagAvailability } from '../engine/availability'
import { metricReferenceCount, walkMetricIds } from '../engine/availability'
import { evaluateTag, isBlocked } from '../engine/evaluate'
import { isTagAuthorized } from '../engine/includeExclude'
import type { AppState, Batch, Hit, Tag, WorkbenchStats } from '../domain/types'
import { openStatus } from './open'

export function hitsOfBatch(state: AppState, batchId: string): Hit[] {
  return state.hits.filter((hit) => hit.batchId === batchId)
}

export function uniquePatientIds(hits: Hit[]): string[] {
  return [...new Set(hits.map((hit) => hit.patientId))]
}

export function latestBatchForTag(state: AppState, tagId: string): Batch | undefined {
  return state.batches
    .filter((batch) => batch.kind === 'auto_recognition' && batch.tagId === tagId)
    .slice()
    .sort((a, b) => (a.computedAt < b.computedAt ? 1 : -1))[0]
}

export function isPendingLatestBatch(state: AppState, batch: Batch): boolean {
  if (batch.kind !== 'auto_recognition' || !batch.tagId) return false
  const latest = latestBatchForTag(state, batch.tagId)
  if (!latest || latest.id !== batch.id) {
    return false
  }
  const confirmation = batch.scopeConfirmations[state.currentScopeId]
  if (!confirmation || confirmation.status !== 'pending') {
    return false
  }
  return uniquePatientIds(hitsOfBatch(state, batch.id)).length > 0
}

export function isBatchReviewable(state: AppState, batch: Batch): boolean {
  return isPendingLatestBatch(state, batch)
}

export function isBatchHistorical(state: AppState, batch: Batch): boolean {
  if (batch.kind !== 'auto_recognition' || !batch.tagId) return true
  const latest = latestBatchForTag(state, batch.tagId)
  if (!latest || latest.id !== batch.id) return true
  const confirmation = batch.scopeConfirmations[state.currentScopeId]
  return confirmation?.status === 'confirmed'
}

export function reviewRemovedIds(state: AppState, batchId: string): string[] {
  return [
    ...new Set(
      state.reviewRecords
        .filter(
          (item) =>
            item.batchId === batchId &&
            item.scopeId === state.currentScopeId &&
            item.action === 'remove' &&
            item.patientId,
        )
        .map((item) => item.patientId as string),
    ),
  ]
}

export function reviewRetainedIds(state: AppState, batchId: string): string[] {
  const removed = new Set(reviewRemovedIds(state, batchId))
  return uniquePatientIds(hitsOfBatch(state, batchId)).filter((id) => !removed.has(id))
}

export function pendingRecognitionBatches(state: AppState): Batch[] {
  const seen = new Set<string>()
  const result: Batch[] = []
  for (const batch of state.batches) {
    if (batch.kind !== 'auto_recognition' || !batch.tagId) continue
    if (seen.has(batch.tagId)) continue
    const latest = latestBatchForTag(state, batch.tagId)
    if (!latest) continue
    seen.add(batch.tagId)
    if (isPendingLatestBatch(state, latest)) result.push(latest)
  }
  return result
}

export function publishedTags(state: AppState) {
  return state.tags.filter((tag) => tag.status === 'published')
}

export function autoRecognitionTags(state: AppState) {
  return publishedTags(state).filter((tag) => tag.autoRecognitionEnabled)
}

export function historicalRecognitionTagIds(state: AppState): string[] {
  const enabled = new Set(autoRecognitionTags(state).map((tag) => tag.id))
  return [...new Set(state.batches.filter((batch) => batch.kind === 'auto_recognition' && batch.tagId).map((batch) => batch.tagId as string))].filter(
    (tagId) => !enabled.has(tagId),
  )
}

export function recognitionHistoryReason(state: AppState, tagId: string): string {
  const tag = state.tags.find((item) => item.id === tagId)
  if (!tag) return '来源标签已删除，只读历史'
  if (tag.status === 'deleted') return '来源标签已删除，只读历史'
  if (tag.status === 'manually_disabled') return '来源标签已人工停用，只读历史'
  if (!tag.autoRecognitionEnabled) return '已停止自动识别，只读历史'
  const availability = tagAvailability(state, tag)
  if (!availability.available) return availability.reasons.join('；')
  return '只读历史'
}

export type CurrentEvalStatus =
  | { kind: 'not_satisfy' }
  | { kind: 'satisfy' }
  | { kind: 'unknown' }
  | { kind: 'unavailable'; reason: string }

export function currentTagEvalStatus(state: AppState, tag: Tag | undefined, patientId: string): CurrentEvalStatus {
  if (!tag) return { kind: 'unavailable', reason: '来源标签不存在' }
  const result = evaluateTag(state, tag, state.clock, patientId)
  if (isBlocked(result)) return { kind: 'unavailable', reason: result.reason }
  if (result === 'not_satisfy') return { kind: 'not_satisfy' }
  if (result === 'satisfy') return { kind: 'satisfy' }
  return { kind: 'unknown' }
}

export function showsCurrentNotSatisfy(status: CurrentEvalStatus): boolean {
  return status.kind === 'not_satisfy'
}

export function currentStatusSummary(status: CurrentEvalStatus): string {
  if (status.kind === 'not_satisfy') return '当前已不满足'
  if (status.kind === 'satisfy') return '当前计算命中'
  if (status.kind === 'unknown') return '当前无法判断'
  return `当前无法计算：${status.reason}`
}

export function latestEncounter(state: AppState, patientId: string, at = state.clock) {
  return state.encounters
    .filter((item) => item.patientId === patientId && item.visitTime <= at)
    .slice()
    .sort((a, b) => (a.visitTime < b.visitTime ? 1 : -1))[0]
}

export function publishedSelectableTags(state: AppState): Tag[] {
  return publishedTags(state)
}

export function currentDynamicMemberIds(state: AppState, cohortId: string): string[] | 'not_computed' {
  const cohort = state.dynamicCohorts.find((item) => item.id === cohortId)
  if (!cohort) return 'not_computed'
  if (
    !cohort.lastSuccessfulMemberIds ||
    !sameIds(cohort.lastSuccessfulIncludeTagIds ?? [], cohort.includeTagIds) ||
    !sameIds(cohort.lastSuccessfulExcludeTagIds ?? [], cohort.excludeTagIds)
  ) {
    return 'not_computed'
  }
  return cohort.lastSuccessfulMemberIds
}

export function batchesOfCohort(state: AppState, cohortId: string): Batch[] {
  return state.batches
    .filter((batch) => batch.cohortId === cohortId)
    .slice()
    .sort((a, b) => (a.computedAt < b.computedAt ? 1 : -1))
}

export function subscriptionsOfCohort(state: AppState, cohortId: string) {
  return state.openConfigs.filter((config) => config.boundDynamicCohortId === cohortId)
}

export function sameIds(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const left = [...a].sort()
  const right = [...b].sort()
  return left.every((id, index) => id === right[index])
}

export function authorizedPublishedTags(state: AppState): Tag[] {
  return publishedTags(state).filter((tag) => isTagAuthorized(state, tag.id))
}

export function visibleTags(state: AppState, includeDeleted: boolean): Tag[] {
  return includeDeleted ? state.tags : state.tags.filter((tag) => tag.status !== 'deleted')
}

export function tagAvailable(state: AppState, tag: Tag): boolean {
  return tagAvailability(state, tag).available
}

export function enabledOpenConfigs(state: AppState) {
  return state.openConfigs.filter((config) => openStatus(state, config) === 'enabled')
}

export function workbenchStats(state: AppState): WorkbenchStats {
  const pendingBatches = pendingRecognitionBatches(state)
  const pendingHits = pendingBatches.flatMap((batch) => hitsOfBatch(state, batch.id))
  return {
    pendingRecognitionBatches: pendingBatches.length,
    pendingRecognitionPatients: uniquePatientIds(pendingHits).length,
    enabledOpenConfigs: enabledOpenConfigs(state).length,
    dynamicCohorts: state.dynamicCohorts.length,
    snapshots: state.snapshots.length,
    publishedTags: publishedTags(state).length,
  }
}

export function patientById(state: AppState, patientId: string) {
  return state.patients.find((patient) => patient.id === patientId)
}

export function tagById(state: AppState, tagId: string) {
  return state.tags.find((tag) => tag.id === tagId)
}

export function batchById(state: AppState, batchId: string) {
  return state.batches.find((batch) => batch.id === batchId)
}

export function organizationName(state: AppState, orgId: string): string {
  return state.dictionaries.organizations.find((org) => org.id === orgId)?.name ?? orgId
}

export function metricIdsReferencedByTags(state: AppState, metricId: string): number {
  return metricReferenceCount(state, metricId)
}

export function collectLogicMetricIds(state: AppState, tag: Tag): string[] {
  const ids = new Set<string>()
  walkMetricIds(state, tag.logic, ids)
  return [...ids]
}

export function businessPatientIds(state: AppState): string[] {
  return state.patients.map((patient) => patient.id)
}

export function ruleSamplePatientIds(state: AppState): string[] {
  return state.ruleSamples.patients.map((patient) => patient.id)
}

export function isRuleSampleMode(state: AppState): boolean {
  return state.session.mode === 'ruleSamples'
}
