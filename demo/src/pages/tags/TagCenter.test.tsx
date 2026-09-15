import { act, fireEvent, render, screen } from '@testing-library/react'
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

  it('普通条件可从参数区删除', () => {
    renderAt(`/tags/${TAG_EYE_OP_ID}`)
    const conditionLabels = screen.getAllByText('条件')
    const before = conditionLabels.length
    act(() => {
      conditionLabels[0]?.closest('button')?.click()
    })
    expect(screen.getByRole('button', { name: '删除该条件' })).toBeInTheDocument()
    act(() => {
      screen.getByRole('button', { name: '删除该条件' }).click()
    })
    expect(screen.queryAllByText('条件')).toHaveLength(before - 1)
  })

  it('衍生指标表单展示统计、关联与日期差所需配置', () => {
    renderAt('/admin/metrics')
    fireEvent.click(screen.getByRole('button', { name: '新建指标' }))
    fireEvent.change(screen.getByLabelText('类型'), { target: { value: 'derived' } })
    expect(screen.getByLabelText('衍生函数')).toBeInTheDocument()
    expect(screen.getByLabelText('统计指标')).toBeInTheDocument()
    expect(screen.getByLabelText('窗口天数')).toBeInTheDocument()
    expect(screen.getByLabelText('观察粒度')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('衍生函数'), { target: { value: 'date_diff' } })
    expect(screen.getByLabelText('起点指标')).toBeInTheDocument()
    expect(screen.getByLabelText('终点指标')).toBeInTheDocument()
    expect(screen.getByLabelText('日期差单位')).toBeInTheDocument()
  })
})
