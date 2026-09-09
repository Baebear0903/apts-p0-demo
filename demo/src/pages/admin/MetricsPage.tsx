import { useMemo, useState } from 'react'
import type { DataGrain, DerivedFunction, JudgmentType, Metric, MetricCatalog, MetricKind, ValueType } from '../../domain/types'
import { metricReferences } from '../../engine/availability'
import { sourceApplicableJudgments } from '../../engine/logicTree'
import { canChangeMetricBinding } from '../../engine/validate'
import { useDemoStore } from '../../store/DemoStoreContext'
import { allocateMetricId, deleteMetric, disableMetric, restoreMetric, saveMetric } from '../../store/store'
import { PageHeader, StatusText } from '../../ui/PageHeader'
import { Modal, Toast } from '../../ui/Modal'
import {
  Button,
  Panel,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Toolbar,
} from '../../ui/kit'

const JUDGMENT_LABEL: Record<JudgmentType, string> = {
  direct_compare: '直接比较',
  latest: '最新',
  exists: '存在',
  count: '累计次数',
  zero_records: '零记录',
  recent_n: '最近 N 次',
  consecutive_dates: '连续日期',
  first_abnormal: '首次异常',
  change: '较前变化',
}

export function MetricsPage() {
  const { state, patch } = useDemoStore()
  const canMaintain = state.session.permissions.buttons.metricMaintain
  const [editing, setEditing] = useState<Metric | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [message, setMessage] = useState<{ text: string; tone: 'error' | 'ok' } | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  function openNew() {
    const dataset = state.datasets[0]
    const field = dataset?.fields.find((item) => item.name === 'age') ?? dataset?.fields[0]
    const grain = dataset?.grain ?? '患者'
    const valueType = field?.valueType ?? 'integer'
    setIsNew(true)
    setEditing({
      id: '',
      name: '',
      catalog: '患者属性',
      kind: 'field_binding',
      status: 'active',
      binding: dataset && field ? { datasetId: dataset.id, tableName: dataset.tableName, field: field.name } : undefined,
      valueType,
      grain,
      patientKey: 'patient_id',
      comparable: true,
      applicableJudgments: sourceApplicableJudgments({ kind: 'field_binding', valueType, grain }),
      validityNote: '有效记录参与判断，缺失不补成 0 或正常',
      dedupeNote: '按声明粒度去重',
    })
  }

  return (
    <section>
      <PageHeader
        title="指标库"
        description="配置字段绑定或衍生指标，供标签规则引用。"
        extra={
          canMaintain ? (
            <Button type="button" onClick={openNew}>
              新建指标
            </Button>
          ) : null
        }
      />
      {message ? <Toast message={message.text} tone={message.tone} /> : null}
      {deleteError ? <Toast message={deleteError} tone="error" /> : null}
      <Panel>
        {state.metrics.length === 0 ? (
          <p className="empty">
            暂无指标。
            {canMaintain ? (
              <Button type="button" className="ml-2" onClick={openNew}>
                新建指标
              </Button>
            ) : null}
          </p>
        ) : (
          <Table className="[&_td]:align-top">
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>目录</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>绑定／公式</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>判断方式</TableHead>
                <TableHead>引用数</TableHead>
                {canMaintain ? <TableHead>操作</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.metrics.map((metric) => {
                const refs = metricReferences(state, metric.id)
                const count = refs.tags.length + refs.derived.length
                return (
                  <TableRow key={metric.id}>
                    <TableCell className="font-medium">{metric.name}</TableCell>
                    <TableCell>{metric.catalog}</TableCell>
                    <TableCell>{metric.kind === 'field_binding' ? '字段绑定' : '衍生'}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {metric.binding
                        ? `${metric.binding.tableName}.${metric.binding.field}`
                        : metric.derived?.formula ?? metric.derived?.function ?? '—'}
                    </TableCell>
                    <TableCell>
                      <StatusText>{metric.status === 'active' ? '可用' : '停用'}</StatusText>
                    </TableCell>
                    <TableCell className="max-w-[18rem] whitespace-normal">
                      {metric.applicableJudgments.map((item) => JUDGMENT_LABEL[item]).join('／')}
                    </TableCell>
                    <TableCell>{count}</TableCell>
                    {canMaintain ? (
                      <TableCell>
                        <Toolbar>
                          <Button type="button" variant="outline" size="sm" onClick={() => { setIsNew(false); setEditing(metric) }}>
                            编辑
                          </Button>
                          {metric.status === 'active' ? (
                            <Button type="button" variant="outline" size="sm" onClick={() => patch((current) => disableMetric(current, metric.id))}>
                              停用
                            </Button>
                          ) : (
                            <Button type="button" variant="outline" size="sm" onClick={() => patch((current) => restoreMetric(current, metric.id))}>
                              恢复
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const result = deleteMetric(state, metric.id)
                              if (!result.ok) {
                                const names = [
                                  ...result.references.tags.map((item) => `标签「${item.name}」`),
                                  ...result.references.derived.map((item) => `衍生指标「${item.name}」`),
                                ]
                                setDeleteError(`${result.reason}：${names.join('、')}`)
                                return
                              }
                              patch(() => result.state)
                              setDeleteError(null)
                            }}
                          >
                            删除
                          </Button>
                        </Toolbar>
                      </TableCell>
                    ) : null}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Panel>
      {editing ? (
        <MetricModal
          stateMetrics={state}
          metric={editing}
          isNew={isNew}
          onClose={() => setEditing(null)}
          onSave={(metric) => {
            const withId = metric.id ? metric : { ...metric, id: allocateMetricId(state) }
            const original = state.metrics.find((item) => item.id === withId.id)
            if (original) {
              const compatibility = canChangeMetricBinding(state, original, withId)
              if (!compatibility.ok) {
                setMessage({ text: compatibility.reason, tone: 'error' })
                return false
              }
            }
            const result = saveMetric(state, withId)
            if (!result.ok) {
              setMessage({ text: result.errors.join('；'), tone: 'error' })
              return false
            }
            patch(() => result.state)
            setMessage({ text: '指标已保存', tone: 'ok' })
            setEditing(null)
            return true
          }}
        />
      ) : null}
    </section>
  )
}

function MetricModal({
  stateMetrics,
  metric,
  isNew,
  onClose,
  onSave,
}: {
  stateMetrics: import('../../domain/types').AppState
  metric: Metric
  isNew: boolean
  onClose: () => void
  onSave: (metric: Metric) => boolean
}) {
  const [draft, setDraft] = useState<Metric>(metric)
  const source = sourceApplicableJudgments({
    kind: draft.kind,
    valueType: draft.valueType,
    grain: draft.grain,
  })
  const affected = draft.id ? metricReferences(stateMetrics, draft.id).tags : []
  const original = stateMetrics.metrics.find((item) => item.id === draft.id)

  const bindingLabel = useMemo(() => {
    if (draft.kind !== 'field_binding') return ''
    return `${draft.binding?.tableName ?? ''}.${draft.binding?.field ?? ''}`
  }, [draft])

  function applyDatasetField(datasetId: string, fieldName: string) {
    const dataset = stateMetrics.datasets.find((item) => item.id === datasetId)
    const field = dataset?.fields.find((item) => item.name === fieldName)
    if (!dataset || !field) return
    const next: Metric = {
      ...draft,
      binding: { datasetId: dataset.id, tableName: dataset.tableName, field: field.name },
      valueType: field.valueType,
      grain: dataset.grain,
      businessTimeField: dataset.associations.time ?? undefined,
      patientKey: dataset.associations.patient,
      observationKey: dataset.associations.record,
      sortField: dataset.associations.time ?? undefined,
      enumValues: field.name === 'department' ? ['眼科', '全科'] : field.name === 'sex' ? ['男', '女'] : undefined,
      applicableJudgments: sourceApplicableJudgments({
        kind: 'field_binding',
        valueType: field.valueType,
        grain: dataset.grain,
      }),
    }
    setDraft(next)
  }

  return (
    <Modal title={isNew ? '新建指标' : '编辑指标'} onClose={onClose}>
      {affected.length > 0 ? (
        <p className="notice">
          受影响标签：{affected.map((item) => item.name).join('、')}
          {original && !canChangeMetricBinding(stateMetrics, original, draft).ok
            ? '。类型／单位／粒度不兼容将阻止保存。'
            : ''}
        </p>
      ) : null}
      <div className="form-stack">
        <label>
          名称
          <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
        </label>
        <label>
          目录
          <select
            value={draft.catalog}
            onChange={(event) => setDraft({ ...draft, catalog: event.target.value as MetricCatalog })}
          >
            {stateMetrics.dictionaries.metricCatalogs.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label>
          类型
          <select
            value={draft.kind}
            onChange={(event) => {
              const kind = event.target.value as MetricKind
              if (kind === 'derived') {
                setDraft({
                  ...draft,
                  kind,
                  catalog: '衍生指标',
                  derived: draft.derived ?? {
                    function: 'avg',
                    inputMetricIds: [],
                    windowDays: 30,
                    formula: '',
                    resultUnit: draft.unit,
                  },
                  grain: '患者',
                  applicableJudgments: ['direct_compare'],
                  valueType: 'number',
                })
              } else {
                setDraft({ ...draft, kind, derived: undefined })
              }
            }}
          >
            <option value="field_binding">字段绑定</option>
            <option value="derived">衍生</option>
          </select>
        </label>
        {draft.kind === 'field_binding' ? (
          <>
            <label>
              数据集
              <select
                value={draft.binding?.datasetId ?? ''}
                onChange={(event) => {
                  const dataset = stateMetrics.datasets.find((item) => item.id === event.target.value)
                  const field = dataset?.fields[0]
                  if (dataset && field) applyDatasetField(dataset.id, field.name)
                }}
              >
                {stateMetrics.datasets.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              字段（源元数据只读继承）
              <select
                value={draft.binding?.field ?? ''}
                onChange={(event) => applyDatasetField(draft.binding?.datasetId ?? '', event.target.value)}
              >
                {(stateMetrics.datasets.find((item) => item.id === draft.binding?.datasetId)?.fields ?? []).map((field) => (
                  <option key={field.name} value={field.name}>
                    {field.label}（{field.name}）
                  </option>
                ))}
              </select>
            </label>
            <p className="muted">
              绑定 {bindingLabel} · 值类型 {draft.valueType} · 粒度 {draft.grain}
            </p>
            <label>
              单位
              <input value={draft.unit ?? ''} onChange={(event) => setDraft({ ...draft, unit: event.target.value || undefined })} />
            </label>
          </>
        ) : (
          <DerivedFields
            draft={draft}
            metrics={stateMetrics.metrics}
            onChange={setDraft}
          />
        )}
        <fieldset>
          <legend>适用判断方式（只能选自源能力子集）</legend>
          {source.map((item) => (
            <label key={item}>
              <input
                type="checkbox"
                checked={draft.applicableJudgments.includes(item)}
                onChange={(event) => {
                  const next = event.target.checked
                    ? [...draft.applicableJudgments, item]
                    : draft.applicableJudgments.filter((entry) => entry !== item)
                  setDraft({ ...draft, applicableJudgments: next })
                }}
              />
              {JUDGMENT_LABEL[item]}
            </label>
          ))}
        </fieldset>
        <label>
          有效性说明
          <input value={draft.validityNote} onChange={(event) => setDraft({ ...draft, validityNote: event.target.value })} />
        </label>
        <label>
          去重说明
          <input value={draft.dedupeNote} onChange={(event) => setDraft({ ...draft, dedupeNote: event.target.value })} />
        </label>
      </div>
      <div className="toolbar-actions">
        <button type="button" className="btn-primary" onClick={() => onSave(draft)}>
          保存
        </button>
        <button type="button" className="btn-ghost" onClick={onClose}>
          取消
        </button>
      </div>
    </Modal>
  )
}

function DerivedFields({
  draft,
  metrics,
  onChange,
}: {
  draft: Metric
  metrics: Metric[]
  onChange: (metric: Metric) => void
}) {
  const spec = draft.derived ?? { function: 'avg' as DerivedFunction, inputMetricIds: [] as string[] }
  const inputs = metrics.filter((item) => item.id !== draft.id)
  return (
    <>
      <label>
        衍生函数
        <select
          value={spec.function}
          onChange={(event) => {
            const fn = event.target.value as DerivedFunction
            onChange({
              ...draft,
              derived: { ...spec, function: fn },
              grain: '患者',
              valueType: fn === 'date_diff' ? 'number' : 'number',
              applicableJudgments: ['direct_compare'],
            })
          }}
        >
          <option value="count">窗口计数</option>
          <option value="sum">窗口求和</option>
          <option value="avg">窗口平均</option>
          <option value="max">窗口最大</option>
          <option value="min">窗口最小</option>
          <option value="arithmetic">算术</option>
          <option value="date_diff">日期差</option>
        </select>
      </label>
      <label>
        输入指标
        <select
          multiple
          value={spec.inputMetricIds}
          onChange={(event) => {
            const selected = Array.from(event.target.selectedOptions).map((item) => item.value)
            onChange({ ...draft, derived: { ...spec, inputMetricIds: selected } })
          }}
        >
          {inputs.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      {spec.function === 'arithmetic' ? (
        <label>
          公式（$0、$1 对应输入顺序；支持 + − × ÷ 与括号）
          <input
            value={spec.formula ?? ''}
            onChange={(event) => onChange({ ...draft, derived: { ...spec, formula: event.target.value } })}
          />
        </label>
      ) : null}
      {spec.function !== 'arithmetic' && spec.function !== 'date_diff' ? (
        <label>
          窗口天数
          <input
            type="number"
            min={1}
            value={spec.windowDays ?? 30}
            onChange={(event) => onChange({ ...draft, derived: { ...spec, windowDays: Number(event.target.value) } })}
          />
        </label>
      ) : null}
      <label>
        结果单位
        <input
          value={spec.resultUnit ?? draft.unit ?? ''}
          onChange={(event) =>
            onChange({
              ...draft,
              unit: event.target.value || undefined,
              derived: { ...spec, resultUnit: event.target.value },
            })
          }
        />
      </label>
      <p className="muted">粒度 {draft.grain as DataGrain} · 值类型 {draft.valueType as ValueType}</p>
    </>
  )
}
