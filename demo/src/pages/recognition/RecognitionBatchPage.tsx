import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ROUTES, cohortDetailPath, patientPath } from '../../app/routes'
import { formatDateTime } from '../../demo/clock'
import type { RemoveReasonCode } from '../../domain/types'
import { useDemoStore } from '../../store/DemoStoreContext'
import {
  batchById,
  hitsOfBatch,
  isBatchReviewable,
  patientById,
  reviewRemovedIds,
  reviewRetainedIds,
  tagById,
  uniquePatientIds,
} from '../../store/selectors'
import { confirmRecognitionBatch, removeFromReview, undoRemoveFromReview } from '../../store/store'
import { PageHeader, StatusText } from '@/components/shared/PageHeader'
import { Modal, Toast } from '@/components/shared/Modal'
import { MemberTable, PatientEvidencePanel } from '@/components/patients/PatientEvidencePanel'
import { Button, Dd, DescriptionList, Dt, EmptyHint, Muted, PageStack, Panel, Toolbar } from '@/components/shared/kit'

export function RecognitionBatchPage() {
  const { tagId = '', batchId = '' } = useParams()
  const { state, patch } = useDemoStore()
  const tag = tagById(state, tagId)
  const batch = batchById(state, batchId)
  const hits = hitsOfBatch(state, batchId)
  const from = `/recognition/${tagId}/batches/${batchId}`
  const originalIds = uniquePatientIds(hits)
  const removedIds = reviewRemovedIds(state, batchId)
  const retainedIds = reviewRetainedIds(state, batchId)
  const [selectedId, setSelectedId] = useState(originalIds[0] ?? '')
  const [toast, setToast] = useState<{ text: string; tone: 'error' | 'ok' } | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const reviewable = batch ? isBatchReviewable(state, batch) : false
  const canConfirm = state.session.permissions.buttons.recognitionConfirm
  const selectedHit = useMemo(
    () => hits.find((hit) => hit.patientId === selectedId),
    [hits, selectedId],
  )

  if (!batch) {
    return (
      <section>
        <PageHeader title="识别批次" backTo={ROUTES.recognition} />
        <p>未找到批次 {batchId}。</p>
      </section>
    )
  }

  const confirmation = batch.scopeConfirmations[state.currentScopeId]
  const historical = !reviewable
  const snapshotId = confirmation?.snapshotId

  function remove(patientId: string, reason: RemoveReasonCode, note?: string) {
    const result = removeFromReview(state, batchId, patientId, reason, note)
    if (!result.ok) {
      setToast({ text: result.reason, tone: 'error' })
      return
    }
    patch(() => result.state)
    setToast({ text: '已移除，原始命中说明保留', tone: 'ok' })
  }

  function confirm() {
    const result = confirmRecognitionBatch(state, batchId)
    if (!result.ok) {
      setToast({ text: result.reason, tone: 'error' })
      return
    }
    patch(() => result.state)
    setConfirmOpen(false)
    setToast({
      text: result.snapshotId ? '已确认并生成快照' : '已确认，零保留，未生成空快照',
      tone: 'ok',
    })
  }

  function undo(patientId: string) {
    const result = undoRemoveFromReview(state, batchId, patientId)
    if (!result.ok) {
      setToast({ text: result.reason, tone: 'error' })
      return
    }
    patch(() => result.state)
    setToast({ text: '已撤销移除，患者恢复为待确认保留', tone: 'ok' })
  }

  return (
    <section>
      <PageHeader
        title={`${tag?.name ?? tagId} · ${batch.id}`}
        description={`数据刷新时间 ${formatDateTime(batch.computedAt)}`}
        backTo={ROUTES.recognition}
        backLabel="返回识别概览"
      />
      {toast ? <Toast message={toast.text} tone={toast.tone} /> : null}
      <PageStack>
      <Panel>
        <DescriptionList>
          <Dt>计算时规则说明</Dt>
          <Dd data-testid="batch-logic-summary">{batch.ruleExplanation.logicSummary}</Dd>
          <Dt>确认状态</Dt>
          <Dd>
            <StatusText>
              {historical
                ? confirmation?.status === 'confirmed'
                  ? confirmation.zeroRetention
                    ? '已确认（零保留）· 只读'
                    : '已确认 · 只读'
                  : '历史批次 · 只读'
                : originalIds.length === 0
                  ? '0 命中，不出现待确认'
                  : '待确认（全院）'}
            </StatusText>
          </Dd>
        </DescriptionList>
        <div className="mt-4 grid grid-cols-3 overflow-hidden rounded-lg border bg-muted/20 text-center" aria-label="复核人数汇总">
          <ReviewCount label="原始命中" value={originalIds.length} />
          <ReviewCount label="已移除" value={removedIds.length} tone="warn" />
          <ReviewCount label="最终保留" value={retainedIds.length} tone="ok" testId="retained-count" />
        </div>
        {snapshotId ? (
          <p className="mt-3 text-sm">
            已生成快照{' '}
            <Link className="text-primary hover:underline" to={cohortDetailPath(snapshotId)}>
              {snapshotId}
            </Link>
          </p>
        ) : null}
        {reviewable && canConfirm ? (
          <Toolbar className="mt-4">
            <Button type="button" data-testid="confirm-batch" onClick={() => setConfirmOpen(true)}>
              核对并确认快照
            </Button>
            <Muted className="m-0">全移除则不生成空快照，只留零人确认记录。</Muted>
          </Toolbar>
        ) : null}
        {historical ? <Muted className="mt-3">历史批次只读，无移除／确认。</Muted> : null}
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[minmax(280px,2fr)_minmax(320px,3fr)]">
        <Panel title="命中清单">
          <MemberTable
            state={state}
            patientIds={originalIds}
            selectedId={selectedId}
            onSelect={setSelectedId}
            removedIds={removedIds}
            trailing={(patientId) => {
              const patient = patientById(state, patientId)
              return (
                <Toolbar className="flex-nowrap justify-end">
                  {removedIds.includes(patientId) ? (
                    <Button type="button" variant="outline" size="sm" onClick={() => undo(patientId)}>撤销移除</Button>
                  ) : null}
                  <Link className="text-primary whitespace-nowrap hover:underline" to={patientPath(patientId, from)}>
                    {patient ? '完整画像' : '打开'}
                  </Link>
                </Toolbar>
              )
            }}
          />
        </Panel>
        <div>
          {selectedId ? (
            <PatientEvidencePanel
              state={state}
              patientId={selectedId}
              hit={selectedHit}
              sourceTag={tag}
              showNotSatisfy={Boolean(tag)}
              reviewable={reviewable && canConfirm && retainedIds.includes(selectedId)}
              onRemove={(reason, note) => remove(selectedId, reason, note)}
            />
          ) : (
            <EmptyHint>无命中患者。</EmptyHint>
          )}
        </div>
      </div>
      </PageStack>
      {confirmOpen ? (
        <Modal title="确认本批次复核结果" onClose={() => setConfirmOpen(false)}>
          <div className="grid grid-cols-3 overflow-hidden rounded-lg border bg-muted/20 text-center">
            <ReviewCount label="原始命中" value={originalIds.length} />
            <ReviewCount label="已移除" value={removedIds.length} tone="warn" />
            <ReviewCount label="最终保留" value={retainedIds.length} tone="ok" />
          </div>
          <p className="text-sm">
            {retainedIds.length > 0
              ? `确认后将生成一张包含 ${retainedIds.length} 人的固定快照，本批次立即只读。`
              : '已全部移除：确认后只保留零人复核记录，不生成空快照。'}
          </p>
          <Toolbar className="justify-end">
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>返回检查</Button>
            <Button type="button" data-testid="confirm-batch-final" onClick={confirm}>确认并生效</Button>
          </Toolbar>
        </Modal>
      ) : null}
    </section>
  )
}

function ReviewCount({
  label,
  value,
  tone,
  testId,
}: {
  label: string
  value: number
  tone?: 'warn' | 'ok'
  testId?: string
}) {
  return (
    <div className="min-w-0 border-r px-2 py-3 last:border-r-0">
      <div
        className={tone === 'warn' ? 'text-lg font-semibold text-amber-700' : tone === 'ok' ? 'text-lg font-semibold text-primary' : 'text-lg font-semibold'}
        data-testid={testId}
      >
        {value}
      </div>
      <div className="text-muted-foreground mt-0.5 text-xs">{label}</div>
    </div>
  )
}
