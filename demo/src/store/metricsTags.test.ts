import { describe, expect, it } from 'vitest'
import { createInitialState } from '../data/seed'
import { BATCH_INITIAL_ID, MET_EYE_AVG_30_ID, MET_EYE_SCORE_ID, TAG_EYE_HIGH_ID } from '../domain/ids'
import { hitsOfBatch } from './selectors'
import { deleteMetric, deleteTag, disableTag, saveTag, setButtonPermission } from './store'

describe('指标与标签删除约束', () => {
  it('有引用的指标不可删并列出去向', () => {
    const state = createInitialState()
    const result = deleteMetric(state, MET_EYE_SCORE_ID)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toMatch(/引用/)
    expect(result.references.tags.some((item) => item.id === TAG_EYE_HIGH_ID)).toBe(true)
    expect(result.references.derived.some((item) => item.id === MET_EYE_AVG_30_ID)).toBe(true)
    expect(state.metrics.some((item) => item.id === MET_EYE_SCORE_ID)).toBe(true)
  })

  it('已发布标签须先停用才能删；停用后可删且稳定标识进入 retiredIds', () => {
    const state = createInitialState()
    const published = deleteTag(state, TAG_EYE_HIGH_ID)
    expect(published.ok).toBe(false)
    const disabled = disableTag(state, TAG_EYE_HIGH_ID)
    const deleted = deleteTag(disabled, TAG_EYE_HIGH_ID)
    expect(deleted.ok).toBe(true)
    if (!deleted.ok) return
    expect(deleted.state.tags.find((item) => item.id === TAG_EYE_HIGH_ID)?.status).toBe('deleted')
    expect(deleted.state.retiredIds).toContain(TAG_EYE_HIGH_ID)
    expect(deleted.state.hits).toHaveLength(state.hits.length)
  })

  it('无编辑权限不能保存已发布标签；恢复后保存即生效，无需再次发布，旧批次不变', () => {
    const state = createInitialState()
    const high = state.tags.find((item) => item.id === TAG_EYE_HIGH_ID)
    expect(high).toBeDefined()
    if (!high) return
    const denied = setButtonPermission(state, 'tagEdit', false)
    const blocked = saveTag(denied, { ...high, name: '眼表评分偏高-改名' }, 'strict')
    expect(blocked.ok).toBe(false)
    if (blocked.ok) return
    expect(blocked.errors.join('')).toMatch(/编辑权限/)
    expect(denied.tags.find((item) => item.id === TAG_EYE_HIGH_ID)?.name).toBe(high.name)

    const restored = setButtonPermission(denied, 'tagEdit', true)
    const saved = saveTag(restored, { ...high, name: '眼表评分偏高-改名' }, 'strict')
    expect(saved.ok).toBe(true)
    if (!saved.ok) return
    const after = saved.state.tags.find((item) => item.id === TAG_EYE_HIGH_ID)
    expect(after?.status).toBe('published')
    expect(after?.name).toBe('眼表评分偏高-改名')
    expect(hitsOfBatch(saved.state, BATCH_INITIAL_ID)).toHaveLength(hitsOfBatch(state, BATCH_INITIAL_ID).length)
  })
})
