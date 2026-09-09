import { describe, expect, it } from 'vitest'
import { createInitialState } from '../data/seed'
import { DEFAULT_DEMO_CLOCK } from '../domain/ids'
import { workbenchStats } from './selectors'
import { advanceClock, loadRuleSamples, resetState, unloadRuleSamples } from './store'

describe('store', () => {
  it('reset 后统计与时钟回到初始对象', () => {
    const initial = createInitialState()
    let state = advanceClock(initial, 180)
    state = loadRuleSamples(state)
    state = { ...state, tags: [], hits: [] }
    const restored = resetState()

    expect(restored.clock).toBe(DEFAULT_DEMO_CLOCK)
    expect(restored.session.mode).toBe('business')
    expect(workbenchStats(restored)).toEqual(workbenchStats(createInitialState()))
    expect(restored.tags).toHaveLength(initial.tags.length)
    expect(restored.hits).toHaveLength(initial.hits.length)
  })

  it('载入规则样例只切换会话副本，退出后业务对象仍在', () => {
    const state = createInitialState()
    const loaded = loadRuleSamples(state)
    expect(loaded.session.mode).toBe('ruleSamples')
    expect(loaded.session.ruleSampleWorkingCopy?.patients).toEqual(state.ruleSamples.patients)
    expect(loaded.patients).toEqual(state.patients)
    const unloaded = unloadRuleSamples(loaded)
    expect(unloaded.session.mode).toBe('business')
    expect(unloaded.session.ruleSampleWorkingCopy).toBeNull()
    expect(workbenchStats(unloaded)).toEqual(workbenchStats(state))
  })
})
