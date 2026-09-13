import { useState } from 'react'
import { Link } from 'react-router-dom'
import { recognitionBatchPath } from '../../app/routes'
import { formatDateTime } from '../../demo/clock'
import { tagAvailability } from '../../engine/availability'
import { useDemoStore } from '../../store/DemoStoreContext'
import {
  autoRecognitionTags,
  historicalRecognitionTagIds,
  hitsOfBatch,
  latestBatchForTag,
  recognitionHistoryReason,
  uniquePatientIds,
} from '../../store/selectors'
import { generateAutoRecognitionBatch } from '../../store/store'
import { PageHeader, StatusText } from '@/components/shared/PageHeader'
import { Toast } from '@/components/shared/Modal'
import {
  Button,
  EmptyHint,
  Muted,
  Panel,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/shared/kit'

export function RecognitionOverviewPage() {
  const { state, patch } = useDemoStore()
  const enabledTags = autoRecognitionTags(state)
  const historicalTagIds = historicalRecognitionTagIds(state)
  const empty = enabledTags.length === 0 && state.batches.filter((batch) => batch.kind === 'auto_recognition').length === 0
  const [toast, setToast] = useState<string | null>(null)

  function generate(tagId: string) {
    const result = generateAutoRecognitionBatch(state, tagId)
    if (!result.ok) {
      setToast(result.reason)
      return
    }
    setToast(null)
    patch(() => result.state)
  }

  return (
    <section>
      <PageHeader title="识别中心" description="已开启自动识别的标签及已停止的历史入口。删除后只读历史不计入当前自动识别标签数。" />
      {toast ? <Toast message={toast} /> : null}
      <Panel>
        {empty ? (
          <EmptyHint>无已开启自动识别的标签且无历史批次。</EmptyHint>
        ) : (
          <Table className="[&_td]:whitespace-normal">
            <TableHeader>
              <TableRow>
                <TableHead>标签</TableHead>
                <TableHead>周期</TableHead>
                <TableHead>最近扫描</TableHead>
                <TableHead>人数</TableHead>
                <TableHead>确认状态</TableHead>
                <TableHead>批次</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {enabledTags.map((tag) => {
                const batch = latestBatchForTag(state, tag.id)
                const hitCount = batch ? uniquePatientIds(hitsOfBatch(state, batch.id)).length : 0
                const confirmation = batch?.scopeConfirmations[state.currentScopeId]
                const availability = tagAvailability(state, tag)
                return (
                  <TableRow key={tag.id}>
                    <TableCell>
                      {tag.name}
                      {!availability.available ? (
                        <Muted className="mt-1">不可用：{availability.reasons.join('；')}</Muted>
                      ) : null}
                    </TableCell>
                    <TableCell>每 {tag.autoRecognitionIntervalDays ?? '—'} 天</TableCell>
                    <TableCell>{batch ? formatDateTime(batch.computedAt) : '尚未扫描'}</TableCell>
                    <TableCell>{batch ? hitCount : '—'}</TableCell>
                    <TableCell>
                      <StatusText>
                        {!batch
                          ? '—'
                          : hitCount === 0
                            ? '0 命中，不出现待确认'
                            : confirmation?.status === 'pending'
                              ? '待确认'
                              : confirmation?.zeroRetention
                                ? '已确认（零保留）'
                                : '已确认'}
                      </StatusText>
                    </TableCell>
                    <TableCell>
                      {batch ? (
                        <Link className="text-primary hover:underline" to={recognitionBatchPath(tag.id, batch.id)}>
                          {batch.id}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>
                      <Button type="button" variant="outline" size="sm" data-testid={`generate-batch-${tag.id}`} onClick={() => generate(tag.id)}>
                        产生新批次
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
              {historicalTagIds.map((tagId) => {
                const tag = state.tags.find((item) => item.id === tagId)
                const batch = latestBatchForTag(state, tagId)
                const reason = recognitionHistoryReason(state, tagId)
                return (
                  <TableRow key={tagId}>
                    <TableCell>
                      {tag?.name ?? tagId}（历史入口）
                      <Muted className="mt-1">{reason}</Muted>
                    </TableCell>
                    <TableCell>—</TableCell>
                    <TableCell>{batch ? formatDateTime(batch.computedAt) : '—'}</TableCell>
                    <TableCell>{batch ? uniquePatientIds(hitsOfBatch(state, batch.id)).length : '—'}</TableCell>
                    <TableCell>只读历史</TableCell>
                    <TableCell>
                      {batch ? (
                        <Link className="text-primary hover:underline" to={recognitionBatchPath(tagId, batch.id)}>
                          {batch.id}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
        <Muted className="mt-3">当前自动识别标签数 {enabledTags.length}。已删除标签不计入。</Muted>
      </Panel>
    </section>
  )
}
