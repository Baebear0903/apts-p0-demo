import { datetimeLocalToIso, isoToDatetimeLocal } from '../../demo/clock'
import type { AppState, DeliveryMethod, OpenConfig, OpenConfigType } from '../../domain/types'
import {
  consumerAfterSystemSelect,
  methodLabel,
  methodsForType,
} from '../../store/open'
import type { OpenConfigInput } from '../../store/open'
import { organizationName } from '../../store/selectors'

export type OpenFormValue = {
  name: string
  type: OpenConfigType
  consumer: string
  purpose: string
  description: string
  boundSnapshotId: string
  boundDynamicCohortId: string
  method: DeliveryMethod
  systemId: string
  responsibleOrgId: string
  validityMode: 'indefinite' | 'until'
  validUntilLocal: string
  pushPeriodMinutes: string
}

export function emptyOpenForm(state: AppState, defaults?: Partial<OpenFormValue>): OpenFormValue {
  const type = defaults?.type ?? 'dataset_delivery'
  const method = defaults?.method ?? (type === 'dataset_delivery' ? 'direct_export' : 'on_demand_query')
  return {
    name: '',
    type,
    consumer: '',
    purpose: '',
    description: '',
    boundSnapshotId: '',
    boundDynamicCohortId: '',
    method,
    systemId: '',
    responsibleOrgId: state.dictionaries.organizations[0]?.id ?? '',
    validityMode: 'indefinite',
    validUntilLocal: isoToDatetimeLocal(state.clock),
    pushPeriodMinutes: '',
    ...defaults,
  }
}

export function formFromConfig(state: AppState, config: OpenConfig): OpenFormValue {
  return {
    name: config.name,
    type: config.type,
    consumer: config.consumer,
    purpose: config.purpose,
    description: config.description ?? '',
    boundSnapshotId: config.boundSnapshotId ?? '',
    boundDynamicCohortId: config.boundDynamicCohortId ?? '',
    method: config.method,
    systemId: config.systemId ?? '',
    responsibleOrgId: config.responsibleOrgId,
    validityMode: config.validUntil ? 'until' : 'indefinite',
    validUntilLocal: config.validUntil ? isoToDatetimeLocal(config.validUntil) : isoToDatetimeLocal(state.clock),
    pushPeriodMinutes: config.pushPeriodMinutes ? String(config.pushPeriodMinutes) : '',
  }
}

export function inputFromForm(form: OpenFormValue, id?: string): OpenConfigInput {
  return {
    id,
    name: form.name,
    type: form.type,
    consumer: form.consumer,
    purpose: form.purpose,
    description: form.description,
    boundSnapshotId: form.boundSnapshotId || undefined,
    boundDynamicCohortId: form.boundDynamicCohortId || undefined,
    method: form.method,
    systemId: form.method === 'direct_export' ? undefined : form.systemId || undefined,
    responsibleOrgId: form.responsibleOrgId,
    validUntil: form.validityMode === 'until' && form.validUntilLocal ? datetimeLocalToIso(form.validUntilLocal) : null,
    pushPeriodMinutes: form.method === 'scheduled_full_push' && form.pushPeriodMinutes
      ? Number(form.pushPeriodMinutes)
      : undefined,
  }
}

export function OpenConfigForm({
  state,
  value,
  onChange,
  locked,
  typeLocked,
  objectLocked,
  errors = [],
}: {
  state: AppState
  value: OpenFormValue
  onChange: (next: OpenFormValue) => void
  locked: boolean
  typeLocked?: boolean
  objectLocked?: boolean
  errors?: string[]
}) {
  const methods = methodsForType(value.type)
  const systems = state.connectedSystems.filter((system) =>
    value.method === 'direct_export' ? false : system.methods.includes(value.method),
  )
  const selectedSystem = state.connectedSystems.find((item) => item.id === value.systemId)
  const readOnlyCore = locked
  const errorFor = (field: 'name' | 'consumer' | 'purpose' | 'description' | 'organization' | 'object' | 'method' | 'system' | 'period' | 'validUntil') => {
    const patterns = {
      name: /名称/,
      consumer: /使用方/,
      purpose: /用途/,
      description: /说明/,
      organization: /责任组织/,
      object: /快照|动态人群/,
      method: /数据集交付须|标签订阅须/,
      system: /已对接系统/,
      period: /推送周期/,
      validUntil: /截止时间/,
    }
    return errors.find((error) => patterns[field].test(error))
  }

  function patch(partial: Partial<OpenFormValue>) {
    onChange({ ...value, ...partial })
  }

  function changeType(type: OpenConfigType) {
    if (readOnlyCore || typeLocked) return
    const method = methodsForType(type)[0] ?? value.method
    patch({
      type,
      method,
      systemId: method === 'direct_export' ? '' : value.systemId,
      boundSnapshotId: type === 'dataset_delivery' ? value.boundSnapshotId : '',
      boundDynamicCohortId: type === 'tag_subscription' ? value.boundDynamicCohortId : '',
      pushPeriodMinutes: method === 'scheduled_full_push' ? value.pushPeriodMinutes : '',
    })
  }

  function changeMethod(method: DeliveryMethod) {
    if (value.method === 'direct_export' && locked) return
    const systemId = method === 'direct_export' ? '' : value.systemId
    patch({
      method,
      systemId,
      pushPeriodMinutes: method === 'scheduled_full_push' ? value.pushPeriodMinutes : '',
    })
  }

  function changeSystem(systemId: string) {
    if (readOnlyCore) return
    const system = state.connectedSystems.find((item) => item.id === systemId)
    const consumer = system ? consumerAfterSystemSelect(value.consumer, system) : value.consumer
    const period = system?.pushPeriodMinutes?.[0]
    patch({
      systemId,
      consumer,
      pushPeriodMinutes:
        value.method === 'scheduled_full_push' && period && !value.pushPeriodMinutes ? String(period) : value.pushPeriodMinutes,
    })
  }

  const fieldError = (field: Parameters<typeof errorFor>[0], id: string) => {
    const message = errorFor(field)
    return message ? <span id={id} className="form-error" role="alert">{message}</span> : null
  }

  return (
    <div className="open-form">
      <fieldset className="form-section">
        <legend>基本信息</legend>
        <div className="form-grid">
      <label>
        名称
        <input value={value.name} onChange={(event) => patch({ name: event.target.value })} data-testid="open-name" aria-invalid={Boolean(errorFor('name'))} aria-describedby={errorFor('name') ? 'open-name-error' : undefined} />
        {fieldError('name', 'open-name-error')}
      </label>
      <label>
        类型
        <select
          value={value.type}
          disabled={readOnlyCore || typeLocked}
          onChange={(event) => changeType(event.target.value as OpenConfigType)}
          data-testid="open-type"
        >
          <option value="dataset_delivery">数据集交付</option>
          <option value="tag_subscription">标签订阅</option>
        </select>
      </label>
      <label>
        使用方
        <input
          list="open-consumers"
          value={value.consumer}
          disabled={readOnlyCore}
          onChange={(event) => patch({ consumer: event.target.value })}
          data-testid="consumer-input"
          aria-invalid={Boolean(errorFor('consumer'))}
          aria-describedby={errorFor('consumer') ? 'open-consumer-error' : undefined}
        />
        {fieldError('consumer', 'open-consumer-error')}
        <datalist id="open-consumers">
          {state.dictionaries.consumers.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>
      </label>
      <label className="span-2">
        用途
        <input value={value.purpose} onChange={(event) => patch({ purpose: event.target.value })} data-testid="open-purpose" aria-invalid={Boolean(errorFor('purpose'))} aria-describedby={errorFor('purpose') ? 'open-purpose-error' : undefined} />
        {fieldError('purpose', 'open-purpose-error')}
      </label>
      <label className="span-2">
        说明
        <textarea value={value.description} onChange={(event) => patch({ description: event.target.value })} aria-invalid={Boolean(errorFor('description'))} aria-describedby={errorFor('description') ? 'open-description-error' : undefined} />
        {fieldError('description', 'open-description-error')}
      </label>
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend>开放对象</legend>
        <div className="form-grid">
      {value.type === 'dataset_delivery' ? (
        <label className="span-2">
          绑定快照
          {state.snapshots.length === 0 ? (
            <span className="muted">暂无已确认快照，请先在人群管理确认快照。</span>
          ) : (
            <select
              value={value.boundSnapshotId}
              disabled={readOnlyCore || objectLocked}
              onChange={(event) => patch({ boundSnapshotId: event.target.value })}
              data-testid="bound-snapshot"
              aria-invalid={Boolean(errorFor('object'))}
              aria-describedby={errorFor('object') ? 'open-object-error' : undefined}
            >
              <option value="">请选择已确认快照</option>
              {state.snapshots.map((snapshot) => (
                <option key={snapshot.id} value={snapshot.id}>
                  {snapshot.name}（{snapshot.id}，{snapshot.members.length} 人）
                </option>
              ))}
            </select>
          )}
          {fieldError('object', 'open-object-error')}
        </label>
      ) : (
        <label className="span-2">
          绑定动态人群
          {state.dynamicCohorts.length === 0 ? (
            <span className="muted">暂无动态人群，请先创建动态人群。</span>
          ) : (
            <select
              value={value.boundDynamicCohortId}
              disabled={readOnlyCore || objectLocked}
              onChange={(event) => patch({ boundDynamicCohortId: event.target.value })}
              data-testid="bound-cohort"
              aria-invalid={Boolean(errorFor('object'))}
              aria-describedby={errorFor('object') ? 'open-object-error' : undefined}
            >
              <option value="">请选择动态人群</option>
              {state.dynamicCohorts.map((cohort) => (
                <option key={cohort.id} value={cohort.id}>
                  {cohort.name}（{cohort.id}）
                </option>
              ))}
            </select>
          )}
          {fieldError('object', 'open-object-error')}
        </label>
      )}
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend>交付方式</legend>
        <div className="form-grid">
      <label>
        方式
        <select
          value={value.method}
          disabled={value.method === 'direct_export' && locked}
          onChange={(event) => changeMethod(event.target.value as DeliveryMethod)}
          data-testid="open-method"
          aria-invalid={Boolean(errorFor('method'))}
          aria-describedby={errorFor('method') ? 'open-method-error' : undefined}
        >
          {methods.map((method) => (
            <option key={method} value={method}>
              {methodLabel(method)}
            </option>
          ))}
        </select>
        {fieldError('method', 'open-method-error')}
      </label>
      {value.method === 'direct_export' ? (
        <p className="muted span-2">直接导出不选择已对接系统，使用方由用户填写。</p>
      ) : (
        <label>
          已对接系统
          <select
            value={value.systemId}
            disabled={readOnlyCore}
            onChange={(event) => changeSystem(event.target.value)}
            data-testid="system-select"
            aria-invalid={Boolean(errorFor('system'))}
            aria-describedby={errorFor('system') ? 'open-system-error' : undefined}
          >
            <option value="">请选择系统</option>
            {systems.map((system) => (
              <option key={system.id} value={system.id}>
                {system.name}（{system.status === 'available' ? '可用' : '停用'}）
              </option>
            ))}
          </select>
          {fieldError('system', 'open-system-error')}
        </label>
      )}
      {selectedSystem && value.method === 'on_demand_query' ? (
        <p className="muted span-2" data-testid="query-interval">
          查询最小间隔 {selectedSystem.queryMinIntervalMinutes} 分钟
          {selectedSystem.queryMinIntervalMinutes === 1440 ? '（1 天）' : ''}。与推送周期、有效期分开。
        </p>
      ) : null}
      {value.method === 'scheduled_full_push' ? (
        <label>
          推送周期
          <select
            value={value.pushPeriodMinutes}
            onChange={(event) => patch({ pushPeriodMinutes: event.target.value })}
            data-testid="push-period"
            aria-invalid={Boolean(errorFor('period'))}
            aria-describedby={errorFor('period') ? 'open-period-error' : undefined}
          >
            <option value="">请选择周期</option>
            {(selectedSystem?.pushPeriodMinutes ?? []).map((minutes) => (
              <option key={minutes} value={String(minutes)}>
                {minutes % 1440 === 0 ? `${minutes / 1440} 天` : `${minutes} 分钟`}
              </option>
            ))}
          </select>
          {fieldError('period', 'open-period-error')}
        </label>
      ) : null}
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend>有效期与责任</legend>
        <div className="form-grid">
      <label>
        责任组织
        <select
          value={value.responsibleOrgId}
          onChange={(event) => patch({ responsibleOrgId: event.target.value })}
          aria-invalid={Boolean(errorFor('organization'))}
          aria-describedby={errorFor('organization') ? 'open-organization-error' : undefined}
        >
          {state.dictionaries.organizations.map((org) => (
            <option key={org.id} value={org.id}>
              {organizationName(state, org.id)}
            </option>
          ))}
        </select>
        {fieldError('organization', 'open-organization-error')}
      </label>
      <label>
        有效期
        <select
          value={value.validityMode}
          onChange={(event) => patch({ validityMode: event.target.value as OpenFormValue['validityMode'] })}
          data-testid="validity-mode"
        >
          <option value="indefinite">长期有效</option>
          <option value="until">指定截止时间</option>
        </select>
      </label>
      {value.validityMode === 'until' ? (
        <label>
          截止时间
          <input
            type="datetime-local"
            value={value.validUntilLocal}
            onChange={(event) => patch({ validUntilLocal: event.target.value })}
            data-testid="valid-until"
            aria-invalid={Boolean(errorFor('validUntil'))}
            aria-describedby={errorFor('validUntil') ? 'open-valid-until-error' : undefined}
          />
          {fieldError('validUntil', 'open-valid-until-error')}
        </label>
      ) : (
        <p className="muted">默认长期有效。查询间隔、推送周期与有效期分开。</p>
      )}
        </div>
      </fieldset>
    </div>
  )
}
