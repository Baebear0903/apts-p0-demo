import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ROUTES, tagDetailPath } from '../../app/routes'
import { DEMO_OPERATOR_ID, ORG_INFO_ID } from '../../domain/ids'
import { summarizeLogic } from '../../domain/logicSummary'
import type { Tag, TagCategory, TagType } from '../../domain/types'
import { tagAvailability, tagImpact } from '../../engine/availability'
import { trialCompute, type TrialResult } from '../../engine/evaluate'
import { createEmptyLogic } from '../../engine/logicTree'
import { useDemoStore } from '../../store/DemoStoreContext'
import { organizationName, tagById } from '../../store/selectors'
import {
  allocateTagId,
  cloneState,
  deleteTag,
  disableTag,
  restoreTag,
  saveTag,
  setTagAutoRecognition,
  upsertTag,
} from '../../store/store'
import { PageHeader, StatusText } from '../../ui/PageHeader'
import { Modal, Toast } from '../../ui/Modal'
import { RuleEditor } from './RuleEditor'

export function TagDetailPage() {
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { state, patch } = useDemoStore()
  const isNew = location.pathname === ROUTES.tagNew || id === 'new'
  const existing = isNew ? undefined : tagById(state, id)
  const newType: TagType = params.get('type') === 'composite' ? 'composite' : 'basic'

  const [draft, setDraft] = useState<Tag>(() => existing ?? emptyTag(newType, state.clock))
  const [selectedId, setSelectedId] = useState(draft.logic.id)
  const [message, setMessage] = useState<{ text: string; tone: 'error' | 'ok' } | null>(null)
  const [trial, setTrial] = useState<TrialResult | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (existing) {
      const cloned = cloneState(existing)
      setDraft(cloned)
      setSelectedId(cloned.logic.id)
      setTrial(null)
    }
  }, [existing?.id, existing?.updatedAt])

  const buttons = state.session.permissions.buttons
  const availability = tagAvailability({ ...state, tags: upsertLocal(state.tags, draft) }, draft)
  const readOnly = draft.status === 'deleted' || !buttons.tagEdit
  const impact = tagImpact(state, draft.id)

  const liveState = useMemo(() => {
    const tags = draft.id ? state.tags.map((item) => (item.id === draft.id ? draft : item)) : [...state.tags, draft]
    return { ...state, tags }
  }, [state, draft])

  if (!isNew && !existing) {
    return (
      <section>
        <PageHeader title="标签详情" backTo={ROUTES.tags} />
        <p>未找到标签 {id}。</p>
      </section>
    )
  }

  function persist(mode: 'draft' | 'strict') {
    let toSave = draft
    if (!toSave.id) {
      toSave = { ...toSave, id: allocateTagId(state), createdAt: state.clock, createdBy: state.operatorId }
    }
    const result = saveTag(state, toSave, mode)
    if (!result.ok) {
      setMessage({ text: result.errors.join('；'), tone: 'error' })
      return
    }
    patch(() => result.state)
    setDraft(toSave.id === draft.id ? { ...toSave, status: mode === 'strict' && toSave.status === 'draft' ? 'published' : toSave.status, updatedAt: state.clock } : toSave)
    setMessage({ text: mode === 'strict' ? '已保存并作为后续计算当前逻辑' : '草稿已保存', tone: 'ok' })
    if (isNew) navigate(tagDetailPath(toSave.id))
  }

  function runTrial() {
    const tagId = draft.id || 'TAG-DRAFT-TRIAL'
    const prepared = {
      ...state,
      tags: draft.id
        ? state.tags.map((item) => (item.id === draft.id ? draft : item))
        : [...state.tags, { ...draft, id: tagId }],
    }
    setTrial(trialCompute(prepared, tagId))
  }

  return (
    <section>
      <PageHeader
        title={draft.name || (isNew ? '新建标签' : draft.id)}
        description={`稳定标识 ${draft.id || '保存后生成'} · 类型创建后不可改`}
        backTo={ROUTES.tags}
      />
      {message ? <Toast message={message.text} tone={message.tone} /> : null}
      {!availability.available ? (
        <div className="notice notice-warn" role="status">
          标签不可用：{availability.reasons.join('；')}。不可用不能当作零命中。
        </div>
      ) : null}

      <div className="panel">
        <h3>基本信息</h3>
        <div className="form-grid">
          <label>
            名称
            <input
              disabled={readOnly}
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
          </label>
          <label>
            类型
            <input value={draft.type === 'basic' ? '基础' : '复合'} disabled />
          </label>
          <label>
            分类
            <select
              disabled={readOnly}
              value={draft.category}
              onChange={(event) => setDraft({ ...draft, category: event.target.value as TagCategory })}
            >
              {state.dictionaries.tagCategories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label>
            责任组织
            <select
              disabled={readOnly}
              value={draft.responsibleOrgId}
              onChange={(event) => setDraft({ ...draft, responsibleOrgId: event.target.value })}
            >
              {state.dictionaries.organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </label>
          <label className="span-2">
            处置建议（可选）
            <textarea
              disabled={readOnly}
              maxLength={2000}
              value={draft.suggestion ?? ''}
              onChange={(event) => setDraft({ ...draft, suggestion: event.target.value })}
            />
          </label>
          <div>
            状态 <StatusText>{statusLabel(draft.status)}</StatusText>
          </div>
          <div>责任组织展示 {organizationName(state, draft.responsibleOrgId)}</div>
        </div>
      </div>

      <div className="panel">
        <h3>规则</h3>
        <p className="muted">当前摘要：{summarizeLogic(liveState, draft.logic)}</p>
        <RuleEditor
          state={liveState}
          logic={draft.logic}
          tagType={draft.type}
          readOnly={readOnly}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onChange={(logic) => {
            setDraft({ ...draft, logic })
            setTrial(null)
          }}
        />
      </div>

      <div className="panel">
        <h3>试算</h3>
        <p className="muted">只展示命中人数和脱敏样例，不生成批次、不出现证据链。</p>
        {buttons.tagTrial ? (
          <button type="button" className="btn-primary" onClick={runTrial}>
            试算
          </button>
        ) : null}
        {trial ? (
          'unavailableReason' in trial ? (
            <p data-testid="trial-unavailable" className="notice notice-warn">
              不可用：{trial.unavailableReason}
            </p>
          ) : (
            <div data-testid="trial-result">
              <p>
                命中人数 <strong data-testid="trial-count">{trial.hitPatientIds.length}</strong>
              </p>
              <ul>
                {trial.samples.map((sample) => (
                  <li key={sample.patientId}>
                    {sample.maskedName}（{sample.patientId}）
                  </li>
                ))}
              </ul>
            </div>
          )
        ) : null}
      </div>

      <div className="panel">
        <h3>自动识别</h3>
        {draft.status !== 'published' ? <p className="muted">未发布不能开启。</p> : null}
        {!availability.available ? <p className="muted">仅对可用已发布标签可开启。本页不跑识别。</p> : null}
        {buttons.tagAutoRecognition && draft.status === 'published' && availability.available ? (
          <div className="form-stack">
            <label>
              <input
                type="checkbox"
                checked={draft.autoRecognitionEnabled}
                onChange={(event) => {
                  const enabled = event.target.checked
                  const interval = draft.autoRecognitionIntervalDays ?? 7
                  const next = { ...draft, autoRecognitionEnabled: enabled, autoRecognitionIntervalDays: interval }
                  setDraft(next)
                  if (draft.id) {
                    patch((current) => {
                      const written = upsertTag(current, { ...next, updatedAt: current.clock, updatedBy: current.operatorId })
                      const result = setTagAutoRecognition(written, next.id, enabled, interval)
                      return result.ok ? result.state : written
                    })
                  }
                }}
              />
              开启自动识别
            </label>
            <label>
              周期（天）
              <input
                type="number"
                min={1}
                value={draft.autoRecognitionIntervalDays ?? 7}
                onChange={(event) => {
                  const interval = Number(event.target.value)
                  setDraft({ ...draft, autoRecognitionIntervalDays: interval })
                  if (draft.id && draft.autoRecognitionEnabled) {
                    const next = { ...draft, autoRecognitionIntervalDays: interval }
                    patch((current) => {
                      const written = upsertTag(current, { ...next, updatedAt: current.clock, updatedBy: current.operatorId })
                      const result = setTagAutoRecognition(written, next.id, true, interval)
                      return result.ok ? result.state : written
                    })
                  }
                }}
              />
            </label>
          </div>
        ) : (
          <p>
            {draft.autoRecognitionEnabled ? `开 · 每 ${draft.autoRecognitionIntervalDays} 天` : '关'}
          </p>
        )}
      </div>

      <div className="toolbar-actions">
        {buttons.tagEdit && draft.status !== 'deleted' ? (
          <button type="button" className="btn-ghost" onClick={() => persist(draft.status === 'published' ? 'strict' : 'draft')}>
            {draft.status === 'published' ? '保存生效修改' : '保存草稿'}
          </button>
        ) : null}
        {buttons.tagPublish && draft.status === 'draft' ? (
          <button type="button" className="btn-primary" onClick={() => persist('strict')}>
            发布
          </button>
        ) : null}
        {buttons.tagDisable && draft.status === 'published' ? (
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              patch((current) =>
                disableTag(upsertTag(current, { ...draft, updatedAt: current.clock, updatedBy: current.operatorId }), draft.id),
              )
              setDraft({ ...draft, status: 'manually_disabled' })
            }}
          >
            人工停用
          </button>
        ) : null}
        {buttons.tagDisable && draft.status === 'manually_disabled' ? (
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              patch((current) =>
                restoreTag(upsertTag(current, { ...draft, updatedAt: current.clock, updatedBy: current.operatorId }), draft.id),
              )
              setDraft({ ...draft, status: 'published' })
            }}
          >
            恢复发布
          </button>
        ) : null}
        {buttons.tagDelete && draft.status !== 'deleted' && draft.id ? (
          <button type="button" className="btn-danger" onClick={() => setConfirmDelete(true)}>
            删除
          </button>
        ) : null}
      </div>

      {confirmDelete ? (
        <Modal title="确认删除标签" onClose={() => setConfirmDelete(false)}>
          <p>历史业务记录永久保留，稳定标识不复用。列表默认不再显示。</p>
          <ul>
            <li>受影响复合规则：{impact.compositeTags.map((item) => item.name).join('、') || '无'}</li>
            <li>识别配置：{impact.recognition ? '已开启自动识别' : '无'}</li>
            <li>动态人群：{impact.dynamicCohorts.join('、') || '无'}</li>
            <li>订阅：{impact.subscriptions.join('、') || '无'}</li>
          </ul>
          <div className="toolbar-actions">
            <button
              type="button"
              className="btn-danger"
              onClick={() => {
                const result = deleteTag(state, draft.id)
                if (!result.ok) {
                  setMessage({ text: result.reason, tone: 'error' })
                  setConfirmDelete(false)
                  return
                }
                patch(() => result.state)
                setConfirmDelete(false)
                navigate(ROUTES.tags)
              }}
            >
              确认删除
            </button>
            <button type="button" className="btn-ghost" onClick={() => setConfirmDelete(false)}>
              取消
            </button>
          </div>
        </Modal>
      ) : null}
    </section>
  )
}

function emptyTag(type: TagType, clock: string): Tag {
  return {
    id: '',
    name: '',
    type,
    category: type === 'composite' ? '组合筛选' : '评估结果',
    status: 'draft',
    responsibleOrgId: ORG_INFO_ID,
    autoRecognitionEnabled: false,
    logic: createEmptyLogic(),
    createdBy: DEMO_OPERATOR_ID,
    createdAt: clock,
    updatedBy: DEMO_OPERATOR_ID,
    updatedAt: clock,
  }
}

function upsertLocal(tags: Tag[], draft: Tag): Tag[] {
  if (!draft.id) return [...tags, draft]
  if (tags.some((item) => item.id === draft.id)) {
    return tags.map((item) => (item.id === draft.id ? draft : item))
  }
  return [...tags, draft]
}

function statusLabel(status: string): string {
  if (status === 'published') return '已发布'
  if (status === 'draft') return '草稿'
  if (status === 'manually_disabled') return '人工停用'
  if (status === 'deleted') return '已删除'
  return status
}
