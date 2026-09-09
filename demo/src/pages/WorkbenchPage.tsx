import { Link } from 'react-router-dom'
import { ROUTES, openDetailPath, openListPath, recognitionBatchPath } from '../app/routes'
import { formatDateTime } from '../demo/clock'
import { useDemoStore } from '../store/DemoStoreContext'
import { displayOpenName, openRuntime, openStatusLabel } from '../store/open'
import { pendingRecognitionBatches, tagById, workbenchStats } from '../store/selectors'
import { PageHeader } from '../ui/PageHeader'

export function WorkbenchPage() {
  const { state } = useDemoStore()
  const stats = workbenchStats(state)
  const pending = pendingRecognitionBatches(state)
  const modules = state.session.permissions.modules

  return (
    <section>
      <PageHeader title="工作台" description="数字只表示当前规模，不含趋势、人次或效果。事项回到所属模块处理。" />
      <div className="stat-grid" data-testid="workbench-stats">
        <StatCard
          testId="stat-pending-batches"
          label="待确认识别批次"
          value={stats.pendingRecognitionBatches}
        />
        <StatCard
          testId="stat-pending-patients"
          label="待确认人数"
          value={stats.pendingRecognitionPatients}
        />
        <StatCard testId="stat-enabled-open" label="授权已启用" value={stats.enabledOpenConfigs} />
        <StatCard testId="stat-dynamic-cohorts" label="动态人群" value={stats.dynamicCohorts} />
        <StatCard testId="stat-snapshots" label="快照" value={stats.snapshots} />
        <StatCard testId="stat-published-tags" label="已发布标签" value={stats.publishedTags} />
      </div>

      <div className="split" style={{ marginTop: 16 }}>
        <div className="panel">
          <h3>待办摘要</h3>
          {pending.length === 0 ? (
            <p className="empty">暂无待办。无异常时不显示待处理。</p>
          ) : (
            <ul>
              {pending.map((batch) => {
                const tag = batch.tagId ? tagById(state, batch.tagId) : undefined
                return (
                  <li key={batch.id} data-testid={`todo-recognition-${batch.tagId ?? batch.id}`}>
                    识别结果已更新 · {tag?.name ?? batch.tagId} · 数据刷新时间{' '}
                    {formatDateTime(batch.computedAt)}
                    <div>
                      {batch.tagId ? (
                        <Link to={recognitionBatchPath(batch.tagId, batch.id)} data-testid="todo-recognition-link">
                          打开最新批次
                        </Link>
                      ) : (
                        <Link to={ROUTES.recognition}>前往识别中心</Link>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        <div className="panel" data-testid="open-summary">
          <h3>数据开放摘要</h3>
          <p className="muted">「授权已启用」不表示对方已查询、接收或使用数据。</p>
          {state.openConfigs.length === 0 ? (
            <p className="empty" data-testid="open-summary-empty">
              暂无数据开放配置。
            </p>
          ) : (
            <ul>
              {state.openConfigs.map((config) => {
                const runtime = openRuntime(state, config)
                return (
                  <li key={config.id} data-testid={`open-summary-${config.id}`}>
                    <Link to={openDetailPath(config.id)}>{displayOpenName(config)}</Link>
                    {' · '}
                    <Link to={openListPath({ status: runtime.status })} data-testid={`open-summary-status-${config.id}`}>
                      {openStatusLabel(runtime.status)}
                    </Link>
                    {runtime.displayReasons.length > 0 ? (
                      <div className="muted">{runtime.displayReasons.join('；')}</div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="panel">
        <h3>模块入口</h3>
        <div className="module-grid">
          {modules.tags ? (
            <Link className="module-card" to={ROUTES.tags} data-testid="entry-tags">
              <h3>标签中心</h3>
              <p className="muted">维护标签定义与自动识别配置</p>
            </Link>
          ) : null}
          {modules.recognition ? (
            <Link className="module-card" to={ROUTES.recognition} data-testid="entry-recognition">
              <h3>识别中心</h3>
              <p className="muted">查看自动识别批次并复核</p>
            </Link>
          ) : null}
          {modules.cohorts ? (
            <Link className="module-card" to={ROUTES.cohorts} data-testid="entry-cohorts">
              <h3>人群管理</h3>
              <p className="muted">圈选动态人群与快照</p>
            </Link>
          ) : null}
          {modules.open ? (
            <Link className="module-card" to={ROUTES.open} data-testid="entry-open">
              <h3>数据开放</h3>
              <p className="muted">配置数据集交付与标签订阅</p>
            </Link>
          ) : null}
        </div>
      </div>

      {modules.analytics ? (
        <Link className="entry-card" to={ROUTES.analytics} data-testid="entry-analytics">
          <h3>运营分析</h3>
          <p className="muted">内部使用分析入口</p>
        </Link>
      ) : null}
    </section>
  )
}

function StatCard({ testId, label, value }: { testId: string; label: string; value: number }) {
  return (
    <article className="stat-card" data-testid={testId}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </article>
  )
}


