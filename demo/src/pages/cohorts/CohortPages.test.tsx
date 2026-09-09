import { act, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { createInitialState } from '../../data/seed'
import { TAG_ADULT_ID, TAG_EYE_OP_ID } from '../../domain/ids'
import { computeIncludeExclude } from '../../engine/includeExclude'
import { DemoStoreProvider } from '../../store/DemoStoreContext'
import { queryIncludeExclude, saveDynamicCohort } from '../../store/store'
import { CohortDetailPage } from './CohortDetailPage'
import { CohortListPage } from './CohortListPage'
import { CohortNewPage } from './CohortNewPage'
import { OpenNewPage } from '../open/OpenNewPage'

const LI_QIANG = 'P-DEMO-002'

function renderCohorts(path: string, state = createInitialState()) {
  return render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <DemoStoreProvider initialState={state}>
        <Routes>
          <Route path="/cohorts" element={<CohortListPage />} />
          <Route path="/cohorts/new" element={<CohortNewPage />} />
          <Route path="/cohorts/:id" element={<CohortDetailPage />} />
          <Route path="/open/new" element={<OpenNewPage />} />
        </Routes>
      </DemoStoreProvider>
    </MemoryRouter>,
  )
}

describe('人群圈选 UI', () => {
  it('主动路径检索结果不出现当前已不满足，保存动态用完整命中', () => {
    const computed = computeIncludeExclude(createInitialState(), [TAG_ADULT_ID], [TAG_EYE_OP_ID])
    expect('hitPatientIds' in computed).toBe(true)
    if (!('hitPatientIds' in computed)) return

    renderCohorts('/cohorts/new')
    act(() => {
      screen.getByTestId(`include-${TAG_ADULT_ID}`).click()
    })
    act(() => {
      screen.getByTestId(`exclude-${TAG_EYE_OP_ID}`).click()
    })
    act(() => {
      screen.getByTestId('cohort-search').click()
    })
    expect(screen.queryByText('当前已不满足')).toBeNull()
    for (const id of computed.hitPatientIds) {
      expect(screen.getByTestId(`search-member-${id}`)).toBeInTheDocument()
    }

    act(() => {
      screen.getByTestId(`search-member-${LI_QIANG}`).querySelector('button')?.click()
    })
    expect(screen.getByText('保存条件，不保留本次人工移除')).toBeInTheDocument()
    expect(screen.getByTestId('save-snapshot')).toBeEnabled()
  })

  it('动态人群详情可跳转预填订阅', () => {
    const state = createInitialState()
    const query = queryIncludeExclude(state, [TAG_ADULT_ID], [TAG_EYE_OP_ID])
    expect(query.ok).toBe(true)
    if (!query.ok) return
    const saved = saveDynamicCohort(state, {
      name: '健康活动圈选',
      includeTagIds: [TAG_ADULT_ID],
      excludeTagIds: [TAG_EYE_OP_ID],
      computed: { hitPatientIds: query.hitPatientIds, computedAt: query.computedAt, ruleExplanation: query.ruleExplanation },
    })
    expect(saved.ok).toBe(true)
    if (!saved.ok) return
    renderCohorts(`/cohorts/${saved.cohortId}`, saved.state)
    const link = screen.getByTestId('open-subscribe')
    expect(link).toHaveAttribute('href', `/open/new?type=tag_subscription&cohortId=${saved.cohortId}`)
    expect(screen.queryByText('当前已不满足')).toBeNull()
    expect(screen.getByTestId('cohort-conditions')).toHaveTextContent('成年患者')
    expect(screen.getByTestId('cohort-conditions')).toHaveTextContent('眼科复诊运营筛选')
  })
})
