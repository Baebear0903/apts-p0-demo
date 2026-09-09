import { nextStableId } from '../domain/ids'
import type { AppState } from '../domain/types'

export function usedIds(state: AppState): string[] {
  return [
    ...state.retiredIds,
    ...state.tags.map((item) => item.id),
    ...state.metrics.map((item) => item.id),
    ...state.batches.map((item) => item.id),
    ...state.snapshots.map((item) => item.id),
    ...state.dynamicCohorts.map((item) => item.id),
    ...state.reviewRecords.map((item) => item.id),
    ...state.openConfigs.map((item) => item.id),
    ...state.openConfigs.flatMap((item) => [
      ...(item.deliveryRecords ?? []).map((record) => record.id),
      ...(item.lastResult ? [item.lastResult.resultVersion] : []),
    ]),
    ...state.hits.map((item) => item.id),
    ...state.connectedSystems.map((item) => item.id),
  ]
}

export function allocateTagId(state: AppState): string {
  return nextStableId('TAG', usedIds(state))
}

export function allocateMetricId(state: AppState): string {
  return nextStableId('MET', usedIds(state))
}

export function allocateSnapshotId(state: AppState): string {
  return nextStableId('SNAP', usedIds(state))
}

export function allocateCohortId(state: AppState): string {
  return nextStableId('COH', usedIds(state))
}

export function allocateReviewId(state: AppState): string {
  return nextStableId('REV', usedIds(state))
}

export function allocateOpenId(state: AppState): string {
  return nextStableId('OPEN', usedIds(state))
}

export function allocateSystemId(state: AppState): string {
  return nextStableId('SYS', usedIds(state))
}

export function allocateDeliveryId(state: AppState): string {
  return nextStableId('DLV', usedIds(state))
}

export function allocateResultVersion(state: AppState): string {
  return nextStableId('RV', usedIds(state))
}

export function allocateBatchId(state: AppState, computedAt: string): string {
  const date = computedAt.slice(0, 10).replaceAll('-', '')
  const time = computedAt.slice(11, 16).replace(':', '')
  const base = `B-${date}-${time}`
  const taken = new Set(usedIds(state))
  if (!taken.has(base)) return base
  for (let index = 2; index < 10000; index += 1) {
    const id = `${base}-${index}`
    if (!taken.has(id)) return id
  }
  throw new Error(`无法分配批次标识: ${base}`)
}