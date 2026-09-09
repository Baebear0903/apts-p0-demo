import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App from '../App'
import { createInitialState } from '../data/seed'
import { DemoStoreProvider } from '../store/DemoStoreContext'
import { workbenchStats } from '../store/selectors'

function renderApp(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <DemoStoreProvider>
        <App />
      </DemoStoreProvider>
    </MemoryRouter>,
  )
}

describe('WorkbenchPage', () => {
  it('展示由 selector 推导的规模数字，无首页处理按钮，有运营分析入口', () => {
    renderApp('/')
    const stats = workbenchStats(createInitialState())
    expect(screen.getByTestId('stat-pending-batches')).toHaveTextContent(String(stats.pendingRecognitionBatches))
    expect(screen.getByTestId('stat-pending-patients')).toHaveTextContent(String(stats.pendingRecognitionPatients))
    expect(screen.getByTestId('stat-enabled-open')).toHaveTextContent(String(stats.enabledOpenConfigs))
    expect(screen.getByTestId('stat-dynamic-cohorts')).toHaveTextContent(String(stats.dynamicCohorts))
    expect(screen.getByTestId('stat-snapshots')).toHaveTextContent(String(stats.snapshots))
    expect(screen.getByTestId('stat-published-tags')).toHaveTextContent(String(stats.publishedTags))

    const main = screen.getByRole('main')
    expect(within(main).queryByRole('button', { name: /复核/ })).toBeNull()
    expect(within(main).queryByRole('button', { name: /启用|暂停|导出/ })).toBeNull()
    expect(screen.getByTestId('entry-analytics')).toHaveTextContent('运营分析')
    expect(screen.getByTestId('entry-tags')).toHaveAttribute('href', '/tags')
    expect(screen.getByTestId('entry-recognition')).toHaveAttribute('href', '/recognition')
    expect(screen.getByTestId('entry-cohorts')).toHaveAttribute('href', '/cohorts')
    expect(screen.getByTestId('entry-open')).toHaveAttribute('href', '/open')
  })
})

describe('关键路由可打开', () => {
  it.each([
    ['/', '工作台'],
    ['/tags', '标签中心'],
    ['/recognition', '识别中心'],
    ['/cohorts', '人群管理'],
    ['/open', '数据开放'],
    ['/analytics', '运营分析'],
    ['/admin/datasets', '数据集'],
    ['/admin/auth', '标签使用授权'],
    ['/admin/scopes', '患者范围'],
  ])('%s 渲染标题 %s', (path, title) => {
    renderApp(path)
    expect(screen.getByRole('heading', { level: 2, name: title })).toBeInTheDocument()
  })

  it('运营分析展示内部使用规模而非占位', () => {
    renderApp('/analytics')
    expect(screen.queryByText('模块开发中')).toBeNull()
    expect(screen.getByTestId('analytics-stats')).toBeInTheDocument()
    expect(screen.getByTestId('anl-cohorts')).toHaveTextContent(/[1-9]/)
    expect(screen.getByTestId('anl-open')).toHaveTextContent(/[1-9]/)
  })

  it('标签使用授权展示演示白名单', () => {
    renderApp('/admin/auth')
    expect(screen.getByTestId('auth-whitelist')).toBeInTheDocument()
    expect(screen.getByText('眼科复诊运营筛选')).toBeInTheDocument()
  })

  it('患者范围只读展示全院且不含无院区建档对象', () => {
    renderApp('/admin/scopes')
    expect(screen.getByText('全院')).toBeInTheDocument()
    expect(screen.getByText('不含')).toBeInTheDocument()
  })

  it('数据集只读展示共享对象样例，无配置为指标', () => {
    const state = createInitialState()
    const firstPatient = state.patients[0]
    expect(firstPatient).toBeDefined()
    renderApp('/admin/datasets')
    expect(screen.getByText('cdr_patient')).toBeInTheDocument()
    if (firstPatient) {
      expect(screen.getByText(firstPatient.id)).toBeInTheDocument()
    }
    expect(screen.queryByText('配置为指标')).toBeNull()
    expect(screen.queryByRole('button', { name: /新增|删除|停用/ })).toBeNull()
    expect(screen.getAllByText(/虚构演示号码，非真实号码/).length).toBeGreaterThan(0)
  })
})
