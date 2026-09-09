import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ROUTES, cohortDetailPath, openNewPath, patientPath } from '../../app/routes'
import { formatDateTime } from '../../demo/clock'
import type { ComputeTimeRuleExplanation } from '../../domain/types'
import { includeExcludeAvailability, unauthorizedTagIds } from '../../engine/includeExclude'
import { useDemoStore } from '../../store/DemoStoreContext'
import {
  batchesOfCohort,
  currentDynamicMemberIds,
  patientById,
  publishedSelectableTags,
  subscriptionsOfCohort,
} from '../../store/selectors'
import { openStatus, openStatusLabel } from '../../store/open'
import {
  adjustSnapshotMembers,
  confirmSnapshotFromDynamic,
  refreshDynamicCohort,
  updateDynamicCohortConditions,
} from '../../store/store'
import { PageHeader } from '../../ui/PageHeader'
import { Modal, Toast } from '../../ui/Modal'
import { cohortConditionText } from '../patients/PatientEvidencePanel'

export function CohortDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { state, patch } = useDemoStore()
  const dynamic = state.dynamicCohorts.find((item) => item.id === id)
  const snapshot = state.snapshots.find((item) => item.id === id)
  const [toast, setToast] = useState<{ text: string; tone: 'error' | 'ok' } | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  if (!dynamic && !snapshot) {
    return (
      <section>
        <PageHeader title="人群详情" backTo={ROUTES.cohorts} backLabel="返回人群列表" />
        <p>未找到人群 {id}。</p>
      </section>
    )
  }

  if (dynamic) {
    const members = currentDynamicMemberIds(state, dynamic.id)
    const related = batchesOfCohort(state, dynamic.id)
    const subscriptions = subscriptionsOfCohort(state, dynamic.id)
    const authMissing = unauthorizedTagIds(state, [...dynamic.includeTagIds, ...dynamic.excludeTagIds])
    const availability = includeExcludeAvailability(state, dynamic.includeTagIds, dynamic.excludeTagIds)
    const canRefresh = state.session.permissions.buttons.cohortRefresh
    const canEdit = state.session.permissions.buttons.cohortEdit
    const canSnapshot = state.session.permissions.buttons.cohortSnapshot
    const canOpen = state.session.permissions.buttons.openCreate && authMissing.length === 0
    const from = `/cohorts/${dynamic.id}`

    function refresh() {
      const result = refreshDynamicCohort(state, dynamic!.id)
      if (!result.ok) {
        setToast({ text: result.reason, tone: 'error' })
        return
      }
      patch(() => result.state)
      setToast({ text: '已按当前条件刷新', tone: 'ok' })
    }

    return (
      <section>
        <PageHeader title={dynamic.name} backTo={ROUTES.cohorts} backLabel="返回人群列表" />
        {toast ? <Toast message={toast.text} tone={toast.tone} /> : null}
        <div className="panel">
          <dl className="dl">
            <dt>类型</dt>
            <dd>动态人群</dd>
            <dt>来源</dt>
            <dd>主动圈选</dd>
            <dt>纳入／排除</dt>
            <dd data-testid="cohort-conditions">{cohortConditionText(state, dynamic.includeTagIds, dynamic.excludeTagIds)}</dd>
            <dt>计算说明</dt>
            <dd>{explanationText(dynamic.lastSuccessfulRuleExplanation)}</dd>
            <dt>刷新时间</dt>
            <dd>
              {members === 'not_computed'
                ? '尚未计算'
                : dynamic.lastSuccessfulComputedAt
                  ? formatDateTime(dynamic.lastSuccessfulComputedAt)
                  : '—'}
            </dd>
          </dl>
          {!availability.ok ? (
            <div className="notice notice-warn" role="status">
              当前不能计算：{availability.reason}。不能当作 0 命中。
            </div>
          ) : null}
          <div className="toolbar-actions">
            {canRefresh ? (
              <button type="button" className="btn-primary" data-testid="refresh-cohort" onClick={refresh}>
                刷新
              </button>
            ) : null}
            {canSnapshot ? (
              <button
                type="button"
                className="btn-ghost"
                data-testid="confirm-from-dynamic"
                disabled={members === 'not_computed' || members.length === 0}
                onClick={() => setConfirmOpen(true)}
              >
                确认快照
              </button>
            ) : null}
            {canEdit ? (
              <button type="button" className="btn-ghost" onClick={() => setEditOpen(true)}>
                编辑条件
              </button>
            ) : null}
            {state.session.permissions.buttons.openCreate ? (
              canOpen ? (
                <Link
                  className="btn-ghost"
                  to={openNewPath({ type: 'tag_subscription', cohortId: dynamic.id })}
                  data-testid="open-subscribe"
                >
                  开放订阅
                </Link>
              ) : (
                <span className="muted">缺授权不能发起订阅</span>
              )
            ) : null}
          </div>
        </div>

        <div className="panel">
          <h3>成员</h3>
          {members === 'not_computed' ? (
            <p className="empty">尚未计算。条件已修改或尚无对应成功结果，不沿用旧条件成员。</p>
          ) : (
            <MemberLinks state={state} patientIds={members} from={from} />
          )}
        </div>

        <div className="panel">
          <h3>相关批次</h3>
          {related.length === 0 ? (
            <p className="empty">暂无相关批次。</p>
          ) : (
            <ul>
              {related.map((batch) => (
                <li key={batch.id}>
                  {batch.id} · {formatDateTime(batch.computedAt)} · {batch.ruleExplanation.logicSummary}
                </li>
              ))}
            </ul>
          )}
        </div>

        {editOpen ? (
          <EditConditionsModal
            state={state}
            includeTagIds={dynamic.includeTagIds}
            excludeTagIds={dynamic.excludeTagIds}
            name={dynamic.name}
            subscriptions={subscriptions.map((item) => ({
              id: item.id,
              name: item.name,
              status: openStatusLabel(openStatus(state, item)),
            }))}
            onClose={() => setEditOpen(false)}
            onSave={(next) => {
              const result = updateDynamicCohortConditions(state, dynamic.id, next)
              if (!result.ok) {
                setToast({ text: result.reason, tone: 'error' })
                return
              }
              patch(() => result.state)
              setEditOpen(false)
            }}
          />
        ) : null}

        {confirmOpen && members !== 'not_computed' ? (
          <AdjustMembersModal
            title="从动态人群确认快照"
            state={state}
            patientIds={members}
            onClose={() => setConfirmOpen(false)}
            onConfirm={(retained) => {
              const result = confirmSnapshotFromDynamic(state, dynamic.id, retained)
              if (!result.ok) {
                setToast({ text: result.reason, tone: 'error' })
                return
              }
              patch(() => result.state)
              setConfirmOpen(false)
              navigate(cohortDetailPath(result.snapshotId))
            }}
          />
        ) : null}
      </section>
    )
  }

  if (!snapshot) return null
  const from = `/cohorts/${snapshot.id}`
  const canAdjust = state.session.permissions.buttons.cohortSnapshot

  return (
    <section>
      <PageHeader title={snapshot.name} backTo={ROUTES.cohorts} backLabel="返回人群列表" />
      {toast ? <Toast message={toast.text} tone={toast.tone} /> : null}
      <div className="panel">
        <dl className="dl">
          <dt>类型</dt>
          <dd>人群快照</dd>
          <dt>来源</dt>
          <dd>
            {snapshot.sourceType === 'recognition'
              ? '识别确认'
              : snapshot.sourceType === 'from_snapshot'
                ? `由快照 ${snapshot.sourceSnapshotId ?? ''} 调整`
                : '主动圈选'}
          </dd>
          <dt>计算说明</dt>
          <dd data-testid="snapshot-explanation">{explanationText(snapshot.ruleExplanation)}</dd>
          <dt>确认时间</dt>
          <dd>{formatDateTime(snapshot.confirmedAt)}</dd>
          <dt>计算时点</dt>
          <dd>{formatDateTime(snapshot.computedAt)}</dd>
          <dt>人数</dt>
          <dd>{snapshot.members.length}</dd>
        </dl>
        <div className="toolbar-actions">
          {canAdjust ? (
            <button type="button" className="btn-ghost" data-testid="adjust-snapshot" onClick={() => setAdjustOpen(true)}>
              调整成员
            </button>
          ) : null}
          {state.session.permissions.buttons.openCreate ? (
            <Link
              className="btn-ghost"
              to={openNewPath({ type: 'dataset_delivery', snapshotId: snapshot.id })}
              data-testid="export-snapshot"
            >
              导出
            </Link>
          ) : null}
        </div>
      </div>
      <div className="panel">
        <h3>成员</h3>
        <MemberLinks
          state={state}
          patientIds={snapshot.members.map((item) => item.patientId)}
          from={from}
        />
      </div>
      {adjustOpen ? (
        <AdjustMembersModal
          title="从快照调整成员"
          state={state}
          patientIds={snapshot.members.map((item) => item.patientId)}
          onClose={() => setAdjustOpen(false)}
          onConfirm={(retained) => {
            const result = adjustSnapshotMembers(state, snapshot.id, retained)
            if (!result.ok) {
              setToast({ text: result.reason, tone: 'error' })
              return
            }
            patch(() => result.state)
            setAdjustOpen(false)
            navigate(cohortDetailPath(result.snapshotId))
          }}
        />
      ) : null}
    </section>
  )
}

function explanationText(explanation?: ComputeTimeRuleExplanation): string {
  if (!explanation) return '—'
  if (explanation.sourceType === 'cohort_include_exclude') {
    return explanation.logicSummary
  }
  return explanation.logicSummary
}

function MemberLinks({
  state,
  patientIds,
  from,
}: {
  state: ReturnType<typeof useDemoStore>['state']
  patientIds: string[]
  from: string
}) {
  if (patientIds.length === 0) return <p className="empty">0 人。</p>
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>患者</th>
            <th>标识</th>
            <th>性别</th>
            <th>年龄</th>
          </tr>
        </thead>
        <tbody>
          {patientIds.map((patientId) => {
            const patient = patientById(state, patientId)
            return (
              <tr key={patientId}>
                <td>
                  <Link to={patientPath(patientId, from)}>{patient?.name ?? patientId}</Link>
                </td>
                <td>{patientId}</td>
                <td>{patient?.sex ?? '—'}</td>
                <td>{patient?.age ?? '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function EditConditionsModal({
  state,
  includeTagIds,
  excludeTagIds,
  name,
  subscriptions,
  onClose,
  onSave,
}: {
  state: ReturnType<typeof useDemoStore>['state']
  includeTagIds: string[]
  excludeTagIds: string[]
  name: string
  subscriptions: Array<{ id: string; name: string; status: string }>
  onClose: () => void
  onSave: (input: { name: string; includeTagIds: string[]; excludeTagIds: string[] }) => void
}) {
  const published = publishedSelectableTags(state)
  const [nextName, setNextName] = useState(name)
  const [include, setInclude] = useState(includeTagIds)
  const [exclude, setExclude] = useState(excludeTagIds)

  function toggle(list: string[], id: string, set: (next: string[]) => void) {
    set(list.includes(id) ? list.filter((item) => item !== id) : [...list, id])
  }

  return (
    <Modal title="编辑动态条件" onClose={onClose}>
      <p className="muted">保存后不重审、不改写旧结果，下一次计算使用新条件。</p>
      <div className="form-stack">
        <label>
          名称
          <input value={nextName} onChange={(event) => setNextName(event.target.value)} />
        </label>
      </div>
      <h4>关联订阅</h4>
      {subscriptions.length === 0 ? (
        <p className="empty">无关联订阅。</p>
      ) : (
        <ul>
          {subscriptions.map((item) => (
            <li key={item.id}>
              {item.name} · {item.status}。修改条件会影响后续订阅计算，已发出结果不改写。
            </li>
          ))}
        </ul>
      )}
      <div className="split">
        <div>
          <h4>纳入</h4>
          {published.map((tag) => (
            <label key={tag.id} className="check-row">
              <input
                type="checkbox"
                checked={include.includes(tag.id)}
                onChange={() => toggle(include, tag.id, setInclude)}
              />
              {tag.name}
            </label>
          ))}
        </div>
        <div>
          <h4>排除</h4>
          {published.map((tag) => (
            <label key={tag.id} className="check-row">
              <input
                type="checkbox"
                checked={exclude.includes(tag.id)}
                onChange={() => toggle(exclude, tag.id, setExclude)}
              />
              {tag.name}
            </label>
          ))}
        </div>
      </div>
      <div className="toolbar-actions">
        <button type="button" className="btn-primary" onClick={() => onSave({ name: nextName, includeTagIds: include, excludeTagIds: exclude })}>
          保存条件
        </button>
        <button type="button" className="btn-ghost" onClick={onClose}>
          取消
        </button>
      </div>
    </Modal>
  )
}

function AdjustMembersModal({
  title,
  state,
  patientIds,
  onClose,
  onConfirm,
}: {
  title: string
  state: ReturnType<typeof useDemoStore>['state']
  patientIds: string[]
  onClose: () => void
  onConfirm: (retained: string[]) => void
}) {
  const [removed, setRemoved] = useState<string[]>([])
  const retained = patientIds.filter((id) => !removed.includes(id))
  return (
    <Modal title={title} onClose={onClose}>
      <p className="muted">移除只影响本次待确认名单，不写回动态条件或原快照。</p>
      <ul>
        {patientIds.map((patientId) => {
          const patient = patientById(state, patientId)
          const isRemoved = removed.includes(patientId)
          return (
            <li key={patientId}>
              {patient?.name ?? patientId}
              {isRemoved ? (
                '（已移除）'
              ) : (
                <button type="button" className="btn-ghost" onClick={() => setRemoved((current) => [...current, patientId])}>
                  移除
                </button>
              )}
            </li>
          )
        })}
      </ul>
      <div className="toolbar-actions">
        <button
          type="button"
          className="btn-primary"
          disabled={retained.length === 0}
          onClick={() => onConfirm(retained)}
        >
          确认生成快照
        </button>
        {retained.length === 0 ? <span className="muted">零人不生成</span> : null}
        <button type="button" className="btn-ghost" onClick={onClose}>
          取消
        </button>
      </div>
    </Modal>
  )
}