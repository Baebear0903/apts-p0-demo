import { describe, expect, it } from 'vitest'
import {
  BATCH_INITIAL_ID,
  INITIAL_HIT_PATIENT_IDS,
  MAIN_STORY_PATIENT_IDS,
  TAG_ADULT_ID,
  TAG_EYE_HIGH_ID,
  TAG_EYE_OP_ID,
} from '../domain/ids'
import { hitsOfBatch, uniquePatientIds } from '../store/selectors'
import { createInitialState } from './seed'

describe('createInitialState', () => {
  it('预置主故事患者、已发布标签与初始批次命中关系', () => {
    const state = createInitialState()
    const published = state.tags.filter((tag) => tag.status === 'published')
    const initialBatch = state.batches.find((batch) => batch.id === BATCH_INITIAL_ID)
    const hits = hitsOfBatch(state, BATCH_INITIAL_ID)

    expect(state.patients.map((patient) => patient.id)).toEqual([...MAIN_STORY_PATIENT_IDS])
    expect(published.map((tag) => tag.id).sort()).toEqual(
      [TAG_ADULT_ID, TAG_EYE_HIGH_ID, TAG_EYE_OP_ID].sort(),
    )
    expect(published).toHaveLength(state.tags.filter((tag) => tag.status === 'published').length)
    expect(state.batches.some((item) => item.id === BATCH_INITIAL_ID)).toBe(true)
    expect(initialBatch?.tagId).toBe(TAG_EYE_OP_ID)
    expect(initialBatch?.scopeConfirmations[state.currentScopeId]?.status).toBe('pending')
    expect(state.dynamicCohorts.length).toBeGreaterThan(0)
    expect(state.snapshots.length).toBeGreaterThan(0)
    expect(state.openConfigs.length).toBeGreaterThan(0)
    expect(state.tags.some((tag) => tag.status === 'draft')).toBe(true)
    expect(state.tags.some((tag) => tag.status === 'manually_disabled')).toBe(true)
    expect(hits.map((hit) => hit.patientId)).toEqual([...INITIAL_HIT_PATIENT_IDS])
    expect(uniquePatientIds(hits)).toEqual([...INITIAL_HIT_PATIENT_IDS])
    expect(hits).toHaveLength(INITIAL_HIT_PATIENT_IDS.length)
  })

  it('初始批次证据只使用计算时点已入库观察，不含计算后评分', () => {
    const state = createInitialState()
    const batch = state.batches[0]
    expect(batch).toBeDefined()
    if (!batch) return

    const laterObservationIds = new Set(
      state.observations
        .filter((item) => item.ingestedAt > batch.computedAt)
        .map((item) => item.observationId),
    )
    expect(laterObservationIds.size).toBeGreaterThan(0)

    for (const hit of hitsOfBatch(state, batch.id)) {
      for (const slot of hit.slots) {
        if (slot.observationId) {
          expect(laterObservationIds.has(slot.observationId)).toBe(false)
        }
        if (slot.ingestedAt) {
          expect(slot.ingestedAt <= batch.computedAt).toBe(true)
        }
        expect(slot.businessTime <= batch.computedAt).toBe(true)
      }
    }
  })

  it('规则样例分区与主故事患者隔离', () => {
    const state = createInitialState()
    expect(state.patients.every((patient) => patient.id.startsWith('P-DEMO-'))).toBe(true)
    expect(state.ruleSamples.patients.every((patient) => patient.id.startsWith('RULE-'))).toBe(true)
    expect(state.ruleSamples.patients.length).toBeGreaterThan(0)
    expect(state.session.mode).toBe('business')
  })
})
