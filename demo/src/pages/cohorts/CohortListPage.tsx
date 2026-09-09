import { Link, useNavigate } from 'react-router-dom'
import { ROUTES, cohortDetailPath } from '../../app/routes'
import { formatDateTime } from '../../demo/clock'
import { useDemoStore } from '../../store/DemoStoreContext'
import { currentDynamicMemberIds } from '../../store/selectors'
import { PageHeader } from '../../ui/PageHeader'

export function CohortListPage() {
  const { state } = useDemoStore()
  const navigate = useNavigate()
  const empty = state.dynamicCohorts.length === 0 && state.snapshots.length === 0
  const canCreate = state.session.permissions.buttons.cohortCreate

  return (
    <section>
      <PageHeader
        title="人群管理"
        description="已保存的动态人群与人群快照。识别确认快照与主动圈选对象在同一列表。"
        extra={
          canCreate ? (
            <button type="button" className="btn-primary" onClick={() => navigate(ROUTES.cohortNew)}>
              新建人群
            </button>
          ) : null
        }
      />
      <div className="panel">
        {empty ? (
          <div>
            <p className="empty">暂无已保存人群。</p>
            {canCreate ? <Link to={ROUTES.cohortNew}>新建人群</Link> : null}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>名称</th>
                  <th>类型</th>
                  <th>来源</th>
                  <th>人数</th>
                  <th>时间</th>
                </tr>
              </thead>
              <tbody>
                {state.dynamicCohorts.map((item) => {
                  const members = currentDynamicMemberIds(state, item.id)
                  return (
                    <tr key={item.id}>
                      <td>
                        <Link to={cohortDetailPath(item.id)}>{item.name}</Link>
                      </td>
                      <td>动态人群</td>
                      <td>主动圈选</td>
                      <td>{members === 'not_computed' ? '尚未计算' : members.length}</td>
                      <td>{item.lastSuccessfulComputedAt ? formatDateTime(item.lastSuccessfulComputedAt) : '—'}</td>
                    </tr>
                  )
                })}
                {state.snapshots.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <Link to={cohortDetailPath(item.id)}>{item.name}</Link>
                    </td>
                    <td>人群快照</td>
                    <td>{snapshotSourceLabel(item.sourceType)}</td>
                    <td>{item.members.length}</td>
                    <td>{formatDateTime(item.confirmedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}

function snapshotSourceLabel(sourceType: string): string {
  if (sourceType === 'recognition') return '识别确认'
  if (sourceType === 'from_snapshot') return '由快照调整'
  return '主动圈选'
}