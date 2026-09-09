import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ROUTES, cohortDetailPath, openDetailPath } from '../../app/routes'
import type { OpenConfigType } from '../../domain/types'
import { unauthorizedTagIds } from '../../engine/includeExclude'
import { useDemoStore } from '../../store/DemoStoreContext'
import { enableOpenConfig, saveOpenConfig } from '../../store/store'
import { PageHeader } from '../../ui/PageHeader'
import { Toast } from '../../ui/Modal'
import { OpenConfigForm, emptyOpenForm, inputFromForm, type OpenFormValue } from './OpenConfigForm'

export function OpenNewPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { state, patch } = useDemoStore()
  const typeParam = params.get('type')
  const cohortId = params.get('cohortId') ?? ''
  const snapshotId = params.get('snapshotId') ?? ''
  const type: OpenConfigType = typeParam === 'tag_subscription' ? 'tag_subscription' : 'dataset_delivery'
  const cohort = cohortId ? state.dynamicCohorts.find((item) => item.id === cohortId) : undefined
  const snapshot = snapshotId ? state.snapshots.find((item) => item.id === snapshotId) : undefined
  const missing = cohort ? unauthorizedTagIds(state, [...cohort.includeTagIds, ...cohort.excludeTagIds]) : []
  const prefillSubscription = typeParam === 'tag_subscription' && Boolean(cohortId)
  const prefillDataset = typeParam === 'dataset_delivery' && Boolean(snapshotId)
  const blockedPrefill = prefillSubscription && missing.length > 0

  const initial = useMemo<OpenFormValue>(() => {
    const base = emptyOpenForm(state, {
      type,
      method: type === 'tag_subscription' ? 'on_demand_query' : 'direct_export',
      boundDynamicCohortId: cohort?.id ?? '',
      boundSnapshotId: snapshot?.id ?? '',
      name: cohort ? `${cohort.name}标签订阅` : snapshot ? `${snapshot.name}直接导出` : '',
    })
    return base
  }, [state.clock, type, cohort?.id, snapshot?.id])

  const [form, setForm] = useState<OpenFormValue>(initial)
  const [toast, setToast] = useState<{ text: string; tone: 'error' | 'ok' } | null>(null)
  const canCreate = state.session.permissions.buttons.openCreate
  const canEnable = state.session.permissions.buttons.openEnable

  function persist(enable: boolean) {
    const saved = saveOpenConfig(state, inputFromForm(form))
    if (!saved.ok) {
      setToast({ text: saved.reason, tone: 'error' })
      return
    }
    if (!enable) {
      patch(() => saved.state)
      navigate(openDetailPath(saved.id))
      return
    }
    const enabled = enableOpenConfig(saved.state, saved.id)
    if (!enabled.ok) {
      patch(() => saved.state)
      setToast({ text: enabled.reason, tone: 'error' })
      navigate(openDetailPath(saved.id))
      return
    }
    patch(() => enabled.state)
    navigate(openDetailPath(saved.id))
  }

  return (
    <section>
      <PageHeader title="新建开放配置" backTo={ROUTES.open} backLabel="返回开放列表" />
      {toast ? <Toast message={toast.text} tone={toast.tone} /> : null}
      {blockedPrefill ? (
        <div className="panel" data-testid="open-prefill">
          <p className="notice notice-warn">缺授权不能发起。缺少：{missing.join('、')}</p>
        </div>
      ) : (
        <div className="panel" data-testid={prefillSubscription ? 'open-prefill' : undefined}>
          {prefillSubscription && cohort ? (
            <p>
              将新建标签订阅并预填动态人群「{cohort.name}」（{cohort.id}）。
            </p>
          ) : null}
          {prefillDataset && snapshot ? (
            <p>
              将新建数据集直接导出并预填快照「{snapshot.name}」（{snapshot.id}）。
            </p>
          ) : null}
          {prefillSubscription && !cohort ? <p>未找到动态人群 {cohortId}。</p> : null}
          {prefillDataset && !snapshot ? <p>未找到快照 {snapshotId}。</p> : null}
          {type === 'dataset_delivery' && state.snapshots.length === 0 ? (
            <p className="notice">
              暂无已确认快照。请先<Link to={ROUTES.cohorts}>在人群管理确认快照</Link>。
            </p>
          ) : null}
          {type === 'tag_subscription' && state.dynamicCohorts.length === 0 ? (
            <p className="notice">
              暂无动态人群。请先<Link to={ROUTES.cohortNew}>创建动态人群</Link>。
            </p>
          ) : null}
          <OpenConfigForm
            state={state}
            value={form}
            onChange={setForm}
            locked={false}
            typeLocked={prefillSubscription || prefillDataset}
            objectLocked={prefillSubscription || prefillDataset}
          />
          <div className="toolbar-actions">
            {canCreate ? (
              <button type="button" className="btn-ghost" data-testid="save-open-draft" onClick={() => persist(false)}>
                保存草稿
              </button>
            ) : null}
            {canCreate && canEnable ? (
              <button type="button" className="btn-primary" data-testid="enable-open" onClick={() => persist(true)}>
                启用
              </button>
            ) : null}
            {cohort ? (
              <Link className="btn-ghost" to={cohortDetailPath(cohort.id)}>
                返回动态人群
              </Link>
            ) : null}
          </div>
        </div>
      )}
    </section>
  )
}
