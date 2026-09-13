import { summarizeLogic, windowLabel } from '../../domain/logicSummary'
import type {
  AppState,
  CompareOp,
  ConditionNode,
  GroupNode,
  Judgment,
  JudgmentType,
  RecordGroupNode,
  RuleLogic,
  RuleNode,
  TagType,
  TimeWindow,
} from '../../domain/types'
import {
  addChild,
  createCondition,
  createGroup,
  createRecordGroup,
  createTagRef,
  defaultJudgment,
  findNode,
  opsForEditor,
  removeNode,
  updateNode,
  wrapIfNeeded,
} from '../../engine/logicTree'
import { Button, Panel, Toolbar } from '@/components/shared/kit'

const JUDGMENT_LABEL: Record<JudgmentType, string> = {
  direct_compare: '直接比较',
  latest: '最新一次',
  exists: '存在',
  count: '累计次数',
  zero_records: '零记录',
  recent_n: '最近 N 次每次满足',
  consecutive_dates: '连续日期',
  first_abnormal: '首次异常',
  change: '较前变化',
}

export function RuleEditor({
  state,
  logic,
  tagType,
  readOnly,
  onChange,
  selectedId,
  onSelect,
}: {
  state: AppState
  logic: RuleLogic
  tagType: TagType
  readOnly: boolean
  onChange: (logic: RuleLogic) => void
  selectedId: string
  onSelect: (id: string) => void
}) {
  const selected = findNode(logic, selectedId) ?? logic
  const metrics = state.metrics.filter((item) => item.status === 'active' || item.id === (selected.kind === 'condition' ? selected.metricId : ''))
  const firstMetric = metrics[0] ?? state.metrics[0]

  function add(kind: 'condition' | 'group' | 'record_group' | 'tag_ref') {
    if (readOnly || !firstMetric) return
    const child =
      kind === 'condition'
        ? createCondition(firstMetric)
        : kind === 'group'
          ? createGroup()
          : kind === 'record_group'
            ? createRecordGroup()
            : createTagRef(publishedBasic(state)[0]?.id ?? '')
    const parent = findNode(logic, selectedId)
    if (parent && (parent.kind === 'group' || parent.kind === 'record_group')) {
      onChange(addChild(logic, parent.id, child))
      onSelect(child.id)
      return
    }
    onChange(wrapIfNeeded(logic, child))
    onSelect(child.id)
  }

  return (
    <div className="mt-1 grid gap-4 lg:grid-cols-2">
      <Panel
        title="逻辑树"
        action={
          !readOnly ? (
            <Toolbar className="mb-0">
              <Button type="button" variant="outline" size="sm" onClick={() => add('condition')}>
                添加条件
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => add('group')}>
                添加分组
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => add('record_group')}>
                添加记录条件组
              </Button>
              {tagType === 'composite' ? (
                <Button type="button" variant="outline" size="sm" onClick={() => add('tag_ref')} disabled={publishedBasic(state).length === 0}>
                  引用基础标签
                </Button>
              ) : null}
            </Toolbar>
          ) : null
        }
      >
        <ul className="space-y-1">
          <TreeItem node={logic} state={state} selectedId={selected.id} onSelect={onSelect} />
        </ul>
      </Panel>
      <Panel title="参数" description="选值后即时更新左侧摘要。保存后重开须与当前值一致。">
        {selected.kind === 'condition' ? (
          <ConditionParams
            state={state}
            node={selected}
            readOnly={readOnly}
            onChange={(next) => onChange(updateNode(logic, selected.id, () => next))}
          />
        ) : null}
        {selected.kind === 'group' ? (
          <GroupParams
            node={selected}
            readOnly={readOnly}
            onChange={(next) => onChange(updateNode(logic, selected.id, () => next))}
            onRemove={() => {
              onChange(removeNode(logic, selected.id))
              onSelect(logic.id)
            }}
          />
        ) : null}
        {selected.kind === 'record_group' ? (
          <RecordGroupParams
            node={selected}
            readOnly={readOnly}
            onChange={(next) => onChange(updateNode(logic, selected.id, () => next))}
            onRemove={() => {
              onChange(removeNode(logic, selected.id))
              onSelect(logic.id)
            }}
          />
        ) : null}
        {selected.kind === 'tag_ref' ? (
          <TagRefParams
            state={state}
            node={selected}
            readOnly={readOnly}
            onChange={(next) => onChange(updateNode(logic, selected.id, () => next))}
            onRemove={() => {
              onChange(removeNode(logic, selected.id))
              onSelect(logic.id)
            }}
          />
        ) : null}
      </Panel>
    </div>
  )
}

function publishedBasic(state: AppState) {
  return state.tags.filter((tag) => tag.type === 'basic' && tag.status === 'published')
}

function TreeItem({
  node,
  state,
  selectedId,
  onSelect,
}: {
  node: RuleNode
  state: AppState
  selectedId: string
  onSelect: (id: string) => void
}) {
  return (
    <li>
      <button
        type="button"
        className={
          node.id === selectedId
            ? 'bg-accent text-accent-foreground flex w-full flex-col items-start gap-0.5 rounded-lg border border-primary/30 px-2.5 py-2 text-left text-sm'
            : 'hover:bg-muted/70 flex w-full flex-col items-start gap-0.5 rounded-lg border border-transparent px-2.5 py-2 text-left text-sm'
        }
        onClick={() => onSelect(node.id)}
      >
        <span className="text-muted-foreground text-xs">{kindLabel(node)}</span>
        <span>{summarizeLogic(state, node)}</span>
      </button>
      {node.kind === 'group' || node.kind === 'record_group' ? (
        <ul className="mt-1 space-y-1 border-l pl-3">
          {node.children.map((child) => (
            <TreeItem key={child.id} node={child} state={state} selectedId={selectedId} onSelect={onSelect} />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

function kindLabel(node: RuleNode): string {
  if (node.kind === 'condition') return '条件'
  if (node.kind === 'tag_ref') return '引用'
  if (node.kind === 'record_group') return '记录组'
  return node.operator === 'and' ? '且' : '或'
}

function ConditionParams({
  state,
  node,
  readOnly,
  onChange,
}: {
  state: AppState
  node: ConditionNode
  readOnly: boolean
  onChange: (node: ConditionNode) => void
}) {
  const metric = state.metrics.find((item) => item.id === node.metricId)
  const metrics = state.metrics.filter((item) => item.status === 'active' || item.id === node.metricId)
  return (
    <div className="grid gap-3">
      <label>
        指标
        <select
          disabled={readOnly}
          value={node.metricId}
          onChange={(event) => {
            const next = state.metrics.find((item) => item.id === event.target.value)
            if (!next) return
            onChange({ ...node, metricId: next.id, judgment: defaultJudgment(next) })
          }}
        >
          {metrics.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      {metric ? (
        <label>
          判断方式
          <select
            disabled={readOnly || metric.applicableJudgments.length <= 1}
            value={node.judgment.type}
            onChange={(event) =>
              onChange({ ...node, judgment: defaultJudgment(metric, event.target.value as JudgmentType) })
            }
          >
            {metric.applicableJudgments.map((item) => (
              <option key={item} value={item}>
                {JUDGMENT_LABEL[item]}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {metric ? (
        <JudgmentFields
          metricValueType={metric.valueType}
          enumValues={metric.enumValues}
          judgment={node.judgment}
          readOnly={readOnly}
          eventTypes={state.dictionaries.eventTypes}
          onChange={(judgment) => onChange({ ...node, judgment })}
        />
      ) : null}
    </div>
  )
}

function JudgmentFields({
  metricValueType,
  enumValues,
  judgment,
  readOnly,
  eventTypes,
  onChange,
}: {
  metricValueType: ConditionNode extends never ? never : import('../../domain/types').ValueType
  enumValues?: string[]
  judgment: Judgment
  readOnly: boolean
  eventTypes: import('../../domain/types').EventType[]
  onChange: (judgment: Judgment) => void
}) {
  return (
    <>
      {'window' in judgment ? (
        <WindowFields
          window={judgment.window}
          readOnly={readOnly}
          eventTypes={eventTypes}
          onChange={(window) => onChange({ ...judgment, window } as Judgment)}
        />
      ) : null}
      {judgment.type === 'recent_n' || judgment.type === 'consecutive_dates' ? (
        <label>
          连续／最近 N
          <input
            type="number"
            min={1}
            disabled={readOnly}
            value={judgment.n}
            onChange={(event) => onChange({ ...judgment, n: Number(event.target.value) })}
          />
        </label>
      ) : null}
      {judgment.type === 'consecutive_dates' ? (
        <label>
          每日口径
          <select
            disabled={readOnly}
            value={judgment.daily}
            onChange={(event) =>
              onChange({
                ...judgment,
                daily: event.target.value as 'any_satisfy' | 'all_valid_satisfy',
              })
            }
          >
            <option value="any_satisfy">当天存在一次满足</option>
            <option value="all_valid_satisfy">当天全部有效观察满足</option>
          </select>
        </label>
      ) : null}
      {judgment.type === 'change' ? (
        <label>
          变化类型
          <select
            disabled={readOnly}
            value={judgment.mode}
            onChange={(event) => onChange({ ...judgment, mode: event.target.value as 'absolute' | 'rate' })}
          >
            <option value="absolute">绝对变化</option>
            <option value="rate">变化率</option>
          </select>
        </label>
      ) : null}
      {judgment.type === 'exists' ? (
        <label>
          过滤比较
          <select
            disabled={readOnly}
            value={judgment.filter ? 'yes' : 'no'}
            onChange={(event) =>
              onChange({
                ...judgment,
                filter: event.target.value === 'yes' ? { op: 'eq', value: enumValues?.[0] ?? '' } : undefined,
              })
            }
          >
            <option value="no">不限制取值</option>
            <option value="yes">按取值过滤</option>
          </select>
        </label>
      ) : null}
      {judgment.type === 'exists' && judgment.filter ? (
        <CompareFields
          valueType={metricValueType}
          enumValues={enumValues}
          op={judgment.filter.op}
          value={judgment.filter.value}
          readOnly={readOnly}
          onChange={(op, value) => onChange({ ...judgment, filter: { op, value } })}
        />
      ) : null}
      {judgment.type !== 'exists' && judgment.type !== 'zero_records' && 'op' in judgment ? (
        <CompareFields
          valueType={metricValueType}
          enumValues={enumValues}
          op={judgment.op}
          value={judgment.value}
          readOnly={readOnly}
          onChange={(op, value) => onChange({ ...judgment, op, value } as Judgment)}
        />
      ) : null}
    </>
  )
}

function CompareFields({
  valueType,
  enumValues,
  op,
  value,
  readOnly,
  onChange,
}: {
  valueType: import('../../domain/types').ValueType
  enumValues?: string[]
  op: CompareOp
  value: unknown
  readOnly: boolean
  onChange: (op: CompareOp, value: unknown) => void
}) {
  const ops = opsForEditor(valueType)
  const between = Array.isArray(value) ? value : [value ?? '', '']
  return (
    <>
      <label>
        比较符
        <select disabled={readOnly} value={op} onChange={(event) => onChange(event.target.value as CompareOp, value)}>
          {ops.map((item) => (
            <option key={item.op} value={item.op}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      {op === 'between' ? (
        <div className="grid grid-cols-2 gap-2">
          <label>
            起点
            <input
              disabled={readOnly}
              value={String(between[0] ?? '')}
              onChange={(event) => onChange(op, [event.target.value, between[1]])}
            />
          </label>
          <label>
            终点
            <input
              disabled={readOnly}
              value={String(between[1] ?? '')}
              onChange={(event) => onChange(op, [between[0], event.target.value])}
            />
          </label>
        </div>
      ) : valueType === 'boolean' ? (
        <label>
          取值
          <select
            disabled={readOnly}
            value={value === true ? 'true' : value === false ? 'false' : ''}
            onChange={(event) =>
              onChange(op, event.target.value === '' ? null : event.target.value === 'true')
            }
          >
            <option value="">请选择</option>
            <option value="true">是</option>
            <option value="false">否</option>
          </select>
        </label>
      ) : op === 'in' || op === 'not_in' ? (
        <fieldset>
          <legend>取值</legend>
          {(enumValues ?? []).map((item) => {
            const selected = Array.isArray(value) ? value.includes(item) : false
            return (
              <label key={item}>
                <input
                  type="checkbox"
                  disabled={readOnly}
                  checked={selected}
                  onChange={(event) => {
                    const current = Array.isArray(value) ? [...value] : []
                    const next = event.target.checked ? [...current, item] : current.filter((entry) => entry !== item)
                    onChange(op, next)
                  }}
                />
                {item}
              </label>
            )
          })}
        </fieldset>
      ) : enumValues && enumValues.length > 0 ? (
        <label>
          取值
          <select
            disabled={readOnly}
            value={value === null || value === undefined ? '' : String(value)}
            onChange={(event) => onChange(op, event.target.value === '' ? null : event.target.value)}
          >
            <option value="">请选择</option>
            {enumValues.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label>
          阈值
          <input
            disabled={readOnly}
            type={valueType === 'number' || valueType === 'integer' ? 'number' : valueType === 'datetime' ? 'datetime-local' : 'text'}
            value={value === null || value === undefined ? '' : String(value)}
            onChange={(event) => {
              const raw = event.target.value
              if (raw === '') {
                onChange(op, null)
                return
              }
              if (valueType === 'number' || valueType === 'integer') {
                onChange(op, Number(raw))
                return
              }
              onChange(op, raw)
            }}
          />
        </label>
      )}
    </>
  )
}

function WindowFields({
  window,
  readOnly,
  eventTypes,
  onChange,
}: {
  window: TimeWindow
  readOnly: boolean
  eventTypes: import('../../domain/types').EventType[]
  onChange: (window: TimeWindow) => void
}) {
  return (
    <div className="grid gap-3">
      <label>
        时间窗口
        <select
          disabled={readOnly}
          value={window.kind}
          onChange={(event) => {
            const kind = event.target.value
            if (kind === 'relative_days') onChange({ kind: 'relative_days', days: 90 })
            else if (kind === 'fixed') onChange({ kind: 'fixed', start: '', end: '' })
            else {
              onChange({
                kind: 'event',
                eventType: eventTypes[0] ?? '出院',
                occurrence: 'latest',
                offsetBeforeDays: 0,
                offsetAfterDays: 30,
              })
            }
          }}
        >
          <option value="relative_days">近 N 天</option>
          <option value="fixed">固定起止</option>
          <option value="event">事件前后</option>
        </select>
      </label>
      <p className="text-muted-foreground text-xs">{windowLabel(window)}</p>
      {window.kind === 'relative_days' ? (
        <label>
          天数
          <input
            type="number"
            min={0}
            disabled={readOnly}
            value={window.days}
            onChange={(event) => onChange({ kind: 'relative_days', days: Number(event.target.value) })}
          />
        </label>
      ) : null}
      {window.kind === 'fixed' ? (
        <div className="grid grid-cols-2 gap-2">
          <label>
            开始
            <input
              type="date"
              disabled={readOnly}
              value={window.start.slice(0, 10)}
              onChange={(event) => onChange({ ...window, start: `${event.target.value}T00:00:00+08:00` })}
            />
          </label>
          <label>
            结束
            <input
              type="date"
              disabled={readOnly}
              value={window.end.slice(0, 10)}
              onChange={(event) => onChange({ ...window, end: `${event.target.value}T23:59:59+08:00` })}
            />
          </label>
        </div>
      ) : null}
      {window.kind === 'event' ? (
        <>
          <label>
            事件
            <select
              disabled={readOnly}
              value={window.eventType}
              onChange={(event) =>
                onChange({ ...window, eventType: event.target.value as (typeof eventTypes)[number] })
              }
            >
              {eventTypes.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label>
            锚点
            <select
              disabled={readOnly}
              value={window.occurrence}
              onChange={(event) =>
                onChange({ ...window, occurrence: event.target.value as 'first' | 'latest' | 'any' })
              }
            >
              <option value="latest">最近一次</option>
              <option value="first">首次</option>
              <option value="any">任一次</option>
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label>
              前偏移天
              <input
                type="number"
                min={0}
                disabled={readOnly}
                value={window.offsetBeforeDays}
                onChange={(event) => onChange({ ...window, offsetBeforeDays: Number(event.target.value) })}
              />
            </label>
            <label>
              后偏移天
              <input
                type="number"
                min={0}
                disabled={readOnly}
                value={window.offsetAfterDays}
                onChange={(event) => onChange({ ...window, offsetAfterDays: Number(event.target.value) })}
              />
            </label>
          </div>
        </>
      ) : null}
    </div>
  )
}

function GroupParams({
  node,
  readOnly,
  onChange,
  onRemove,
}: {
  node: GroupNode
  readOnly: boolean
  onChange: (node: GroupNode) => void
  onRemove: () => void
}) {
  return (
    <div className="grid gap-3">
      <label>
        组合
        <select
          disabled={readOnly}
          value={node.operator}
          onChange={(event) => onChange({ ...node, operator: event.target.value as 'and' | 'or' })}
        >
          <option value="and">且</option>
          <option value="or">或</option>
        </select>
      </label>
      <label>
        <input
          type="checkbox"
          disabled={readOnly}
          checked={Boolean(node.sameEncounter)}
          onChange={(event) => onChange({ ...node, sameEncounter: event.target.checked })}
        />
        同次就诊限定
      </label>
      {!readOnly ? (
        <Button type="button" variant="outline" size="sm" onClick={onRemove}>
          删除该组
        </Button>
      ) : null}
    </div>
  )
}

function RecordGroupParams({
  node,
  readOnly,
  onChange,
  onRemove,
}: {
  node: RecordGroupNode
  readOnly: boolean
  onChange: (node: RecordGroupNode) => void
  onRemove: () => void
}) {
  return (
    <div className="grid gap-3">
      <label>
        观察粒度
        <select
          disabled={readOnly}
          value={node.grain}
          onChange={(event) => onChange({ ...node, grain: event.target.value as RecordGroupNode['grain'] })}
        >
          <option value="采集">采集</option>
          <option value="就诊">就诊</option>
        </select>
      </label>
      <label>
        组内组合
        <select
          disabled={readOnly}
          value={node.operator}
          onChange={(event) => onChange({ ...node, operator: event.target.value as 'and' | 'or' })}
        >
          <option value="and">且</option>
          <option value="or">或</option>
        </select>
      </label>
      <label>
        外层判断
        <select
          disabled={readOnly}
          value={node.outer.type}
          onChange={(event) => {
            const type = event.target.value
            const window = 'window' in node.outer ? node.outer.window : { kind: 'relative_days' as const, days: 90 }
            if (type === 'exists') onChange({ ...node, outer: { type: 'exists', window } })
            else if (type === 'count') onChange({ ...node, outer: { type: 'count', window, op: 'gte', value: 1 } })
            else if (type === 'recent_n') onChange({ ...node, outer: { type: 'recent_n', window, n: 3, op: 'gte', value: null } })
            else {
              onChange({
                ...node,
                outer: { type: 'consecutive_dates', window, n: 3, daily: 'any_satisfy', op: 'gte', value: null },
              })
            }
          }}
        >
          <option value="exists">存在</option>
          <option value="count">累计次数</option>
          <option value="recent_n">最近 N 次</option>
          <option value="consecutive_dates">连续日期</option>
        </select>
      </label>
      <JudgmentFields
        metricValueType="number"
        judgment={node.outer}
        readOnly={readOnly}
        eventTypes={['门诊就诊', '出院']}
        onChange={(judgment) => {
          if (
            judgment.type === 'exists' ||
            judgment.type === 'count' ||
            judgment.type === 'recent_n' ||
            judgment.type === 'consecutive_dates'
          ) {
            onChange({ ...node, outer: judgment })
          }
        }}
      />
      {!readOnly ? (
        <Button type="button" variant="outline" size="sm" onClick={onRemove}>
          删除记录条件组
        </Button>
      ) : null}
    </div>
  )
}

function TagRefParams({
  state,
  node,
  readOnly,
  onChange,
  onRemove,
}: {
  state: AppState
  node: import('../../domain/types').TagRefNode
  readOnly: boolean
  onChange: (node: import('../../domain/types').TagRefNode) => void
  onRemove: () => void
}) {
  const options = publishedBasic(state)
  const ref = state.tags.find((item) => item.id === node.tagId)
  return (
    <div className="grid gap-3">
      <label>
        已发布基础标签
        <select
          disabled={readOnly}
          value={node.tagId}
          onChange={(event) => onChange({ ...node, tagId: event.target.value })}
        >
          {options.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}（{item.id}）
            </option>
          ))}
        </select>
      </label>
      {ref ? (
        <p>
          只读展开当前逻辑：{summarizeLogic(state, ref.logic)}
        </p>
      ) : (
        <p className="text-muted-foreground text-xs">未找到引用标签</p>
      )}
      {!readOnly ? (
        <Button type="button" variant="outline" size="sm" onClick={onRemove}>
          删除引用
        </Button>
      ) : null}
    </div>
  )
}
