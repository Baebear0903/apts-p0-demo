import { Link, useSearchParams } from 'react-router-dom'
import { ROUTES, openDetailPath } from '../../app/routes'
import type { OpenConfigStatus, OpenConfigType } from '../../domain/types'
import { useDemoStore } from '../../store/DemoStoreContext'
import { displayOpenName, openRuntime, openStatusLabel, openTypeLabel } from '../../store/open'
import { PageHeader, StatusText } from '../../ui/PageHeader'

export function OpenListPage() {
  const { state } = useDemoStore()
  const [params, setParams] = useSearchParams()
  const typeFilter = (params.get('type') as OpenConfigType | 'all' | null) ?? 'all'
  const statusFilter = (params.get('status') as OpenConfigStatus | 'all' | null) ?? 'all'
  const canCreate = state.session.permissions.buttons.openCreate

  const rows = state.openConfigs.filter((config) => {
    if (typeFilter !== 'all' && config.type !== typeFilter) return false
    const runtime = openRuntime(state, config)
    if (statusFilter !== 'all' && runtime.status !== statusFilter) return false
    return true
  })

  function setFilter(key: 'type' | 'status', value: string) {
    const next = new URLSearchParams(params)
    if (value === 'all') next.delete(key)
    else next.set(key, value)
    setParams(next)
  }

  return (
    <section>
      <PageHeader
        title="数据开放"
        description="数据集交付与标签订阅共用列表。无审批。"
        extra={
          canCreate ? (
            <Link className="btn-primary" to={ROUTES.openNew}>
              新建开放配置
            </Link>
          ) : null
        }
      />
      <div className="panel">
        <div className="filters">
          <label>
            类型
            <select value={typeFilter} onChange={(event) => setFilter('type', event.target.value)} data-testid="open-type-filter">
              <option value="all">全部</option>
              <option value="dataset_delivery">数据集交付</option>
              <option value="tag_subscription">标签订阅</option>
            </select>
          </label>
          <label>
            状态
            <select value={statusFilter} onChange={(event) => setFilter('status', event.target.value)} data-testid="open-status-filter">
              <option value="all">全部</option>
              <option value="draft">草稿</option>
              <option value="enabled">授权已启用</option>
              <option value="paused">已暂停</option>
              <option value="expired">已到期</option>
            </select>
          </label>
        </div>
        <p className="muted">「授权已启用」只表示授权生效，不表示对方已查询、接收或使用数据。</p>
        {state.openConfigs.length === 0 ? (
          <div>
            <p className="empty">暂无数据开放配置。</p>
            {canCreate ? <Link to={ROUTES.openNew}>新建开放配置</Link> : null}
          </div>
        ) : rows.length === 0 ? (
          <p className="empty">无符合筛选的开放配置。</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>名称</th>
                  <th>类型</th>
                  <th>状态</th>
                  <th>依赖／暂停原因</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => {
                  const runtime = openRuntime(state, item)
                  return (
                    <tr key={item.id} data-testid={`open-row-${item.id}`}>
                      <td>
                        <Link to={openDetailPath(item.id)}>{displayOpenName(item)}</Link>
                      </td>
                      <td>{openTypeLabel(item.type)}</td>
                      <td>
                        <StatusText>{openStatusLabel(runtime.status)}</StatusText>
                        {runtime.statusNote ? <div className="muted">{runtime.statusNote}</div> : null}
                      </td>
                      <td>
                        {runtime.displayReasons.length === 0 ? (
                          <span className="muted">无</span>
                        ) : (
                          runtime.displayReasons.join('；')
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
