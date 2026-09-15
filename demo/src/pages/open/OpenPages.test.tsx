import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App from '../../App'
import { createInitialState } from '../../data/seed'
import { BATCH_INITIAL_ID, DEMO_OPEN_EXPORT_NAME, SYS_PATIENT_ID, TAG_ADULT_ID, TAG_EYE_OP_ID } from '../../domain/ids'
import { DemoStoreProvider, useDemoStore } from '../../store/DemoStoreContext'
import { confirmRecognitionBatch, enableOpenConfig, saveDynamicCohort, saveOpenConfig } from '../../store/store'
import { queryIncludeExclude } from '../../store/cohorts'

function renderApp(path: string, state = createInitialState()) {
  return render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <DemoStoreProvider initialState={state}>
        <App />
      </DemoStoreProvider>
    </MemoryRouter>,
  )
}

function OpenConfigCount() {
  const { state } = useDemoStore()
  return <output data-testid="open-config-count">{state.openConfigs.length}</output>
}

function renderAppWithStateProbe(path: string, state = createInitialState()) {
  return render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <DemoStoreProvider initialState={state}>
        <App />
        <OpenConfigCount />
      </DemoStoreProvider>
    </MemoryRouter>,
  )
}

function withCohort(state = createInitialState()) {
  const query = queryIncludeExclude(state, [TAG_ADULT_ID], [TAG_EYE_OP_ID])
  if (!query.ok) throw new Error(query.reason)
  const saved = saveDynamicCohort(state, {
    name: '健康活动圈选',
    includeTagIds: [TAG_ADULT_ID],
    excludeTagIds: [TAG_EYE_OP_ID],
    computed: { hitPatientIds: query.hitPatientIds, computedAt: query.computedAt, ruleExplanation: query.ruleExplanation },
  })
  if (!saved.ok) throw new Error(saved.reason)
  return { state: saved.state, cohortId: saved.cohortId }
}

function withSnapshot(state = createInitialState()) {
  const confirmed = confirmRecognitionBatch(state, BATCH_INITIAL_ID)
  if (!confirmed.ok || !confirmed.snapshotId) throw new Error('确认失败')
  return { state: confirmed.state, snapshotId: confirmed.snapshotId }
}

describe('数据开放页面', () => {
  it('列表与系统页不再出现后续阶段提示', () => {
    renderApp('/open')
    expect(screen.queryByText('本页将在后续阶段提供完整操作')).toBeNull()
    expect(screen.queryByText('暂无数据开放配置。')).toBeNull()
    expect(screen.getByText(DEMO_OPEN_EXPORT_NAME)).toBeInTheDocument()
  })

  it('已对接系统可维护且无地址密钥日志', () => {
    renderApp('/admin/systems')
    expect(screen.queryByText('本页将在后续阶段提供完整操作')).toBeNull()
    expect(screen.getByText('SYS-PATIENT')).toBeInTheDocument()
    expect(screen.getByText('眼科随访组')).toBeInTheDocument()
    expect(screen.queryByLabelText('地址')).toBeNull()
    expect(screen.queryByLabelText('密钥')).toBeNull()
    expect(screen.queryByRole('heading', { name: '调用日志' })).toBeNull()
    expect(screen.getByRole('button', { name: '新建已对接系统' })).toBeInTheDocument()
  })

  it('默认使用方：空时选系统带出眼科随访组，已填不覆盖', () => {
    const { state, cohortId } = withCohort()
    renderApp(`/open/new?type=tag_subscription&cohortId=${cohortId}`, state)
    const consumer = screen.getByTestId('consumer-input') as HTMLInputElement
    expect(consumer.value).toBe('')
    fireEvent.change(screen.getByTestId('system-select'), { target: { value: SYS_PATIENT_ID } })
    expect((screen.getByTestId('consumer-input') as HTMLInputElement).value).toBe('眼科随访组')
  })

  it('先填使用方再选系统不被覆盖，并可改为健康活动组织组后启用', () => {
    const { state, cohortId } = withCohort()
    renderApp(`/open/new?type=tag_subscription&cohortId=${cohortId}`, state)
    fireEvent.change(screen.getByTestId('open-name'), { target: { value: '健康活动订阅' } })
    fireEvent.change(screen.getByTestId('open-purpose'), { target: { value: '活动通知' } })
    fireEvent.change(screen.getByTestId('consumer-input'), { target: { value: '健康活动组织组' } })
    fireEvent.change(screen.getByTestId('system-select'), { target: { value: SYS_PATIENT_ID } })
    expect((screen.getByTestId('consumer-input') as HTMLInputElement).value).toBe('健康活动组织组')
    fireEvent.click(screen.getByTestId('enable-open'))
    expect(screen.getByTestId('open-status')).toHaveTextContent('授权已启用')
    expect(screen.getByTestId('consumer-input')).toBeDisabled()
  })

  it('启用失败留在表单、显示就地错误且不产生草稿', async () => {
    const state = createInitialState()
    renderAppWithStateProbe('/open/new', state)
    expect(screen.getByTestId('open-config-count')).toHaveTextContent(String(state.openConfigs.length))
    fireEvent.click(screen.getByTestId('enable-open'))
    expect(screen.getByRole('heading', { name: '新建开放配置' })).toBeInTheDocument()
    expect(screen.getByTestId('open-config-count')).toHaveTextContent(String(state.openConfigs.length))
    expect(screen.getByText('名称须为 1 至 100 字', { selector: '.form-error' })).toBeInTheDocument()
    expect(screen.getByTestId('open-name')).toHaveAttribute('aria-invalid', 'true')
    await waitFor(() => expect(screen.getByTestId('open-name')).toHaveFocus())
  })

  it('工作台摘要点名称进详情、点状态进筛选列表', () => {
    const { state, snapshotId } = withSnapshot()
    const saved = saveOpenConfig(state, {
      name: '随访导出',
      type: 'dataset_delivery',
      consumer: '眼科随访组',
      purpose: '随访',
      boundSnapshotId: snapshotId,
      method: 'direct_export',
    })
    if (!saved.ok) throw new Error(saved.reason)
    const enabled = enableOpenConfig(saved.state, saved.id)
    if (!enabled.ok) throw new Error(enabled.reason)
    renderApp('/', enabled.state)
    expect(screen.getByRole('link', { name: '随访导出' })).toHaveAttribute('href', `/open/${saved.id}`)
    expect(screen.getByTestId(`open-summary-status-${saved.id}`)).toHaveAttribute('href', '/open?status=enabled')
    expect(screen.queryByRole('button', { name: /启用|暂停|导出/ })).toBeNull()
  })

  it('快照详情导出进入预填直接导出', () => {
    const { state, snapshotId } = withSnapshot()
    renderApp(`/cohorts/${snapshotId}`, state)
    expect(screen.getByTestId('export-snapshot')).toHaveAttribute(
      'href',
      `/open/new?type=dataset_delivery&snapshotId=${snapshotId}`,
    )
  })
})
