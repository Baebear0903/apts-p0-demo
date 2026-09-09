import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ROUTES } from '../../app/routes'
import { formatDateTime } from '../../demo/clock'
import { DEMO_OPERATOR_NAME } from '../../domain/ids'
import { useDemoStore } from '../../store/DemoStoreContext'
import { triggerCsvDownload } from '../../store/csv'
import {
  displayOpenName,
  methodLabel,
  openRuntime,
  openStatusLabel,
  openTypeLabel,
} from '../../store/open'
import { organizationName } from '../../store/selectors'
import {
  advanceToNextPush,
  downloadOpenCsv,
  enableOpenConfig,
  pauseOpenConfig,
  queryOpenConfig,
  resumeOpenConfig,
  saveOpenConfig,
  simulateChannelDelivery,
  simulateOpenExpiry,
} from '../../store/store'
import { PageHeader, PhoneNote, StatusText } from '../../ui/PageHeader'
import { Toast } from '../../ui/Modal'
import { OpenConfigForm, formFromConfig, inputFromForm, type OpenFormValue } from './OpenConfigForm'

export function OpenDetailPage() {
  const { id = '' } = useParams()
  const { state, patch } = useDemoStore()
  const config = state.openConfigs.find((item) => item.id === id)
  const [form, setForm] = useState<OpenFormValue | null>(config ? formFromConfig(state, config) : null)
  const [toast, setToast] = useState<{ text: string; tone: 'error' | 'ok' } | null>(null)

  useEffect(() => {
    if (config) setForm(formFromConfig(state, config))
  }, [config?.id, config?.updatedAt, state.clock])

  if (!config || !form) {
    return (
      <section>
        <PageHeader title="开放配置详情" backTo={ROUTES.open} backLabel="返回开放列表" />
        <p>未找到开放配置 {id}。</p>
      </section>
    )
  }

  const current = config
  const currentForm = form
  const runtime = openRuntime(state, current)
  const locked = Boolean(current.enabledAt)
  const buttons = state.session.permissions.buttons
  const snapshot = current.boundSnapshotId ? state.snapshots.find((item) => item.id === current.boundSnapshotId) : undefined
  const cohort = current.boundDynamicCohortId
    ? state.dynamicCohorts.find((item) => item.id === current.boundDynamicCohortId)
    : undefined
  const system = current.systemId ? state.connectedSystems.find((item) => item.id === current.systemId) : undefined
  const canDownload =
    current.type === 'dataset_delivery' &&
    current.method === 'direct_export' &&
    buttons.openExport &&
    !runtime.blocked
  const canQuery = current.type === 'tag_subscription' && current.method === 'on_demand_query' && !runtime.blocked
  const canPush = current.type === 'tag_subscription' && current.method === 'scheduled_full_push' && !runtime.blocked
  const canChannel = current.type === 'dataset_delivery' && current.method === 'snapshot_channel' && !runtime.blocked

  function apply(nextState: typeof state) {
    patch(() => nextState)
  }

  function save(enable = false) {
    const saved = saveOpenConfig(state, inputFromForm(currentForm, current.id))
    if (!saved.ok) {
      setToast({ text: saved.reason, tone: 'error' })
      return
    }
    if (!enable) {
      apply(saved.state)
      setToast({ text: '已保存', tone: 'ok' })
      return
    }
    const enabled = enableOpenConfig(saved.state, current.id)
    if (!enabled.ok) {
      apply(saved.state)
      setToast({ text: enabled.reason, tone: 'error' })
      return
    }
    apply(enabled.state)
    setToast({ text: '已启用。授权已启用不表示对方已收到。', tone: 'ok' })
  }

  function run<T extends { ok: true; state: typeof state } | { ok: false; reason: string }>(
    result: T,
    okText: string,
  ) {
    if (!result.ok) {
      setToast({ text: result.reason, tone: 'error' })
      return
    }
    apply(result.state)
    setToast({ text: okText, tone: 'ok' })
  }

  function download() {
    const result = downloadOpenCsv(state, current.id)
    if (!result.ok) {
      setToast({ text: result.reason, tone: 'error' })
      return
    }
    apply(result.state)
    triggerCsvDownload(`${displayOpenName(current)}.csv`, result.csv)
    setToast({ text: '已下载固定 CSV', tone: 'ok' })
  }

  return (
    <section>
      <PageHeader title={displayOpenName(current)} backTo={ROUTES.open} backLabel="返回开放列表" />
      {toast ? <Toast message={toast.text} tone={toast.tone} /> : null}
      <div className="panel">
        <dl className="dl">
          <dt>状态</dt>
          <dd data-testid="open-status">
            <StatusText>{openStatusLabel(runtime.status)}</StatusText>
            {runtime.status === 'enabled' ? (
              <span className="muted" data-testid="open-status-note">
                {' '}
                不表示对方已查询、接收或使用数据
              </span>
            ) : null}
            {runtime.statusNote ? <div className="muted">{runtime.statusNote}</div> : null}
          </dd>
          <dt>类型</dt>
          <dd>{openTypeLabel(config.type)}</dd>
          <dt>方式</dt>
          <dd>{methodLabel(config.method)}</dd>
          <dt>使用方</dt>
          <dd>{config.consumer || '—'}</dd>
          <dt>已对接系统</dt>
          <dd>{system ? `${system.name}（${system.code}）` : '—'}</dd>
          <dt>绑定对象</dt>
          <dd>
            {snapshot ? `快照 ${snapshot.name}（${snapshot.id}）` : null}
            {cohort ? `动态人群 ${cohort.name}（${cohort.id}）` : null}
            {!snapshot && !cohort ? '—' : null}
          </dd>
          <dt>责任组织</dt>
          <dd>{organizationName(state, config.responsibleOrgId)}</dd>
          <dt>患者范围</dt>
          <dd>{state.patientScope.name}</dd>
          <dt>有效期</dt>
          <dd>{config.validUntil ? formatDateTime(config.validUntil) : '长期有效'}</dd>
          <dt>启用时间</dt>
          <dd>{config.enabledAt ? formatDateTime(config.enabledAt) : '—'}</dd>
          <dt>创建</dt>
          <dd>
            {DEMO_OPERATOR_NAME} · {formatDateTime(config.createdAt)}
          </dd>
          <dt>最近经办</dt>
          <dd>
            {DEMO_OPERATOR_NAME} · {formatDateTime(config.updatedAt)}
          </dd>
        </dl>
        {runtime.displayReasons.length > 0 ? (
          <div className="notice notice-warn" role="status" data-testid="open-reasons">
            {runtime.displayReasons.join('；')}
          </div>
        ) : null}
      </div>

      <div className="panel">
        <h3>配置</h3>
        <OpenConfigForm state={state} value={form} onChange={setForm} locked={locked} />
        <div className="toolbar-actions">
          {buttons.openEdit ? (
            <button type="button" className="btn-ghost" data-testid="save-open" onClick={() => save(false)}>
              保存
            </button>
          ) : null}
          {buttons.openEnable && runtime.status === 'draft' ? (
            <button type="button" className="btn-primary" data-testid="enable-open" onClick={() => save(true)}>
              启用
            </button>
          ) : null}
          {buttons.openPause && runtime.status === 'enabled' ? (
            <button
              type="button"
              className="btn-ghost"
              data-testid="pause-open"
              onClick={() => run(pauseOpenConfig(state, current.id), '已暂停，立即停止下载／查询／推送')}
            >
              暂停
            </button>
          ) : null}
          {buttons.openResume && (runtime.status === 'paused' || runtime.status === 'expired') ? (
            <button
              type="button"
              className="btn-primary"
              data-testid="resume-open"
              onClick={() => run(resumeOpenConfig(state, current.id), '已恢复')}
            >
              恢复
            </button>
          ) : null}
          {config.method === 'direct_export' ? (
            buttons.openExport ? (
              <button
                type="button"
                className="btn-primary"
                data-testid="download-csv"
                disabled={!canDownload}
                onClick={download}
              >
                下载 CSV
              </button>
            ) : null
          ) : null}
          {!canDownload && config.method === 'direct_export' ? (
            <span className="muted">草稿／暂停／到期或依赖不可用时不可下载，不会生成文件。</span>
          ) : null}
        </div>
        {config.method === 'direct_export' ? <PhoneNote /> : null}
      </div>

      {config.type === 'tag_subscription' ? (
        <div className="panel" data-testid="subscription-result">
          <h3>最近计算结果</h3>
          <p className="muted">外发仅含主患者标识、结果版本、计算完成时间。不宣称真实发送。</p>
          {config.lastResult ? (
            <>
              <dl className="dl">
                <dt>结果版本</dt>
                <dd data-testid="result-version">{config.lastResult.resultVersion}</dd>
                <dt>计算完成时间</dt>
                <dd data-testid="result-computed-at">{formatDateTime(config.lastResult.computedAt)}</dd>
                <dt>人数</dt>
                <dd>{config.lastResult.patientIds.length}</dd>
              </dl>
              {config.lastResult.patientIds.length === 0 ? (
                <p className="empty">成功零人，版本与完成时间仍有效。</p>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>主患者标识</th>
                        <th>结果版本</th>
                        <th>计算完成时间</th>
                      </tr>
                    </thead>
                    <tbody>
                      {config.lastResult.patientIds.map((patientId) => (
                        <tr key={patientId}>
                          <td>{patientId}</td>
                          <td>{config.lastResult?.resultVersion}</td>
                          <td>{formatDateTime(config.lastResult!.computedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            <p className="empty">尚无成功结果。</p>
          )}
        </div>
      ) : null}

      <div className="panel">
        <h3>固定交付记录</h3>
        {(config.deliveryRecords ?? []).length === 0 ? (
          <p className="empty">尚无交付记录。启用本身不表示交付已发生。</p>
        ) : (
          <ul>
            {(config.deliveryRecords ?? []).map((record) => (
              <li key={record.id}>
                {formatDateTime(record.at)} · {DEMO_OPERATOR_NAME} · {deliveryKindLabel(record.kind)}
                {record.reused ? ' · 复用最近成功' : ''}
                {record.resultVersion ? ` · ${record.resultVersion}` : ''}
                {record.computedAt ? ` · 计算 ${formatDateTime(record.computedAt)}` : ''}
                {record.patientCount != null ? ` · ${record.patientCount} 人` : ''}
                {` · 使用方 ${config.consumer || '—'} · 用途 ${config.purpose || '—'}`}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="panel" data-testid="open-demo-actions">
        <h3>演示操作</h3>
        <p className="muted">生成可检查的患者标识、结果版本与计算完成时间，不宣称真实发送。</p>
        <div className="toolbar-actions">
          {canQuery ? (
            <button
              type="button"
              className="btn-ghost"
              data-testid="simulate-query"
              onClick={() => {
                const result = queryOpenConfig(state, current.id)
                if (!result.ok) {
                  setToast({ text: result.reason, tone: 'error' })
                  return
                }
                apply(result.state)
                setToast({
                  text: result.reused
                    ? `复用最近成功，原计算时间 ${formatDateTime(result.computedAt)}`
                    : `查询完成 ${result.resultVersion}，${result.patientIds.length} 人`,
                  tone: 'ok',
                })
              }}
            >
              模拟查询
            </button>
          ) : null}
          {canPush ? (
            <button
              type="button"
              className="btn-ghost"
              data-testid="advance-push"
              onClick={() => {
                const result = advanceToNextPush(state, current.id)
                if (!result.ok) {
                  setToast({ text: result.reason, tone: 'error' })
                  return
                }
                apply(result.state)
                setToast({
                  text: `已推进至推送时点并计算 ${result.resultVersion}，不宣称真实发送`,
                  tone: 'ok',
                })
              }}
            >
              推进至下一推送时点
            </button>
          ) : null}
          {canChannel ? (
            <button
              type="button"
              className="btn-ghost"
              data-testid="simulate-channel"
              onClick={() => run(simulateChannelDelivery(state, current.id), '已形成可交付固定结果，不模拟对方接收成功')}
            >
              模拟通道交付
            </button>
          ) : null}
          {config.validUntil ? (
            <button
              type="button"
              className="btn-ghost"
              data-testid="simulate-expiry"
              onClick={() => run(simulateOpenExpiry(state, current.id), '已推进至截止时间')}
            >
              模拟到期
            </button>
          ) : null}
          <Link className="btn-ghost" to={ROUTES.open}>
            返回列表
          </Link>
        </div>
        {config.nextPushAt ? <p className="muted">下一推送时点 {formatDateTime(config.nextPushAt)}</p> : null}
      </div>
    </section>
  )
}

function deliveryKindLabel(kind: string): string {
  if (kind === 'download') return '直接导出下载'
  if (kind === 'channel') return '通道交付'
  if (kind === 'query') return '按需查询'
  if (kind === 'push') return '定时全量推送'
  return kind
}
