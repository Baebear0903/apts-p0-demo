import { Link, useNavigate } from 'react-router-dom'
import { ROUTES, cohortDetailPath } from '../../app/routes'
import { formatDateTime } from '../../demo/clock'
import { useDemoStore } from '../../store/DemoStoreContext'
import { currentDynamicMemberIds } from '../../store/selectors'
import { PageHeader } from '../../ui/PageHeader'
import { Button, EmptyHint, Panel, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/kit'

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
            <Button type="button" onClick={() => navigate(ROUTES.cohortNew)}>
              新建人群
            </Button>
          ) : null
        }
      />
      <Panel>
        {empty ? (
          <EmptyHint
            action={
              canCreate ? (
                <Button variant="link" nativeButton={false} render={<Link to={ROUTES.cohortNew} />}>
                  新建人群
                </Button>
              ) : null
            }
          >
            暂无已保存人群。
          </EmptyHint>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>来源</TableHead>
                <TableHead>人数</TableHead>
                <TableHead>时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.dynamicCohorts.map((item) => {
                const members = currentDynamicMemberIds(state, item.id)
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Link className="text-primary font-medium hover:underline" to={cohortDetailPath(item.id)}>
                        {item.name}
                      </Link>
                    </TableCell>
                    <TableCell>动态人群</TableCell>
                    <TableCell>主动圈选</TableCell>
                    <TableCell>{members === 'not_computed' ? '尚未计算' : members.length}</TableCell>
                    <TableCell>{item.lastSuccessfulComputedAt ? formatDateTime(item.lastSuccessfulComputedAt) : '—'}</TableCell>
                  </TableRow>
                )
              })}
              {state.snapshots.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Link className="text-primary font-medium hover:underline" to={cohortDetailPath(item.id)}>
                      {item.name}
                    </Link>
                  </TableCell>
                  <TableCell>人群快照</TableCell>
                  <TableCell>{snapshotSourceLabel(item.sourceType)}</TableCell>
                  <TableCell>{item.members.length}</TableCell>
                  <TableCell>{formatDateTime(item.confirmedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>
    </section>
  )
}

function snapshotSourceLabel(sourceType: string): string {
  if (sourceType === 'recognition') return '识别确认'
  if (sourceType === 'from_snapshot') return '由快照调整'
  return '主动圈选'
}
