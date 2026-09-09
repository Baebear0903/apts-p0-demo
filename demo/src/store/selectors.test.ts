import { describe, expect, it } from 'vitest'
import { createInitialState } from '../data/seed'
import { loadRuleSamples } from './store'
import {
  enabledOpenConfigs,
  hitsOfBatch,
  pendingRecognitionBatches,
  publishedTags,
  uniquePatientIds,
  workbenchStats,
} from './selectors'

describe('workbenchStats', () => {
  it('规模数字全部从共享对象推导', () => {
    const state = createInitialState()
    const stats = workbenchStats(state)
    const pending = pendingRecognitionBatches(state)
    const pendingHits = pending.flatMap((batch) => hitsOfBatch(state, batch.id))

    expect(stats.pendingRecognitionBatches).toBe(pending.length)
    expect(stats.pendingRecognitionPatients).toBe(uniquePatientIds(pendingHits).length)
    expect(stats.enabledOpenConfigs).toBe(enabledOpenConfigs(state).length)
    expect(stats.dynamicCohorts).toBe(state.dynamicCohorts.length)
    expect(stats.snapshots).toBe(state.snapshots.length)
    expect(stats.publishedTags).toBe(publishedTags(state).length)
  })

  it('待确认人数随命中对象变化，而不是页面预写', () => {
    const state = createInitialState()
    const original = workbenchStats(state)
    const remainingHits = state.hits.slice(1)
    const mutated = { ...state, hits: remainingHits }
    const next = workbenchStats(mutated)

    expect(next.pendingRecognitionPatients).toBe(uniquePatientIds(remainingHits).length)
    expect(next.pendingRecognitionPatients).not.toBe(original.pendingRecognitionPatients)
  })

  it('对象为空时仍得到 0 而不是隐藏数字', () => {
    const state = createInitialState()
    const empty = {
      ...state,
      batches: [],
      hits: [],
      tags: [],
      openConfigs: [],
      dynamicCohorts: [],
      snapshots: [],
    }
    const stats = workbenchStats(empty)
    expect(stats.pendingRecognitionBatches).toBe(empty.batches.length)
    expect(stats.pendingRecognitionPatients).toBe(uniquePatientIds(empty.hits).length)
    expect(stats.enabledOpenConfigs).toBe(empty.openConfigs.length)
    expect(stats.dynamicCohorts).toBe(empty.dynamicCohorts.length)
    expect(stats.snapshots).toBe(empty.snapshots.length)
    expect(stats.publishedTags).toBe(empty.tags.length)
  })

  it('规则样例患者不计入主故事规模', () => {
    const state = createInitialState()
    const loaded = loadRuleSamples(state)
    expect(workbenchStats(loaded)).toEqual(workbenchStats(state))
    expect(loaded.patients).toEqual(state.patients)
    expect(
      uniquePatientIds(state.hits).some((id) => loaded.ruleSamples.patients.some((patient) => patient.id === id)),
    ).toBe(false)
  })
})
