import { useParams, useSearchParams } from 'react-router-dom'
import { ROUTES } from '../../app/routes'
import type { RemoveReasonCode } from '../../domain/types'
import { useDemoStore } from '../../store/DemoStoreContext'
import {
  batchById,
  hitsOfBatch,
  isBatchReviewable,
  latestBatchForTag,
  patientById,
  reviewRetainedIds,
  tagById,
} from '../../store/selectors'
import { removeFromReview } from '../../store/store'
import { PageHeader } from '../../ui/PageHeader'
import { Toast } from '../../ui/Modal'
import { useState } from 'react'
import { PatientEvidencePanel, cohortConditionText } from './PatientEvidencePanel'

export function PatientProfilePage() {
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const from = params.get('from') || ROUTES.recognition
  const { state, patch } = useDemoStore()
  const patient = patientById(state, id)
  const source = parseSource(from)
  const [toast, setToast] = useState<string | null>(null)

  const recognition =
    source.kind === 'recognition'
      ? resolveRecognition(state, source.tagId, source.batchId, id)
      : undefined
  const crowd = source.kind === 'cohort' ? resolveCrowd(state, source.crowdId) : undefined
  const reviewable = Boolean(recognition?.reviewable)
  const showNotSatisfy = source.kind === 'recognition'

  function remove(reason: RemoveReasonCode, note?: string) {
    if (!recognition) return
    const result = removeFromReview(state, recognition.batch.id, id, reason, note)
    if (!result.ok) {
      setToast(result.reason)
      return
    }
    patch(() => result.state)
  }

  return (
    <section>
      <PageHeader
        title={patient ? patient.name : '患者画像'}
        description="上下文证据页，不是全量病历。"
        backTo={from}
        backLabel="返回来源"
      />
      {toast ? <Toast message={toast} /> : null}
      {patient ? (
        <PatientEvidencePanel
          state={state}
          patientId={id}
          hit={recognition?.hit}
          sourceTag={recognition?.tag}
          showNotSatisfy={showNotSatisfy}
          reviewable={reviewable}
          hideReviewActions={source.kind === 'cohort'}
          onRemove={reviewable ? remove : undefined}
          sourceLabel={
            crowd ? (
              <div className="panel">
                <h3>来源人群</h3>
                <p>{crowd.name}</p>
                <p className="muted">
                  {crowd.kind === 'dynamic'
                    ? cohortConditionText(state, crowd.includeTagIds, crowd.excludeTagIds)
                    : crowd.ruleExplanation?.logicSummary ?? crowd.sourceType}
                </p>
                <p className="muted">从人群进入为只读，无复核按钮。</p>
              </div>
            ) : recognition ? (
              <div className="panel">
                <h3>来源识别批次</h3>
                <p>
                  {recognition.tag?.name ?? recognition.batch.tagId} · {recognition.batch.id}
                </p>
              </div>
            ) : null
          }
        />
      ) : (
        <p>未找到患者 {id}。</p>
      )}
    </section>
  )
}

function parseSource(from: string):
  | { kind: 'recognition'; tagId: string; batchId: string }
  | { kind: 'cohort'; crowdId: string }
  | { kind: 'other' } {
  const rec = from.match(/\/recognition\/([^/?]+)\/batches\/([^/?]+)/)
  if (rec?.[1] && rec[2]) return { kind: 'recognition', tagId: decodeURIComponent(rec[1]), batchId: decodeURIComponent(rec[2]) }
  const coh = from.match(/\/cohorts\/([^/?]+)/)
  if (coh?.[1] && coh[1] !== 'new') return { kind: 'cohort', crowdId: decodeURIComponent(coh[1]) }
  return { kind: 'other' }
}

function resolveRecognition(
  state: ReturnType<typeof useDemoStore>['state'],
  tagId: string,
  batchId: string,
  patientId: string,
) {
  const batch = batchById(state, batchId)
  const tag = tagById(state, tagId)
  if (!batch) return undefined
  const latest = tagId ? latestBatchForTag(state, tagId) : undefined
  const reviewable =
    Boolean(latest && latest.id === batch.id && isBatchReviewable(state, batch) && reviewRetainedIds(state, batch.id).includes(patientId))
  return {
    batch,
    tag,
    hit: hitsOfBatch(state, batch.id).find((item) => item.patientId === patientId),
    reviewable,
  }
}

function resolveCrowd(state: ReturnType<typeof useDemoStore>['state'], crowdId: string) {
  const dynamic = state.dynamicCohorts.find((item) => item.id === crowdId)
  if (dynamic) {
    return {
      kind: 'dynamic' as const,
      name: dynamic.name,
      includeTagIds: dynamic.includeTagIds,
      excludeTagIds: dynamic.excludeTagIds,
      sourceType: 'dynamic',
      ruleExplanation: dynamic.lastSuccessfulRuleExplanation,
    }
  }
  const snapshot = state.snapshots.find((item) => item.id === crowdId)
  if (snapshot) {
    return {
      kind: 'snapshot' as const,
      name: snapshot.name,
      includeTagIds: snapshot.ruleExplanation?.includeTags?.map((item) => item.tagId) ?? [],
      excludeTagIds: snapshot.ruleExplanation?.excludeTags?.map((item) => item.tagId) ?? [],
      sourceType: snapshot.sourceType,
      ruleExplanation: snapshot.ruleExplanation,
    }
  }
  return undefined
}