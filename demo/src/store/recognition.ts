import type { AppState, RemoveReasonCode, Snapshot } from '../domain/types'
import { tagAvailability } from '../engine/availability'
import { buildTagRuleExplanation } from '../engine/evidence'
import { evaluateTag, isBlocked } from '../engine/evaluate'
import { QUERY_FAIL_REASON } from '../engine/types'
import { appendBatch, defaultOrgId, toSnapshotMembers } from './compute'
import {
  currentStatusSummary,
  currentTagEvalStatus,
  isBatchReviewable,
  reviewRetainedIds,
  uniquePatientIds,
  hitsOfBatch,
} from './selectors'
import { allocateReviewId, allocateSnapshotId } from './allocate'

export function generateAutoRecognitionBatch(
  state: AppState,
  tagId: string,
): { ok: true; state: AppState; batchId: string } | { ok: false; reason: string } {
  const tag = state.tags.find((item) => item.id === tagId)
  if (!tag) return { ok: false, reason: '标签不存在' }
  if (tag.status !== 'published') return { ok: false, reason: '未发布标签不能产生识别批次' }
  if (!tag.autoRecognitionEnabled) return { ok: false, reason: '未开启自动识别' }
  const availability = tagAvailability(state, tag)
  if (!availability.available) return { ok: false, reason: availability.reasons.join('；') }
  if (state.session.simulateFailure) return { ok: false, reason: QUERY_FAIL_REASON }

  const computedAt = state.clock
  const patientIds: string[] = []
  for (const patient of state.patients) {
    const result = evaluateTag(state, tag, computedAt, patient.id)
    if (isBlocked(result)) return { ok: false, reason: result.reason }
    if (result === 'satisfy') patientIds.push(patient.id)
  }

  const appended = appendBatch(state, {
    kind: 'auto_recognition',
    computedAt,
    tagId: tag.id,
    ruleExplanation: buildTagRuleExplanation(state, tag),
    patientIds,
    logics: [tag.logic],
  })
  return { ok: true, state: appended.state, batchId: appended.batch.id }
}

export function removeFromReview(
  state: AppState,
  batchId: string,
  patientId: string,
  reasonCode: RemoveReasonCode,
  reasonNote?: string,
): { ok: true; state: AppState } | { ok: false; reason: string } {
  if (!state.session.permissions.buttons.recognitionConfirm) {
    return { ok: false, reason: '无复核确认权限' }
  }
  const batch = state.batches.find((item) => item.id === batchId)
  if (!batch) return { ok: false, reason: '批次不存在' }
  if (!isBatchReviewable(state, batch)) return { ok: false, reason: '当前批次不可复核' }
  const hit = hitsOfBatch(state, batchId).find((item) => item.patientId === patientId)
  if (!hit) return { ok: false, reason: '患者不在原始命中清单中，不能添加' }
  if (reviewRetainedIds(state, batchId).includes(patientId) === false) {
    return { ok: false, reason: '该患者已移除' }
  }
  const tag = batch.tagId ? state.tags.find((item) => item.id === batch.tagId) : undefined
  const status = currentTagEvalStatus(state, tag, patientId)
  const note = reasonCode === 'other' ? reasonNote?.trim() : reasonLabel(reasonCode)
  const record = {
    id: allocateReviewId(state),
    batchId,
    scopeId: state.currentScopeId,
    patientId,
    action: 'remove' as const,
    at: state.clock,
    by: state.operatorId,
    reasonCode,
    reason: note || reasonLabel(reasonCode),
    currentStatusSummary: currentStatusSummary(status),
  }
  return { ok: true, state: { ...state, reviewRecords: [...state.reviewRecords, record] } }
}

export function confirmRecognitionBatch(
  state: AppState,
  batchId: string,
): { ok: true; state: AppState; snapshotId: string | null } | { ok: false; reason: string } {
  if (!state.session.permissions.buttons.recognitionConfirm) {
    return { ok: false, reason: '无复核确认权限' }
  }
  const batch = state.batches.find((item) => item.id === batchId)
  if (!batch) return { ok: false, reason: '批次不存在' }
  if (!isBatchReviewable(state, batch)) return { ok: false, reason: '当前批次不可确认' }
  const retained = reviewRetainedIds(state, batchId)
  const originalCount = uniquePatientIds(hitsOfBatch(state, batchId)).length
  if (originalCount === 0) return { ok: false, reason: '0 命中不出现待确认' }

  const confirmedAt = state.clock
  let snapshotId: string | null = null
  let snapshots = state.snapshots
  if (retained.length > 0) {
    snapshotId = allocateSnapshotId(state)
    const tagName = batch.ruleExplanation.tagName ?? batch.tagId ?? '识别'
    const snapshot: Snapshot = {
      id: snapshotId,
      name: `${tagName}识别确认`,
      type: 'snapshot',
      responsibleOrgId: defaultOrgId(state),
      sourceType: 'recognition',
      sourceBatchId: batch.id,
      confirmedBy: state.operatorId,
      confirmedAt,
      computedAt: batch.computedAt,
      members: toSnapshotMembers(state, retained, batch.computedAt),
      scopeId: state.currentScopeId,
      ruleExplanation: structuredClone(batch.ruleExplanation),
    }
    snapshots = [...state.snapshots, snapshot]
  }

  const nextBatch = {
    ...batch,
    scopeConfirmations: {
      ...batch.scopeConfirmations,
      [state.currentScopeId]: {
        scopeId: state.currentScopeId,
        status: 'confirmed' as const,
        confirmedAt,
        confirmedBy: state.operatorId,
        retainedCount: retained.length,
        snapshotId,
        zeroRetention: retained.length === 0,
      },
    },
  }

  const confirmRecord = {
    id: allocateReviewId({ ...state, snapshots, reviewRecords: state.reviewRecords }),
    batchId,
    scopeId: state.currentScopeId,
    action: 'confirm' as const,
    at: confirmedAt,
    by: state.operatorId,
    snapshotId,
  }

  return {
    ok: true,
    snapshotId,
    state: {
      ...state,
      snapshots,
      batches: state.batches.map((item) => (item.id === batchId ? nextBatch : item)),
      reviewRecords: [...state.reviewRecords, confirmRecord],
    },
  }
}

function reasonLabel(code: RemoveReasonCode): string {
  if (code === 'not_satisfy') return '当前已不满足'
  if (code === 'not_for_this_operation') return '不应纳入本次运营人群'
  return '其他'
}