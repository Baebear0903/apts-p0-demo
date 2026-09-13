import { Link, useSearchParams } from 'react-router-dom'
import { ROUTES, openDetailPath } from '../../app/routes'
import type { OpenConfigStatus, OpenConfigType } from '../../domain/types'
import { useDemoStore } from '../../store/DemoStoreContext'
import { displayOpenName, openRuntime, openStatusLabel, openTypeLabel } from '../../store/open'
import { PageHeader, StatusText } from '@/components/shared/PageHeader'
import {
  Button,
  EmptyHint,
  FilterField,
  FullSelect,
  Muted,
  Panel,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Toolbar,
} from '@/components/shared/kit'
import { NativeSelectOption } from '@/components/ui/native-select'

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
            <Button nativeButton={false} render={<Link to={ROUTES.openNew} />}>新建开放配置</Button>
          ) : null
        }
      />
      <Panel>
        <Toolbar className="mb-3">
          <FilterField label="类型">
            <FullSelect value={typeFilter} onChange={(event) => setFilter('type', event.target.value)} data-testid="open-type-filter">
              <NativeSelectOption value="all">全部</NativeSelectOption>
              <NativeSelectOption value="dataset_delivery">数据集交付</NativeSelectOption>
              <NativeSelectOption value="tag_subscription">标签订阅</NativeSelectOption>
            </FullSelect>
          </FilterField>
          <FilterField label="状态">
            <FullSelect value={statusFilter} onChange={(event) => setFilter('status', event.target.value)} data-testid="open-status-filter">
              <NativeSelectOption value="all">全部</NativeSelectOption>
              <NativeSelectOption value="draft">草稿</NativeSelectOption>
              <NativeSelectOption value="enabled">授权已启用</NativeSelectOption>
              <NativeSelectOption value="paused">已暂停</NativeSelectOption>
              <NativeSelectOption value="expired">已到期</NativeSelectOption>
            </FullSelect>
          </FilterField>
        </Toolbar>
        <Muted className="mb-3">「授权已启用」只表示授权生效，不表示对方已查询、接收或使用数据。</Muted>
        {state.openConfigs.length === 0 ? (
          <EmptyHint action={canCreate ? <Button variant="link" nativeButton={false} render={<Link to={ROUTES.openNew} />}>新建开放配置</Button> : null}>
            暂无数据开放配置。
          </EmptyHint>
        ) : rows.length === 0 ? (
          <EmptyHint>无符合筛选的开放配置。</EmptyHint>
        ) : (
          <Table className="[&_td]:whitespace-normal">
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>依赖／暂停原因</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((item) => {
                const runtime = openRuntime(state, item)
                return (
                  <TableRow key={item.id} data-testid={`open-row-${item.id}`}>
                    <TableCell>
                      <Link className="text-primary font-medium hover:underline" to={openDetailPath(item.id)}>
                        {displayOpenName(item)}
                      </Link>
                    </TableCell>
                    <TableCell>{openTypeLabel(item.type)}</TableCell>
                    <TableCell>
                      <StatusText>{openStatusLabel(runtime.status)}</StatusText>
                      {runtime.statusNote ? <Muted className="mt-1">{runtime.statusNote}</Muted> : null}
                    </TableCell>
                    <TableCell>
                      {runtime.displayReasons.length === 0 ? (
                        <span className="text-muted-foreground">无</span>
                      ) : (
                        runtime.displayReasons.join('；')
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Panel>
    </section>
  )
}
