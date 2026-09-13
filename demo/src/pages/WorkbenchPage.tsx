import { Link } from 'react-router-dom'
import { ROUTES, openDetailPath, openListPath, recognitionBatchPath } from '../app/routes'
import { formatDateTime } from '../demo/clock'
import { useDemoStore } from '../store/DemoStoreContext'
import { displayOpenName, openRuntime, openStatusLabel } from '../store/open'
import { pendingRecognitionBatches, tagById, workbenchStats } from '../store/selectors'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyHint, Muted, PageStack, Panel, Split, StatusText } from '@/components/shared/kit'
import { Button } from '@/components/ui/button'
import { Item, ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item'
import { ArrowUpRight } from 'lucide-react'

export function WorkbenchPage() {
  const { state } = useDemoStore()
  const stats = workbenchStats(state)
  const pending = pendingRecognitionBatches(state)
  const modules = state.session.permissions.modules

  return (
    <section>
      <PageHeader title="工作台" description="数字只表示当前规模，不含趋势、人次或效果。事项回到所属模块处理。" />
      <PageStack>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" data-testid="workbench-stats">
          <StatCard testId="stat-pending-batches" label="待确认识别批次" value={stats.pendingRecognitionBatches} />
          <StatCard testId="stat-pending-patients" label="待确认人数" value={stats.pendingRecognitionPatients} />
          <StatCard testId="stat-enabled-open" label="授权已启用" value={stats.enabledOpenConfigs} />
          <StatCard testId="stat-dynamic-cohorts" label="动态人群" value={stats.dynamicCohorts} />
          <StatCard testId="stat-snapshots" label="快照" value={stats.snapshots} />
          <StatCard testId="stat-published-tags" label="已发布标签" value={stats.publishedTags} />
        </div>

        <Split>
          <Panel title="待办摘要">
            {pending.length === 0 ? (
              <EmptyHint>暂无待办。无异常时不显示待处理。</EmptyHint>
            ) : (
              <ul className="space-y-3">
                {pending.map((batch) => {
                  const tag = batch.tagId ? tagById(state, batch.tagId) : undefined
                  return (
                    <li key={batch.id} className="text-sm" data-testid={`todo-recognition-${batch.tagId ?? batch.id}`}>
                      <div>
                        识别结果已更新 · {tag?.name ?? batch.tagId} · 数据刷新时间 {formatDateTime(batch.computedAt)}
                      </div>
                      <div className="mt-1">
                        {batch.tagId ? (
                          <Button variant="link" size="sm" className="h-auto px-0" nativeButton={false} render={<Link to={recognitionBatchPath(batch.tagId, batch.id)} data-testid="todo-recognition-link" />}>
                            打开最新批次
                          </Button>
                        ) : (
                          <Button variant="link" size="sm" className="h-auto px-0" nativeButton={false} render={<Link to={ROUTES.recognition} />}>
                            前往识别中心
                          </Button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Panel>
          <Panel
            title="数据开放摘要"
            description="「授权已启用」不表示对方已查询、接收或使用数据。"
            testId="open-summary"
          >
            {state.openConfigs.length === 0 ? (
              <div data-testid="open-summary-empty">
                <EmptyHint>暂无数据开放配置。</EmptyHint>
              </div>
            ) : (
              <ul className="space-y-3 text-sm">
                {state.openConfigs.map((config) => {
                  const runtime = openRuntime(state, config)
                  return (
                    <li key={config.id} data-testid={`open-summary-${config.id}`}>
                      <Link className="text-primary font-medium hover:underline" to={openDetailPath(config.id)}>
                        {displayOpenName(config)}
                      </Link>
                      {' · '}
                      <Link
                        className="inline-flex align-middle no-underline"
                        to={openListPath({ status: runtime.status })}
                        data-testid={`open-summary-status-${config.id}`}
                      >
                        <StatusText>{openStatusLabel(runtime.status)}</StatusText>
                      </Link>
                      {runtime.displayReasons.length > 0 ? (
                        <Muted className="mt-1">{runtime.displayReasons.join('；')}</Muted>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            )}
          </Panel>
        </Split>

        <Panel title="模块入口">
          <div className="grid gap-2 sm:grid-cols-2">
            {modules.tags ? (
              <EntryCard testId="entry-tags" to={ROUTES.tags} title="标签中心" description="维护标签定义与自动识别配置" />
            ) : null}
            {modules.recognition ? (
              <EntryCard testId="entry-recognition" to={ROUTES.recognition} title="识别中心" description="查看自动识别批次并复核" />
            ) : null}
            {modules.cohorts ? (
              <EntryCard testId="entry-cohorts" to={ROUTES.cohorts} title="人群管理" description="圈选动态人群与快照" />
            ) : null}
            {modules.open ? (
              <EntryCard testId="entry-open" to={ROUTES.open} title="数据开放" description="配置数据集交付与标签订阅" />
            ) : null}
          </div>
        </Panel>

        {modules.analytics ? (
          <EntryCard testId="entry-analytics" to={ROUTES.analytics} title="运营分析" description="内部使用分析入口" />
        ) : null}
      </PageStack>
    </section>
  )
}

function StatCard({ testId, label, value }: { testId: string; label: string; value: number }) {
  return (
    <article className="bg-card rounded-lg border border-border px-3.5 py-3 shadow-sm" data-testid={testId}>
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
    </article>
  )
}

function EntryCard({
  testId,
  to,
  title,
  description,
}: {
  testId: string
  to: string
  title: string
  description: string
}) {
  return (
    <Item variant="outline" size="sm" render={<Link to={to} data-testid={testId} />} className="hover:bg-accent/60 no-underline">
      <ItemContent>
        <ItemTitle className="flex items-center gap-1">
          {title}
          <ArrowUpRight className="text-muted-foreground size-3.5" />
        </ItemTitle>
        <ItemDescription>{description}</ItemDescription>
      </ItemContent>
    </Item>
  )
}
