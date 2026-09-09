import { act, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { createInitialState } from '../../data/seed'
import { TAG_EYE_OP_ID } from '../../domain/ids'
import { DemoStoreProvider } from '../../store/DemoStoreContext'
import { setButtonPermission } from '../../store/store'
import { TagDetailPage } from './TagDetailPage'
import { TagListPage } from './TagListPage'
import { MetricsPage } from '../admin/MetricsPage'

function renderAt(path: string, state = createInitialState()) {
  return render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <DemoStoreProvider initialState={state}>
        <Routes>
          <Route path="/tags" element={<TagListPage />} />
          <Route path="/tags/new" element={<TagDetailPage />} />
          <Route path="/tags/:id" element={<TagDetailPage />} />
          <Route path="/admin/metrics" element={<MetricsPage />} />
        </Routes>
      </DemoStoreProvider>
    </MemoryRouter>,
  )
}

describe('标签中心与指标库权限／试算', () => {
  it('无新建权限不显示新建按钮', () => {
    const state = setButtonPermission(createInitialState(), 'tagCreate', false)
    renderAt('/tags', state)
    expect(screen.queryByRole('button', { name: '新建基础标签' })).toBeNull()
    expect(screen.queryByRole('button', { name: '新建复合标签' })).toBeNull()
  })

  it('有权限显示新建，试算走真实引擎命中 5 人且不含李*', async () => {
    renderAt(`/tags/${TAG_EYE_OP_ID}`)
    expect(screen.getByRole('button', { name: '试算' })).toBeInTheDocument()
    act(() => {
      screen.getByRole('button', { name: '试算' }).click()
    })
    expect(await screen.findByTestId('trial-count')).toHaveTextContent('5')
    expect(screen.queryByText(/李\*/)).toBeNull()
  })

  it('无指标维护权限不显示新建／停用／删除', () => {
    const state = setButtonPermission(createInitialState(), 'metricMaintain', false)
    renderAt('/admin/metrics', state)
    expect(screen.queryByRole('button', { name: '新建指标' })).toBeNull()
    expect(screen.queryByRole('button', { name: '停用' })).toBeNull()
    expect(screen.queryByRole('button', { name: '删除' })).toBeNull()
  })

  it('关闭标签编辑权限后已发布标签不能保存生效修改', () => {
    const state = setButtonPermission(createInitialState(), 'tagEdit', false)
    renderAt(`/tags/${TAG_EYE_OP_ID}`, state)
    expect(screen.queryByRole('button', { name: '保存生效修改' })).toBeNull()
  })
})
