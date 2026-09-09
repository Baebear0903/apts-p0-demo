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
import { confirmRecognitionBatch, removeFromReview } from '../../store/store'
import { PageHeader, StatusText } from '../../ui/PageHeader'
import { Toast } from '../../ui/Modal'
import { MemberTable, PatientEvidencePanel } from '../patients/PatientEvidencePanel'

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
    setToast({
      text: result.snapshotId ? '已确认并生成快照' : '已确认，零保留，未生成空快照',
      tone: 'ok',
    })
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
      <div className="panel">
        <dl className="dl">
          <dt>计算时规则说明</dt>
          <dd data-testid="batch-logic-summary">{batch.ruleExplanation.logicSummary}</dd>
          <dt>确认状态</dt>
          <dd>
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
          </dd>
          <dt>原始命中</dt>
          <dd>{originalIds.length}</dd>
          <dt>待确认保留</dt>
          <dd data-testid="retained-count">{retainedIds.length}</dd>
        </dl>
        {snapshotId ? (
          <p>
            已生成快照 <Link to={cohortDetailPath(snapshotId)}>{snapshotId}</Link>
          </p>
        ) : null}
        {reviewable && canConfirm ? (
          <div className="toolbar-actions">
            <button type="button" className="btn-primary" data-testid="confirm-batch" onClick={confirm}>
              确认保留为快照
            </button>
            <p className="muted">全移除则不生成空快照，只留零人确认记录。</p>
          </div>
        ) : null}
        {historical ? <p className="muted">历史批次只读，无移除／确认。</p> : null}
      </div>

      <div className="review-layout">
        <div className="panel">
          <h3>命中清单</h3>
          <MemberTable
            state={state}
            patientIds={originalIds}
            selectedId={selectedId}
            onSelect={setSelectedId}
            removedIds={removedIds}
            trailing={(patientId) => {
              const patient = patientById(state, patientId)
              return (
                <Link to={patientPath(patientId, from)}>{patient ? '完整画像' : '打开'}</Link>
              )
            }}
          />
        </div>
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
            <p className="empty">无命中患者。</p>
          )}
        </div>
      </div>
    </section>
  )
}