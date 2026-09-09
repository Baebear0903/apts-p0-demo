import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { formatDateTime } from '../../demo/clock'
import type { AppState, EvidenceSlot, Hit, RemoveReasonCode, Tag } from '../../domain/types'
import { latestEyeScoreSlot } from '../../engine/evidence'
import { evaluateTag, isBlocked } from '../../engine/evaluate'
import { isTagAuthorized, tagDisplayName } from '../../engine/includeExclude'
import { walkTagRefs } from '../../engine/availability'
import {
  currentTagEvalStatus,
  latestEncounter,
  patientById,
  showsCurrentNotSatisfy,
  tagById,
} from '../../store/selectors'
import { PhoneNote, StatusText } from '../../ui/PageHeader'

const REMOVE_REASONS: Array<{ code: RemoveReasonCode; label: string }> = [
  { code: 'not_satisfy', label: '当前已不满足' },
  { code: 'not_for_this_operation', label: '不应纳入本次运营人群' },
  { code: 'other', label: '其他' },
]

export function PatientEvidencePanel({
  state,
  patientId,
  hit,
  sourceTag,
  showNotSatisfy,
  reviewable,
  onRemove,
  hideReviewActions,
  sourceLabel,
}: {
  state: AppState
  patientId: string
  hit?: Hit
  sourceTag?: Tag
  showNotSatisfy: boolean
  reviewable: boolean
  onRemove?: (reason: RemoveReasonCode, note?: string) => void
  hideReviewActions?: boolean
  sourceLabel?: ReactNode
}) {
  const patient = patientById(state, patientId)
  const encounter = latestEncounter(state, patientId)
  const currentScore = latestEyeScoreSlot(state, patientId, state.clock)
  const triggerScore = hit?.slots.find((slot) => slot.role === 'latest_eye_score')
  const status = sourceTag ? currentTagEvalStatus(state, sourceTag, patientId) : undefined
  const [reasonCode, setReasonCode] = useState<RemoveReasonCode>('not_for_this_operation')
  const [note, setNote] = useState('')
  const [expanded, setExpanded] = useState(false)
  const authorizedOthers = otherAuthorizedHits(state, patientId, sourceTag?.id)

  if (!patient) {
    return <p>未找到患者 {patientId}。</p>
  }

  const timeline = buildTimeline(hit?.slots ?? [], currentScore)

  return (
    <div className="stack" data-testid="patient-evidence">
      {sourceLabel}
      <div className="panel">
        <h3>身份与就诊</h3>
        <dl className="dl">
          <dt>姓名</dt>
          <dd>{patient.name}</dd>
          <dt>主患者标识</dt>
          <dd>{patient.id}</dd>
          <dt>性别</dt>
          <dd>{patient.sex}</dd>
          <dt>年龄</dt>
          <dd>{patient.age}</dd>
          <dt>就诊标识</dt>
          <dd>{encounter?.id ?? '—'}</dd>
          <dt>就诊科室</dt>
          <dd>{encounter?.department ?? '—'}</dd>
          <dt>联系电话</dt>
          <dd>{patient.phone ?? '空'}</dd>
        </dl>
        <PhoneNote />
      </div>

      {showNotSatisfy && status && showsCurrentNotSatisfy(status) ? (
        <div className="notice notice-warn" role="status" data-testid="current-not-satisfy">
          当前已不满足。仅作提示，不自动移除，也不阻止确认。触发时证据仍保留。
        </div>
      ) : null}
      {showNotSatisfy ? (
        <p className="muted">未提示「当前已不满足」不表示已验证仍满足。失败或无法判断不会提示为不满足。</p>
      ) : null}

      {sourceTag ? (
        <div className="panel">
          <h3>来源条件</h3>
          <p>{sourceTag.status === 'deleted' ? `${sourceTag.name}（已删除标签）` : sourceTag.name}</p>
          <p className="muted">稳定标识 {sourceTag.id}</p>
        </div>
      ) : null}

      <div className="panel">
        <h3>触发时证据</h3>
        {triggerScore ? (
          <p>
            触发时眼表评分 <strong data-testid="trigger-score">{String(triggerScore.value)}</strong>
            <span className="muted"> · 业务时间 {formatDateTime(triggerScore.businessTime)}</span>
          </p>
        ) : null}
        {currentScore ? (
          <p>
            当前眼表评分 <strong data-testid="current-score">{String(currentScore.value)}</strong>
            <span className="muted"> · 业务时间 {formatDateTime(currentScore.businessTime)}</span>
          </p>
        ) : (
          <p className="muted">当前无可用眼表评分。</p>
        )}
        {hit?.slots.length ? (
          <ul>
            {hit.slots.map((slot) => (
              <li key={`${slot.role}-${slot.observationId ?? slot.encounterId ?? slot.metricId}`}>
                {slot.role}：{String(slot.value)} · {formatDateTime(slot.businessTime)}
                {slot.observationId ? ` · ${slot.observationId}` : ''}
                {slot.encounterId ? ` · ${slot.encounterId}` : ''}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">无保存的触发时证据槽位。</p>
        )}
      </div>

      <div className="panel">
        <h3>证据时间轴</h3>
        <p className="muted">按业务时间，不展示全量病历。</p>
        {timeline.length === 0 ? (
          <p className="empty">无相关证据。</p>
        ) : (
          <ol className="timeline">
            {timeline.map((item) => (
              <li key={item.key}>
                {formatDateTime(item.businessTime)} · {item.label}：{String(item.value)}
              </li>
            ))}
          </ol>
        )}
      </div>

      {sourceTag?.type === 'composite' ? (
        <div className="panel">
          <h3>复合证据</h3>
          <button type="button" className="btn-ghost" onClick={() => setExpanded((value) => !value)}>
            {expanded ? '收起基础逻辑贡献' : '展开基础逻辑贡献'}
          </button>
          {expanded ? (
            <ul data-testid="composite-contributions">
              {referencedBasicTags(state, sourceTag).map((basic) => {
                const result = evaluateTag(state, basic, hit?.computedAt ?? state.clock, patientId)
                const authorized = isTagAuthorized(state, basic.id)
                return (
                  <li key={basic.id}>
                    {basic.name}：{isBlocked(result) ? result.reason : result}
                    {authorized ? null : <span className="muted">（未授权，不能跳转独立命中清单）</span>}
                  </li>
                )
              })}
            </ul>
          ) : null}
          <p className="muted">复合授权不沿引用扩大白名单，此处不提供基础标签命中清单入口。</p>
        </div>
      ) : null}

      <div className="panel">
        <h3>其他获授权标签</h3>
        {authorizedOthers.length === 0 ? (
          <p className="empty">无其他获授权且当前命中的标签。</p>
        ) : (
          <ul>
            {authorizedOthers.map((tag) => (
              <li key={tag.id}>{tag.name}</li>
            ))}
          </ul>
        )}
      </div>

      {reviewable && !hideReviewActions && onRemove ? (
        <div className="panel">
          <h3>复核</h3>
          <div className="form-stack">
            <label>
              移除原因
              <select value={reasonCode} onChange={(event) => setReasonCode(event.target.value as RemoveReasonCode)}>
                {REMOVE_REASONS.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            {reasonCode === 'other' ? (
              <label>
                说明
                <input value={note} onChange={(event) => setNote(event.target.value)} />
              </label>
            ) : null}
            <button
              type="button"
              className="btn-danger"
              data-testid="remove-patient"
              onClick={() => onRemove(reasonCode, note)}
            >
              移除该患者
            </button>
          </div>
          <p className="muted">不能添加患者。原始命中说明保留。</p>
        </div>
      ) : null}
    </div>
  )
}

export function MemberTable({
  state,
  patientIds,
  selectedId,
  onSelect,
  removedIds,
  trailing,
}: {
  state: AppState
  patientIds: string[]
  selectedId?: string
  onSelect: (patientId: string) => void
  removedIds?: string[]
  trailing?: (patientId: string) => ReactNode
}) {
  const removed = new Set(removedIds ?? [])
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>患者</th>
            <th>标识</th>
            <th>性别</th>
            <th>年龄</th>
            <th>状态</th>
            {trailing ? <th></th> : null}
          </tr>
        </thead>
        <tbody>
          {patientIds.map((patientId) => {
            const patient = patientById(state, patientId)
            return (
              <tr
                key={patientId}
                className={selectedId === patientId ? 'member-row is-selected' : 'member-row'}
                data-testid={`member-${patientId}`}
              >
                <td>
                  <button type="button" className="linkish" onClick={() => onSelect(patientId)}>
                    {patient?.name ?? patientId}
                  </button>
                </td>
                <td>{patientId}</td>
                <td>{patient?.sex ?? '—'}</td>
                <td>{patient?.age ?? '—'}</td>
                <td>
                  {removed.has(patientId) ? <StatusText>已移除</StatusText> : <StatusText>保留</StatusText>}
                </td>
                {trailing ? <td>{trailing(patientId)}</td> : null}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function buildTimeline(slots: EvidenceSlot[], current?: EvidenceSlot) {
  const items = [
    ...slots.map((slot) => ({
      key: `hit-${slot.role}-${slot.businessTime}-${slot.observationId ?? ''}`,
      businessTime: slot.businessTime,
      label: `触发 ${slot.role}`,
      value: slot.value,
    })),
  ]
  if (current) {
    items.push({
      key: `current-${current.businessTime}-${current.observationId ?? ''}`,
      businessTime: current.businessTime,
      label: '当前眼表评分',
      value: current.value,
    })
  }
  return items.sort((a, b) => (a.businessTime < b.businessTime ? -1 : 1))
}

function referencedBasicTags(state: AppState, tag: Tag): Tag[] {
  const ids = new Set<string>()
  walkTagRefs(tag.logic, ids)
  return [...ids]
    .map((id) => tagById(state, id))
    .filter((item): item is Tag => Boolean(item))
}

function otherAuthorizedHits(state: AppState, patientId: string, excludeTagId?: string): Tag[] {
  return state.tags.filter((tag) => {
    if (tag.id === excludeTagId) return false
    if (tag.status !== 'published') return false
    if (!isTagAuthorized(state, tag.id)) return false
    const result = evaluateTag(state, tag, state.clock, patientId)
    return result === 'satisfy'
  })
}

export function cohortConditionText(state: AppState, includeTagIds: string[], excludeTagIds: string[]): string {
  const include = includeTagIds.map((id) => tagDisplayName(state, id)).join(' 且 ') || '无'
  const exclude = excludeTagIds.map((id) => tagDisplayName(state, id)).join('、')
  return exclude ? `纳入 ${include}；排除命中任一 ${exclude}` : `纳入 ${include}`
}

export function PatientLink({
  patientId,
  name,
  from,
}: {
  patientId: string
  name: string
  from: string
}) {
  return <Link to={`/patients/${encodeURIComponent(patientId)}?from=${encodeURIComponent(from)}`}>{name}</Link>
}