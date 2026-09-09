import type {
  CompareOp,
  ConditionNode,
  DataGrain,
  GroupNode,
  Judgment,
  JudgmentType,
  Metric,
  RecordGroupNode,
  RuleLogic,
  RuleNode,
  TagRefNode,
  TimeWindow,
  ValueType,
} from '../domain/types'
import { defaultCompareOp } from './compare'

export function defaultWindow(): TimeWindow {
  return { kind: 'relative_days', days: 90 }
}

export function defaultJudgment(metric: Metric, type?: JudgmentType): Judgment {
  const chosen = type && metric.applicableJudgments.includes(type) ? type : metric.applicableJudgments[0]
  const op = defaultCompareOp(metric.valueType)
  const window = defaultWindow()
  switch (chosen) {
    case 'latest':
      return { type: 'latest', window, op, value: null }
    case 'exists':
      return { type: 'exists', window }
    case 'count':
      return { type: 'count', window, op: 'gte', value: 1 }
    case 'zero_records':
      return { type: 'zero_records', window }
    case 'recent_n':
      return { type: 'recent_n', window, n: 3, op, value: null }
    case 'consecutive_dates':
      return { type: 'consecutive_dates', window, n: 3, daily: 'any_satisfy', op, value: null }
    case 'first_abnormal':
      return { type: 'first_abnormal', window, op, value: null }
    case 'change':
      return { type: 'change', mode: 'absolute', op, value: 0 }
    default:
      return { type: 'direct_compare', op, value: null }
  }
}

export function newNodeId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

export function createCondition(metric: Metric): ConditionNode {
  return {
    kind: 'condition',
    id: newNodeId('cond'),
    metricId: metric.id,
    judgment: defaultJudgment(metric),
  }
}

export function createGroup(operator: 'and' | 'or' = 'and', children: RuleNode[] = []): GroupNode {
  return { kind: 'group', id: newNodeId('group'), operator, children }
}

export function createRecordGroup(grain: DataGrain = '采集'): RecordGroupNode {
  return {
    kind: 'record_group',
    id: newNodeId('rgroup'),
    grain,
    operator: 'and',
    children: [],
    outer: { type: 'exists', window: defaultWindow() },
  }
}

export function createTagRef(tagId: string): TagRefNode {
  return { kind: 'tag_ref', id: newNodeId('ref'), tagId }
}

export function createEmptyLogic(): GroupNode {
  return createGroup('and', [])
}

export function findNode(root: RuleNode, id: string): RuleNode | null {
  if (root.id === id) return root
  if (root.kind === 'condition' || root.kind === 'tag_ref') return null
  for (const child of root.children) {
    const found = findNode(child, id)
    if (found) return found
  }
  return null
}

export function updateNode(root: RuleLogic, id: string, updater: (node: RuleNode) => RuleNode): RuleLogic {
  const mapped = mapNode(root, (node) => (node.id === id ? updater(node) : node))
  return mapped as RuleLogic
}

export function mapNode(node: RuleNode, fn: (node: RuleNode) => RuleNode): RuleNode {
  if (node.kind === 'condition' || node.kind === 'tag_ref') return fn(node)
  const children = node.children.map((child) => mapNode(child, fn))
  return fn({ ...node, children } as RuleNode)
}

export function removeNode(root: RuleLogic, id: string): RuleLogic {
  if (root.id === id) return createEmptyLogic()
  if (root.kind === 'condition' || root.kind === 'tag_ref') return root
  return {
    ...root,
    children: root.children
      .filter((child) => child.id !== id)
      .map((child) => removeNode(child, id) as RuleNode),
  } as RuleLogic
}

export function addChild(root: RuleLogic, parentId: string, child: RuleNode): RuleLogic {
  if (root.kind !== 'group' && root.kind !== 'record_group') {
    if (root.id === parentId) {
      return createGroup('and', [root, child])
    }
    return createGroup('and', [root, child])
  }
  return updateNode(root, parentId, (node) => {
    if (node.kind !== 'group' && node.kind !== 'record_group') return node
    return { ...node, children: [...node.children, child] }
  })
}

export function wrapIfNeeded(root: RuleLogic, extra: RuleNode): RuleLogic {
  if (root.kind === 'group' || root.kind === 'record_group') {
    return { ...root, children: [...root.children, extra] } as RuleLogic
  }
  return createGroup('and', [root, extra])
}

export function sourceApplicableJudgments(args: {
  kind: 'field_binding' | 'derived'
  valueType: ValueType
  grain: DataGrain
}): JudgmentType[] {
  if (args.kind === 'derived' || args.grain === '患者') return ['direct_compare']
  const base: JudgmentType[] = ['latest', 'exists', 'count', 'zero_records']
  if (args.valueType === 'number' || args.valueType === 'integer') {
    return [...base, 'recent_n', 'consecutive_dates', 'first_abnormal', 'change']
  }
  if (args.valueType === 'boolean' || args.valueType === 'datetime') {
    return ['latest', 'exists']
  }
  return base
}

export function opsForEditor(valueType: ValueType): Array<{ op: CompareOp; label: string }> {
  if (valueType === 'integer' || valueType === 'number') {
    return [
      { op: 'eq', label: '=' },
      { op: 'neq', label: '≠' },
      { op: 'gt', label: '>' },
      { op: 'gte', label: '≥' },
      { op: 'lt', label: '<' },
      { op: 'lte', label: '≤' },
      { op: 'between', label: '介于' },
    ]
  }
  if (valueType === 'datetime') {
    return [
      { op: 'eq', label: '=' },
      { op: 'lt', label: '早于' },
      { op: 'gt', label: '晚于' },
      { op: 'between', label: '介于' },
    ]
  }
  if (valueType === 'boolean') {
    return [
      { op: 'eq', label: '是／否' },
      { op: 'neq', label: '≠' },
    ]
  }
  return [
    { op: 'eq', label: '=' },
    { op: 'neq', label: '≠' },
    { op: 'in', label: '属于' },
    { op: 'not_in', label: '不属于' },
  ]
}

export function judgmentHasThreshold(judgment: Judgment): boolean {
  if (judgment.type === 'exists' || judgment.type === 'zero_records') return true
  if (judgment.type === 'count') return Number.isInteger(judgment.value)
  if (judgment.type === 'change') return judgment.value !== null && judgment.value !== undefined
  if ('value' in judgment) return judgment.value !== null && judgment.value !== undefined && judgment.value !== ''
  return true
}
