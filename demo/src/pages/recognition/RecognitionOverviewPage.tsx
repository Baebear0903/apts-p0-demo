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
import { PageHeader, StatusText } from '../../ui/PageHeader'
import { Toast } from '../../ui/Modal'

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
      <div className="panel">
        {empty ? (
          <p className="empty">无已开启自动识别的标签且无历史批次。</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>标签</th>
                  <th>周期</th>
                  <th>最近扫描</th>
                  <th>人数</th>
                  <th>确认状态</th>
                  <th>批次</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {enabledTags.map((tag) => {
                  const batch = latestBatchForTag(state, tag.id)
                  const hitCount = batch ? uniquePatientIds(hitsOfBatch(state, batch.id)).length : 0
                  const confirmation = batch?.scopeConfirmations[state.currentScopeId]
                  const availability = tagAvailability(state, tag)
                  return (
                    <tr key={tag.id}>
                      <td>
                        {tag.name}
                        {!availability.available ? (
                          <div className="muted">不可用：{availability.reasons.join('；')}</div>
                        ) : null}
                      </td>
                      <td>每 {tag.autoRecognitionIntervalDays ?? '—'} 天</td>
                      <td>{batch ? formatDateTime(batch.computedAt) : '尚未扫描'}</td>
                      <td>{batch ? hitCount : '—'}</td>
                      <td>
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
                      </td>
                      <td>
                        {batch ? (
                          <Link to={recognitionBatchPath(tag.id, batch.id)}>{batch.id}</Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-ghost"
                          data-testid={`generate-batch-${tag.id}`}
                          onClick={() => generate(tag.id)}
                        >
                          产生新批次
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {historicalTagIds.map((tagId) => {
                  const tag = state.tags.find((item) => item.id === tagId)
                  const batch = latestBatchForTag(state, tagId)
                  const reason = recognitionHistoryReason(state, tagId)
                  return (
                    <tr key={tagId}>
                      <td>
                        {tag?.name ?? tagId}（历史入口）
                        <div className="muted">{reason}</div>
                      </td>
                      <td>—</td>
                      <td>{batch ? formatDateTime(batch.computedAt) : '—'}</td>
                      <td>{batch ? uniquePatientIds(hitsOfBatch(state, batch.id)).length : '—'}</td>
                      <td>只读历史</td>
                      <td>
                        {batch ? (
                          <Link to={recognitionBatchPath(tagId, batch.id)}>{batch.id}</Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted">当前自动识别标签数 {enabledTags.length}。已删除标签不计入。</p>
      </div>
    </section>
  )
}