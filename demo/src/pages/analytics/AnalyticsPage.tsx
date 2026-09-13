import { Link } from 'react-router-dom'
import { ROUTES, cohortDetailPath, openDetailPath, recognitionBatchPath } from '../../app/routes'
import { formatDateTime } from '../../demo/clock'
import { useDemoStore } from '../../store/DemoStoreContext'
import { displayOpenName, openRuntime, openStatusLabel, openTypeLabel } from '../../store/open'
import {
  autoRecognitionTags,
  hitsOfBatch,
  latestBatchForTag,
  pendingRecognitionBatches,
  uniquePatientIds,
} from '../../store/selectors'
import { PageHeader, StatusText } from '@/components/shared/PageHeader'
import {
  Muted,
  PageStack,
  Panel,
  Split,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/shared/kit'

export function AnalyticsPage() {
  const { state } = useDemoStore()
  const autoTags = autoRecognitionTags(state)
  const recognitionBatches = state.batches.filter((batch) => batch.kind === 'auto_recognition')
  const recognitionHits = state.hits.filter((hit) => recognitionBatches.some((batch) => batch.id === hit.batchId))
  const pending = pendingRecognitionBatches(state)
  const removes = state.reviewRecords.filter((item) => item.action === 'remove')
  const confirms = state.reviewRecords.filter((item) => item.action === 'confirm')
  const enabledOpen = state.openConfigs.filter((config) => openRuntime(state, config).status === 'enabled')
  const dynamicMembers = state.dynamicCohorts.reduce((sum, cohort) => {
    return sum + (cohort.lastSuccessfulMemberIds?.length ?? 0)
  }, 0)
  const snapshotMembers = state.snapshots.reduce((sum, item) => sum + item.members.length, 0)

  return (
    <section>
      <PageHeader
        title="运营分析"
        description="内部标签使用与管理规模。数字来自当前对象，不含趋势、人次或患者运营效果。"
      />
      <PageStack>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" data-testid="analytics-stats">
          <Stat label="自动识别标签" value={autoTags.length} testId="anl-auto-tags" />
          <Stat label="识别批次" value={recognitionBatches.length} testId="anl-batches" />
          <Stat label="去重命中人数" value={uniquePatientIds(recognitionHits).length} testId="anl-hits" />
          <Stat label="待确认批次" value={pending.length} testId="anl-pending" />
          <Stat label="动态人群" value={state.dynamicCohorts.length} testId="anl-cohorts" />
          <Stat label="授权已启用" value={enabledOpen.length} testId="anl-open" />
        </div>

        <Split>
          <Panel title="自动识别" description="按标签看最新批次，不把各标签人数相加当作整体人数。">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>标签</TableHead>
                  <TableHead>最新批次</TableHead>
                  <TableHead>人数</TableHead>
                  <TableHead>确认</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {autoTags.map((tag) => {
                  const batch = latestBatchForTag(state, tag.id)
                  const count = batch ? uniquePatientIds(hitsOfBatch(state, batch.id)).length : 0
                  const confirmation = batch?.scopeConfirmations[state.currentScopeId]
                  return (
                    <TableRow key={tag.id}>
                      <TableCell>{tag.name}</TableCell>
                      <TableCell>
                        {batch ? (
                          <Link className="text-primary font-medium hover:underline" to={recognitionBatchPath(tag.id, batch.id)}>
                            {batch.id}
                          </Link>
                        ) : (
                          '尚未扫描'
                        )}
                      </TableCell>
                      <TableCell>{batch ? count : '—'}</TableCell>
                      <TableCell>
                        <StatusText>
                          {!batch
                            ? '—'
                            : confirmation?.status === 'pending'
                              ? '待确认'
                              : confirmation?.zeroRetention
                                ? '已确认（零保留）'
                                : '已确认'}
                        </StatusText>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            <Muted className="mt-3">
              复核记录 {confirms.length} 次确认、{removes.length} 次移除。确认生成快照 {state.snapshots.filter((item) => item.sourceType === 'recognition').length} 张。
            </Muted>
          </Panel>

          <Panel title="人群形成" description="动态人群以最近成功计算为当前成员；快照人数固定。">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>人数</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.dynamicCohorts.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Link className="text-primary font-medium hover:underline" to={cohortDetailPath(item.id)}>
                        {item.name}
                      </Link>
                    </TableCell>
                    <TableCell>动态人群</TableCell>
                    <TableCell>{item.lastSuccessfulMemberIds?.length ?? '尚未计算'}</TableCell>
                  </TableRow>
                ))}
                {state.snapshots.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Link className="text-primary font-medium hover:underline" to={cohortDetailPath(item.id)}>
                        {item.name}
                      </Link>
                    </TableCell>
                    <TableCell>人群快照</TableCell>
                    <TableCell>{item.members.length}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Muted className="mt-3">
              动态人群最近成功成员合计 {dynamicMembers}（未跨人群去重）。快照成员合计 {snapshotMembers}。
            </Muted>
          </Panel>
        </Split>

        <Panel title="数据开放授权" description="「授权已启用」只表示授权生效，不表示对方已查询或接收。">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>交付记录</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.openConfigs.map((config) => {
                const runtime = openRuntime(state, config)
                return (
                  <TableRow key={config.id}>
                    <TableCell>
                      <Link className="text-primary font-medium hover:underline" to={openDetailPath(config.id)}>
                        {displayOpenName(config)}
                      </Link>
                    </TableCell>
                    <TableCell>{openTypeLabel(config.type)}</TableCell>
                    <TableCell>
                      <StatusText>{openStatusLabel(runtime.status)}</StatusText>
                    </TableCell>
                    <TableCell>{(config.deliveryRecords ?? []).length}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          <Muted className="mt-3">
            前往{' '}
            <Link className="text-primary hover:underline" to={ROUTES.open}>
              数据开放
            </Link>{' '}
            查看配置详情。本页不提供启停或导出。
          </Muted>
        </Panel>

        <Panel title="最近复核" description="复核记录按患者范围保留，不改写原始命中清单。">
          {state.reviewRecords.length === 0 ? (
            <Muted>暂无复核记录。</Muted>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>时间</TableHead>
                  <TableHead>动作</TableHead>
                  <TableHead>批次</TableHead>
                  <TableHead>说明</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...state.reviewRecords]
                  .sort((a, b) => (a.at < b.at ? 1 : -1))
                  .slice(0, 8)
                  .map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>{formatDateTime(record.at)}</TableCell>
                      <TableCell>{record.action === 'confirm' ? '确认' : '移除'}</TableCell>
                      <TableCell>{record.batchId}</TableCell>
                      <TableCell>
                        {record.action === 'remove'
                          ? `${record.patientId ?? ''} · ${record.reason ?? ''}`
                          : record.snapshotId
                            ? `生成快照 ${record.snapshotId}`
                            : '零保留，未生成快照'}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
        </Panel>
      </PageStack>
    </section>
  )
}

function Stat({ label, value, testId }: { label: string; value: number; testId: string }) {
  return (
    <article className="bg-card rounded-lg border border-border px-3.5 py-3 shadow-sm" data-testid={testId}>
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
    </article>
  )
}
