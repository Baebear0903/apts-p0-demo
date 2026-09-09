import { useState } from 'react'
import { formatDateTime } from '../../demo/clock'
import type { ConnectedSystem, DeliveryMethod } from '../../domain/types'
import { useDemoStore } from '../../store/DemoStoreContext'
import { methodLabel } from '../../store/open'
import { organizationName } from '../../store/selectors'
import {
  disableConnectedSystem,
  restoreConnectedSystem,
  saveConnectedSystem,
  stampSystemValidated,
} from '../../store/store'
import { periodLabel } from '../../store/systems'
import type { ConnectedSystemInput } from '../../store/systems'
import { PageHeader, StatusText } from '../../ui/PageHeader'
import { Modal, Toast } from '../../ui/Modal'

const METHOD_OPTIONS: Array<Exclude<DeliveryMethod, 'direct_export'>> = [
  'snapshot_channel',
  'on_demand_query',
  'scheduled_full_push',
]

export function SystemsPage() {
  const { state, patch } = useDemoStore()
  const canMaintain = state.session.permissions.buttons.systemMaintain
  const [editing, setEditing] = useState<ConnectedSystem | 'new' | null>(null)
  const [message, setMessage] = useState<{ text: string; tone: 'error' | 'ok' } | null>(null)

  return (
    <section>
      <PageHeader
        title="已对接系统"
        description="线下联调后的登记项。通道引用不是 URL，不发起网络请求。无地址、密钥或调用日志。"
        extra={
          canMaintain ? (
            <button type="button" className="btn-primary" onClick={() => setEditing('new')}>
              新建已对接系统
            </button>
          ) : null
        }
      />
      {message ? <Toast message={message.text} tone={message.tone} /> : null}
      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>名称</th>
                <th>编码</th>
                <th>默认使用方</th>
                <th>状态</th>
                <th>支持方式</th>
                <th>周期声明</th>
                <th>通道</th>
                <th>责任组织</th>
                <th>最后校验</th>
                {canMaintain ? <th>操作</th> : null}
              </tr>
            </thead>
            <tbody>
              {state.connectedSystems.map((system) => (
                <tr key={system.id} data-testid={`system-row-${system.id}`}>
                  <td>{system.name}</td>
                  <td>{system.code}</td>
                  <td>{system.defaultConsumer}</td>
                  <td>
                    <StatusText>{system.status === 'available' ? '可用' : '停用'}</StatusText>
                  </td>
                  <td>{system.methods.map(methodLabel).join('、')}</td>
                  <td>{periodLabel(system)}</td>
                  <td>{system.channelId}</td>
                  <td>{organizationName(state, system.responsibleOrgId)}</td>
                  <td>{formatDateTime(system.lastValidatedAt)}</td>
                  {canMaintain ? (
                    <td>
                      <div className="toolbar-actions">
                        <button type="button" className="btn-ghost" onClick={() => setEditing(system)}>
                          编辑
                        </button>
                        {system.status === 'available' ? (
                          <button
                            type="button"
                            className="btn-ghost"
                            data-testid={`disable-system-${system.id}`}
                            onClick={() => {
                              const result = disableConnectedSystem(state, system.id)
                              if (!result.ok) setMessage({ text: result.reason, tone: 'error' })
                              else {
                                patch(() => result.state)
                                setMessage({ text: '系统已停用，关联已启用开放已暂停', tone: 'ok' })
                              }
                            }}
                          >
                            停用
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn-ghost"
                            data-testid={`restore-system-${system.id}`}
                            onClick={() => {
                              const result = restoreConnectedSystem(state, system.id)
                              if (!result.ok) setMessage({ text: result.reason, tone: 'error' })
                              else {
                                patch(() => result.state)
                                setMessage({ text: '系统已恢复，关联配置待人工恢复', tone: 'ok' })
                              }
                            }}
                          >
                            恢复
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={() => {
                            const result = stampSystemValidated(state, system.id)
                            if (!result.ok) setMessage({ text: result.reason, tone: 'error' })
                            else {
                              patch(() => result.state)
                              setMessage({ text: '已登记校验时间', tone: 'ok' })
                            }
                          }}
                        >
                          登记已校验
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted">联系人是登记信息，不提供外发消息。</p>
      </div>
      {editing ? (
        <SystemModal
          state={state}
          system={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={(input) => {
            const result = saveConnectedSystem(state, input)
            if (!result.ok) {
              setMessage({ text: result.reason, tone: 'error' })
              return false
            }
            patch(() => result.state)
            setMessage({ text: '已保存已对接系统', tone: 'ok' })
            setEditing(null)
            return true
          }}
        />
      ) : null}
    </section>
  )
}

function SystemModal({
  state,
  system,
  onClose,
  onSave,
}: {
  state: ReturnType<typeof useDemoStore>['state']
  system: ConnectedSystem | null
  onClose: () => void
  onSave: (input: ConnectedSystemInput) => boolean
}) {
  const [name, setName] = useState(system?.name ?? '')
  const [code, setCode] = useState(system?.code ?? '')
  const [defaultConsumer, setDefaultConsumer] = useState(system?.defaultConsumer ?? '')
  const [status, setStatus] = useState<ConnectedSystem['status']>(system?.status ?? 'available')
  const [methods, setMethods] = useState<Array<Exclude<DeliveryMethod, 'direct_export'>>>(system?.methods ?? [])
  const [queryMinIntervalMinutes, setQueryMinIntervalMinutes] = useState(
    String(system?.queryMinIntervalMinutes ?? ''),
  )
  const [pushPeriodMinutes, setPushPeriodMinutes] = useState((system?.pushPeriodMinutes ?? []).join(','))
  const [channelId, setChannelId] = useState(system?.channelId ?? '')
  const [responsibleOrgId, setResponsibleOrgId] = useState(
    system?.responsibleOrgId ?? state.dictionaries.organizations[0]?.id ?? '',
  )
  const [businessContact, setBusinessContact] = useState(system?.businessContact ?? '演示业务联系人')
  const [techContact, setTechContact] = useState(system?.techContact ?? '演示技术联系人')
  const [remark, setRemark] = useState(system?.remark ?? '')

  function toggleMethod(method: Exclude<DeliveryMethod, 'direct_export'>) {
    setMethods((current) => (current.includes(method) ? current.filter((item) => item !== method) : [...current, method]))
  }

  return (
    <Modal title={system ? '编辑已对接系统' : '新建已对接系统'} onClose={onClose}>
      <div className="form-stack" data-testid="system-form">
        <label>
          名称
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          编码
          <input value={code} disabled={Boolean(system)} onChange={(event) => setCode(event.target.value)} data-testid="system-code" />
        </label>
        <label>
          默认使用方
          <input
            list="system-consumers"
            value={defaultConsumer}
            onChange={(event) => setDefaultConsumer(event.target.value)}
            data-testid="system-default-consumer"
          />
          <datalist id="system-consumers">
            {state.dictionaries.consumers.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </label>
        <fieldset>
          <legend>开放方式</legend>
          {METHOD_OPTIONS.map((method) => (
            <label key={method} className="check-row">
              <input type="checkbox" checked={methods.includes(method)} onChange={() => toggleMethod(method)} />
              {methodLabel(method)}
            </label>
          ))}
        </fieldset>
        {methods.includes('on_demand_query') ? (
          <label>
            查询最小间隔（分钟）
            <input
              type="number"
              min={1}
              value={queryMinIntervalMinutes}
              onChange={(event) => setQueryMinIntervalMinutes(event.target.value)}
            />
          </label>
        ) : null}
        {methods.includes('scheduled_full_push') ? (
          <label>
            推送周期（分钟，逗号分隔）
            <input value={pushPeriodMinutes} onChange={(event) => setPushPeriodMinutes(event.target.value)} />
          </label>
        ) : null}
        <label>
          状态
          <select value={status} onChange={(event) => setStatus(event.target.value as ConnectedSystem['status'])}>
            <option value="available">可用</option>
            <option value="disabled">停用</option>
          </select>
        </label>
        <label>
          底座通道引用
          <input value={channelId} onChange={(event) => setChannelId(event.target.value)} />
        </label>
        <label>
          责任组织
          <select value={responsibleOrgId} onChange={(event) => setResponsibleOrgId(event.target.value)}>
            {state.dictionaries.organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {organizationName(state, org.id)}
              </option>
            ))}
          </select>
        </label>
        <label>
          业务联系人
          <input value={businessContact} onChange={(event) => setBusinessContact(event.target.value)} />
        </label>
        <label>
          技术联系人
          <input value={techContact} onChange={(event) => setTechContact(event.target.value)} />
        </label>
        <label>
          用途备注
          <textarea value={remark} onChange={(event) => setRemark(event.target.value)} />
        </label>
      </div>
      <div className="toolbar-actions">
        <button
          type="button"
          className="btn-primary"
          onClick={() =>
            onSave({
              id: system?.id,
              name,
              code,
              defaultConsumer,
              status,
              methods,
              queryMinIntervalMinutes: queryMinIntervalMinutes ? Number(queryMinIntervalMinutes) : undefined,
              pushPeriodMinutes: pushPeriodMinutes
                .split(/[,，\s]+/)
                .map((item) => Number(item))
                .filter((item) => Number.isFinite(item) && item > 0),
              channelId,
              responsibleOrgId,
              businessContact,
              techContact,
              remark,
            })
          }
        >
          保存
        </button>
        <button type="button" className="btn-ghost" onClick={onClose}>
          取消
        </button>
      </div>
    </Modal>
  )
}
