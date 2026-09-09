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
import {
  Button,
  CheckRow,
  FormField,
  FormGrid,
  FormStack,
  FullSelect,
  Muted,
  NativeCheck,
  Notice,
  PageStack,
  Panel,
  Toolbar,
} from '../../ui/kit'
import { Input } from '@/components/ui/input'
import { NativeSelectOption } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
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
      <PageStack>
        {message ? <Toast message={message.text} tone={message.tone} /> : null}
        {!availability.available ? (
          <Notice tone="warn" role="status">
            标签不可用：{availability.reasons.join('；')}。不可用不能当作零命中。
          </Notice>
        ) : null}

        <Panel title="基本信息">
          <FormGrid>
            <FormField label="名称">
              <Input
                disabled={readOnly}
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              />
            </FormField>
            <FormField label="类型">
              <Input value={draft.type === 'basic' ? '基础' : '复合'} disabled />
            </FormField>
            <FormField label="分类">
              <FullSelect
                disabled={readOnly}
                value={draft.category}
                onChange={(event) => setDraft({ ...draft, category: event.target.value as TagCategory })}
              >
                {state.dictionaries.tagCategories.map((item) => (
                  <NativeSelectOption key={item} value={item}>
                    {item}
                  </NativeSelectOption>
                ))}
              </FullSelect>
            </FormField>
            <FormField label="责任组织">
              <FullSelect
                disabled={readOnly}
                value={draft.responsibleOrgId}
                onChange={(event) => setDraft({ ...draft, responsibleOrgId: event.target.value })}
              >
                {state.dictionaries.organizations.map((org) => (
                  <NativeSelectOption key={org.id} value={org.id}>
                    {org.name}
                  </NativeSelectOption>
                ))}
              </FullSelect>
            </FormField>
            <FormField label="处置建议（可选）" span2>
              <Textarea
                disabled={readOnly}
                maxLength={2000}
                value={draft.suggestion ?? ''}
                onChange={(event) => setDraft({ ...draft, suggestion: event.target.value })}
              />
            </FormField>
            <div className="flex items-center gap-2 text-sm">
              状态 <StatusText>{statusLabel(draft.status)}</StatusText>
            </div>
            <div className="text-muted-foreground text-sm">责任组织展示 {organizationName(state, draft.responsibleOrgId)}</div>
          </FormGrid>
        </Panel>

        <Panel title="规则" description={`当前摘要：${summarizeLogic(liveState, draft.logic)}`}>
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
        </Panel>

        <Panel title="试算" description="只展示命中人数和脱敏样例，不生成批次、不出现证据链。">
          {buttons.tagTrial ? (
            <Button type="button" onClick={runTrial}>
              试算
            </Button>
          ) : null}
          {trial ? (
            'unavailableReason' in trial ? (
              <Notice tone="warn" className="mt-3" data-testid="trial-unavailable">
                不可用：{trial.unavailableReason}
              </Notice>
            ) : (
              <div className="mt-3" data-testid="trial-result">
                <p>
                  命中人数 <strong data-testid="trial-count">{trial.hitPatientIds.length}</strong>
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  {trial.samples.map((sample) => (
                    <li key={sample.patientId}>
                      {sample.maskedName}（{sample.patientId}）
                    </li>
                  ))}
                </ul>
              </div>
            )
          ) : null}
        </Panel>

        <Panel title="自动识别">
          {draft.status !== 'published' ? <Muted>未发布不能开启。</Muted> : null}
          {!availability.available ? <Muted>仅对可用已发布标签可开启。本页不跑识别。</Muted> : null}
          {buttons.tagAutoRecognition && draft.status === 'published' && availability.available ? (
            <FormStack>
              <CheckRow>
                <NativeCheck
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
              </CheckRow>
              <FormField label="周期（天）">
                <Input
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
              </FormField>
            </FormStack>
          ) : (
            <p>{draft.autoRecognitionEnabled ? `开 · 每 ${draft.autoRecognitionIntervalDays} 天` : '关'}</p>
          )}
        </Panel>

        <Toolbar>
          {buttons.tagEdit && draft.status !== 'deleted' ? (
            <Button type="button" variant="outline" onClick={() => persist(draft.status === 'published' ? 'strict' : 'draft')}>
              {draft.status === 'published' ? '保存生效修改' : '保存草稿'}
            </Button>
          ) : null}
          {buttons.tagPublish && draft.status === 'draft' ? (
            <Button type="button" onClick={() => persist('strict')}>
              发布
            </Button>
          ) : null}
          {buttons.tagDisable && draft.status === 'published' ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                patch((current) =>
                  disableTag(upsertTag(current, { ...draft, updatedAt: current.clock, updatedBy: current.operatorId }), draft.id),
                )
                setDraft({ ...draft, status: 'manually_disabled' })
              }}
            >
              人工停用
            </Button>
          ) : null}
          {buttons.tagDisable && draft.status === 'manually_disabled' ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                patch((current) =>
                  restoreTag(upsertTag(current, { ...draft, updatedAt: current.clock, updatedBy: current.operatorId }), draft.id),
                )
                setDraft({ ...draft, status: 'published' })
              }}
            >
              恢复发布
            </Button>
          ) : null}
          {buttons.tagDelete && draft.status !== 'deleted' && draft.id ? (
            <Button type="button" variant="destructive" onClick={() => setConfirmDelete(true)}>
              删除
            </Button>
          ) : null}
        </Toolbar>
      </PageStack>

      {confirmDelete ? (
        <Modal title="确认删除标签" onClose={() => setConfirmDelete(false)}>
          <p>历史业务记录永久保留，稳定标识不复用。列表默认不再显示。</p>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>受影响复合规则：{impact.compositeTags.map((item) => item.name).join('、') || '无'}</li>
            <li>识别配置：{impact.recognition ? '已开启自动识别' : '无'}</li>
            <li>动态人群：{impact.dynamicCohorts.join('、') || '无'}</li>
            <li>订阅：{impact.subscriptions.join('、') || '无'}</li>
          </ul>
          <Toolbar>
            <Button
              type="button"
              variant="destructive"
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
            </Button>
            <Button type="button" variant="outline" onClick={() => setConfirmDelete(false)}>
              取消
            </Button>
          </Toolbar>
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
