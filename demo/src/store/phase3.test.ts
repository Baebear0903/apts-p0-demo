import { describe, expect, it } from 'vitest'
import { createInitialState } from '../data/seed'
import { BATCH_INITIAL_ID, TAG_ADULT_ID, TAG_EYE_HIGH_ID, TAG_EYE_OP_ID } from '../domain/ids'
import type { Tag } from '../domain/types'
import { findTagLogicSnapshot } from '../engine/evidence'
import { evaluateTag, trialCompute } from '../engine/evaluate'
import { computeIncludeExclude } from '../engine/includeExclude'
import {
  confirmRecognitionBatch,
  confirmSnapshotFromDynamic,
  deleteTag,
  disableTag,
  generateAutoRecognitionBatch,
  queryIncludeExclude,
  refreshDynamicCohort,
  removeFromReview,
  saveActiveSnapshot,
  saveDynamicCohort,
  setAuthorizedTagIds,
  setSimulateFailure,
  upsertTag,
} from './store'
import {
  currentTagEvalStatus,
  hitsOfBatch,
  isBatchReviewable,
  pendingRecognitionBatches,
  reviewRetainedIds,
  showsCurrentNotSatisfy,
  uniquePatientIds,
  workbenchStats,
} from './selectors'

const LI_QIANG = 'P-DEMO-002'

function raiseEyeHigh(state: ReturnType<typeof createInitialState>, value: number) {
  const high = state.tags.find((item) => item.id === TAG_EYE_HIGH_ID)
  if (!high || high.logic.kind !== 'condition' || high.logic.judgment.type !== 'latest') {
    throw new Error('眼表评分偏高逻辑不是 latest 条件')
  }
  const raised: Tag = {
    ...high,
    logic: { ...high.logic, judgment: { ...high.logic.judgment, value } },
  }
  return upsertTag(state, raised)
}

describe('阶段3 识别复核', () => {
  it('11:00 打开 08:00 批次李强：触发 18、当前 7，当前不满足只提示且仍可确认', () => {
    const state = createInitialState()
    const hit = hitsOfBatch(state, BATCH_INITIAL_ID).find((item) => item.patientId === LI_QIANG)
    const score = hit?.slots.find((slot) => slot.role === 'latest_eye_score')
    expect(score?.value).toBe(18)
    expect(score?.businessTime).toContain('2026-08-20T09:30:00')

    const tag = state.tags.find((item) => item.id === TAG_EYE_OP_ID)
    expect(tag).toBeDefined()
    if (!tag) return
    expect(evaluateTag(state, tag, state.clock, LI_QIANG)).toBe('not_satisfy')
    const status = currentTagEvalStatus(state, tag, LI_QIANG)
    expect(showsCurrentNotSatisfy(status)).toBe(true)

    const later = state.observations.find((item) => item.patientId === LI_QIANG && item.observedAt.startsWith('2026-09-07T10:00:00'))
    expect(later?.score).toBe(7)
    expect(hit?.slots.some((slot) => slot.observationId === later?.observationId)).toBe(false)

    expect(isBatchReviewable(state, state.batches[0]!)).toBe(true)
    const confirmed = confirmRecognitionBatch(state, BATCH_INITIAL_ID)
    expect(confirmed.ok).toBe(true)
    if (!confirmed.ok) return
    expect(confirmed.snapshotId).toBeTruthy()
    const snap = confirmed.state.snapshots.find((item) => item.id === confirmed.snapshotId)
    expect(snap?.members.map((item) => item.patientId)).toEqual(uniquePatientIds(hitsOfBatch(state, BATCH_INITIAL_ID)))
  })

  it('移除李强确认 → 五人快照；保留确认 → 六人；全移除 → 零保留、无空快照、无待办', () => {
    const state = createInitialState()
    const originalIds = uniquePatientIds(hitsOfBatch(state, BATCH_INITIAL_ID))

    const removed = removeFromReview(state, BATCH_INITIAL_ID, LI_QIANG, 'not_satisfy')
    expect(removed.ok).toBe(true)
    if (!removed.ok) return
    expect(reviewRetainedIds(removed.state, BATCH_INITIAL_ID)).toEqual(originalIds.filter((id) => id !== LI_QIANG))
    const five = confirmRecognitionBatch(removed.state, BATCH_INITIAL_ID)
    expect(five.ok).toBe(true)
    if (!five.ok || !five.snapshotId) return
    const fiveSnap = five.state.snapshots.find((item) => item.id === five.snapshotId)
    expect(fiveSnap?.members.map((item) => item.patientId)).toEqual(originalIds.filter((id) => id !== LI_QIANG))
    expect(hitsOfBatch(five.state, BATCH_INITIAL_ID).map((item) => item.patientId)).toEqual(originalIds)

    const keep = confirmRecognitionBatch(state, BATCH_INITIAL_ID)
    expect(keep.ok).toBe(true)
    if (!keep.ok || !keep.snapshotId) return
    const sixSnap = keep.state.snapshots.find((item) => item.id === keep.snapshotId)
    expect(sixSnap?.members.map((item) => item.patientId)).toEqual(originalIds)

    let allRemoved = state
    for (const patientId of originalIds) {
      const step = removeFromReview(allRemoved, BATCH_INITIAL_ID, patientId, 'not_for_this_operation')
      expect(step.ok).toBe(true)
      if (!step.ok) return
      allRemoved = step.state
    }
    const zero = confirmRecognitionBatch(allRemoved, BATCH_INITIAL_ID)
    expect(zero.ok).toBe(true)
    if (!zero.ok) return
    expect(zero.snapshotId).toBeNull()
    expect(zero.state.snapshots).toHaveLength(allRemoved.snapshots.length)
    const confirmation = zero.state.batches.find((item) => item.id === BATCH_INITIAL_ID)?.scopeConfirmations[zero.state.currentScopeId]
    expect(confirmation?.status).toBe('confirmed')
    expect(confirmation?.zeroRetention).toBe(true)
    expect(confirmation?.retainedCount).toBe(0)
    expect(pendingRecognitionBatches(zero.state)).toHaveLength(0)
    expect(workbenchStats(zero.state).pendingRecognitionBatches).toBe(0)
  })

  it('产生新批次后旧批次只读；新批次人数用当前规则现算，且不改写 08:00 hits', () => {
    const state = createInitialState()
    const trial = trialCompute(state, TAG_EYE_OP_ID)
    expect('hitPatientIds' in trial).toBe(true)
    if (!('hitPatientIds' in trial)) return

    const failed = generateAutoRecognitionBatch(setSimulateFailure(state, true), TAG_EYE_OP_ID)
    expect(failed.ok).toBe(false)
    if (failed.ok) return
    expect(failed.reason).toMatch(/失败/)
    expect(state.batches.some((item) => item.id === BATCH_INITIAL_ID)).toBe(true)

    const generated = generateAutoRecognitionBatch(state, TAG_EYE_OP_ID)
    expect(generated.ok).toBe(true)
    if (!generated.ok) return
    const newHits = hitsOfBatch(generated.state, generated.batchId)
    expect(newHits.map((item) => item.patientId).sort()).toEqual([...trial.hitPatientIds].sort())
    expect(newHits.map((item) => item.patientId)).not.toContain(LI_QIANG)

    const oldBatch = generated.state.batches.find((item) => item.id === BATCH_INITIAL_ID)
    expect(oldBatch).toBeDefined()
    if (!oldBatch) return
    expect(isBatchReviewable(generated.state, oldBatch)).toBe(false)
    const oldHits = hitsOfBatch(generated.state, BATCH_INITIAL_ID)
    expect(oldHits.map((item) => item.patientId)).toEqual(uniquePatientIds(hitsOfBatch(state, BATCH_INITIAL_ID)))
    expect(oldHits.find((item) => item.patientId === LI_QIANG)?.slots.find((slot) => slot.role === 'latest_eye_score')?.value).toBe(18)

    const newBatch = generated.state.batches.find((item) => item.id === generated.batchId)
    expect(newBatch?.ruleExplanation.expandedLogic).not.toBe(state.tags.find((item) => item.id === TAG_EYE_OP_ID)?.logic)
  })
})

describe('阶段3 人群圈选', () => {
  it('健康活动圈选三人，移除李强，保存动态仍三人；另存快照两人', () => {
    const state = createInitialState()
    const computed = computeIncludeExclude(state, [TAG_ADULT_ID], [TAG_EYE_OP_ID])
    expect('hitPatientIds' in computed).toBe(true)
    if (!('hitPatientIds' in computed)) return
    for (const patient of state.patients) {
      const adult = state.tags.find((item) => item.id === TAG_ADULT_ID)!
      const eye = state.tags.find((item) => item.id === TAG_EYE_OP_ID)!
      const includeHit = evaluateTag(state, adult, state.clock, patient.id) === 'satisfy'
      const excludeHit = evaluateTag(state, eye, state.clock, patient.id) === 'satisfy'
      expect(computed.hitPatientIds.includes(patient.id)).toBe(includeHit && !excludeHit)
    }
    expect(computed.hitPatientIds).toContain(LI_QIANG)

    const query = queryIncludeExclude(state, [TAG_ADULT_ID], [TAG_EYE_OP_ID])
    expect(query.ok).toBe(true)
    if (!query.ok) return
    expect(query.hitPatientIds).toEqual(computed.hitPatientIds)

    const retained = query.hitPatientIds.filter((id) => id !== LI_QIANG)
    const dynamic = saveDynamicCohort(state, {
      name: '健康活动圈选',
      includeTagIds: [TAG_ADULT_ID],
      excludeTagIds: [TAG_EYE_OP_ID],
      computed: { hitPatientIds: query.hitPatientIds, computedAt: query.computedAt, ruleExplanation: query.ruleExplanation },
    })
    expect(dynamic.ok).toBe(true)
    if (!dynamic.ok) return
    const saved = dynamic.state.dynamicCohorts.find((item) => item.id === dynamic.cohortId)
    expect(saved?.lastSuccessfulMemberIds).toEqual(query.hitPatientIds)
    expect(saved?.lastSuccessfulMemberIds).toContain(LI_QIANG)

    const snap = saveActiveSnapshot(dynamic.state, {
      name: '健康活动快照',
      includeTagIds: [TAG_ADULT_ID],
      excludeTagIds: [TAG_EYE_OP_ID],
      retainedPatientIds: retained,
      computed: { hitPatientIds: query.hitPatientIds, computedAt: query.computedAt, ruleExplanation: query.ruleExplanation },
    })
    expect(snap.ok).toBe(true)
    if (!snap.ok) return
    const snapshot = snap.state.snapshots.find((item) => item.id === snap.snapshotId)
    expect(snapshot?.members.map((item) => item.patientId)).toEqual(retained)
    expect(snapshot?.members.map((item) => item.patientId)).not.toContain(LI_QIANG)
    expect(snap.state.dynamicCohorts.find((item) => item.id === dynamic.cohortId)?.lastSuccessfulMemberIds).toEqual(
      query.hitPatientIds,
    )
  })

  it('修改被引用标签阈值后，旧快照来源说明仍是当时纳入／排除与展开逻辑', () => {
    const state = createInitialState()
    const query = queryIncludeExclude(state, [TAG_ADULT_ID], [TAG_EYE_OP_ID])
    expect(query.ok).toBe(true)
    if (!query.ok) return
    const saved = saveActiveSnapshot(state, {
      name: '健康活动快照',
      includeTagIds: [TAG_ADULT_ID],
      excludeTagIds: [TAG_EYE_OP_ID],
      retainedPatientIds: query.hitPatientIds,
      computed: { hitPatientIds: query.hitPatientIds, computedAt: query.computedAt, ruleExplanation: query.ruleExplanation },
    })
    expect(saved.ok).toBe(true)
    if (!saved.ok) return
    const before = saved.state.snapshots.find((item) => item.id === saved.snapshotId)?.ruleExplanation
    expect(before?.sourceType).toBe('cohort_include_exclude')
    expect(before?.includeTags?.map((item) => item.tagId)).toEqual([TAG_ADULT_ID])
    expect(before?.excludeTags?.map((item) => item.tagId)).toEqual([TAG_EYE_OP_ID])
    const frozenHigh = findTagLogicSnapshot(before?.excludeTags, TAG_EYE_HIGH_ID)
    expect(frozenHigh?.expandedLogic.kind).toBe('condition')
    if (frozenHigh?.expandedLogic.kind !== 'condition' || frozenHigh.expandedLogic.judgment.type !== 'latest') return
    expect(frozenHigh.expandedLogic.judgment.value).toBe(10)

    const updated = raiseEyeHigh(saved.state, 13)
    const after = updated.snapshots.find((item) => item.id === saved.snapshotId)?.ruleExplanation
    const still = findTagLogicSnapshot(after?.excludeTags, TAG_EYE_HIGH_ID)
    expect(still?.expandedLogic.kind).toBe('condition')
    if (still?.expandedLogic.kind !== 'condition' || still.expandedLogic.judgment.type !== 'latest') return
    expect(still.expandedLogic.judgment.value).toBe(10)
    expect(after?.logicSummary).toBe(before?.logicSummary)
  })

  it('删除来源标签后动态计算失效（提示原因非 0 命中），历史快照仍可读', () => {
    const state = createInitialState()
    const query = queryIncludeExclude(state, [TAG_ADULT_ID], [TAG_EYE_OP_ID])
    expect(query.ok).toBe(true)
    if (!query.ok) return
    const dynamic = saveDynamicCohort(state, {
      name: '健康活动圈选',
      includeTagIds: [TAG_ADULT_ID],
      excludeTagIds: [TAG_EYE_OP_ID],
      computed: { hitPatientIds: query.hitPatientIds, computedAt: query.computedAt, ruleExplanation: query.ruleExplanation },
    })
    expect(dynamic.ok).toBe(true)
    if (!dynamic.ok) return
    const snap = saveActiveSnapshot(dynamic.state, {
      name: '健康活动快照',
      includeTagIds: [TAG_ADULT_ID],
      excludeTagIds: [TAG_EYE_OP_ID],
      retainedPatientIds: query.hitPatientIds,
      computed: { hitPatientIds: query.hitPatientIds, computedAt: query.computedAt, ruleExplanation: query.ruleExplanation },
    })
    expect(snap.ok).toBe(true)
    if (!snap.ok) return

    const disabled = disableTag(snap.state, TAG_EYE_OP_ID)
    const deleted = deleteTag(disabled, TAG_EYE_OP_ID)
    expect(deleted.ok).toBe(true)
    if (!deleted.ok) return
    const refresh = refreshDynamicCohort(deleted.state, dynamic.cohortId)
    expect(refresh.ok).toBe(false)
    if (refresh.ok) return
    expect(refresh.reason).toMatch(/删除|停用/)
    expect(refresh.reason).not.toMatch(/^0/)
    const historical = deleted.state.snapshots.find((item) => item.id === snap.snapshotId)
    expect(historical?.members.map((item) => item.patientId)).toEqual(query.hitPatientIds)
    expect(historical?.ruleExplanation?.excludeTags?.[0]?.tagName).toBe('眼科复诊运营筛选')
  })

  it('缺授权不能检索；从动态确认快照不写回条件', () => {
    const state = setAuthorizedTagIds(createInitialState(), [TAG_ADULT_ID])
    const denied = queryIncludeExclude(state, [TAG_ADULT_ID], [TAG_EYE_OP_ID])
    expect(denied.ok).toBe(false)
    if (denied.ok) return
    expect(denied.reason).toMatch(/授权/)

    const allowed = createInitialState()
    const query = queryIncludeExclude(allowed, [TAG_ADULT_ID], [TAG_EYE_OP_ID])
    expect(query.ok).toBe(true)
    if (!query.ok) return
    const dynamic = saveDynamicCohort(allowed, {
      name: '健康活动圈选',
      includeTagIds: [TAG_ADULT_ID],
      excludeTagIds: [TAG_EYE_OP_ID],
      computed: { hitPatientIds: query.hitPatientIds, computedAt: query.computedAt, ruleExplanation: query.ruleExplanation },
    })
    expect(dynamic.ok).toBe(true)
    if (!dynamic.ok) return
    const retained = query.hitPatientIds.filter((id) => id !== LI_QIANG)
    const confirmed = confirmSnapshotFromDynamic(dynamic.state, dynamic.cohortId, retained)
    expect(confirmed.ok).toBe(true)
    if (!confirmed.ok) return
    const still = confirmed.state.dynamicCohorts.find((item) => item.id === dynamic.cohortId)
    expect(still?.lastSuccessfulMemberIds).toEqual(query.hitPatientIds)
    expect(confirmed.state.snapshots.find((item) => item.id === confirmed.snapshotId)?.members.map((item) => item.patientId)).toEqual(
      retained,
    )
  })
})
