import type { CompareOp, ValueType } from '../domain/types'
import type { Tri } from './types'

export function isEmptyValue(value: unknown): boolean {
  return value === null || value === undefined || value === ''
}

export function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

export function opsForValueType(valueType: ValueType): CompareOp[] {
  if (valueType === 'integer' || valueType === 'number') {
    return ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between']
  }
  if (valueType === 'datetime') {
    return ['eq', 'lt', 'gt', 'between']
  }
  if (valueType === 'boolean') {
    return ['eq', 'neq']
  }
  return ['eq', 'neq', 'in', 'not_in']
}

export function defaultCompareOp(valueType: ValueType): CompareOp {
  return valueType === 'integer' || valueType === 'number' ? 'gte' : 'eq'
}

export function compareValues(
  actual: unknown,
  op: CompareOp,
  expected: unknown,
  valueType: ValueType,
): Tri {
  if (isEmptyValue(actual)) return 'unknown'
  const allowed = opsForValueType(valueType)
  if (!allowed.includes(op)) return 'unknown'

  if (valueType === 'integer' || valueType === 'number') {
    const left = asNumber(actual)
    if (left === null) return 'unknown'
    if (op === 'between') {
      const bounds = betweenBounds(expected)
      if (!bounds) return 'unknown'
      return left >= bounds[0] && left <= bounds[1] ? 'satisfy' : 'not_satisfy'
    }
    const right = asNumber(expected)
    if (right === null) return 'unknown'
    return boolTri(applyNumberOp(left, op, right))
  }

  if (valueType === 'datetime') {
    const left = asDateMs(actual)
    if (left === null) return 'unknown'
    if (op === 'between') {
      const bounds = datetimeBetween(expected)
      if (!bounds) return 'unknown'
      return left >= bounds[0] && left <= bounds[1] ? 'satisfy' : 'not_satisfy'
    }
    const right = asDateMs(expected)
    if (right === null) return 'unknown'
    if (op === 'eq') return boolTri(left === right)
    if (op === 'lt') return boolTri(left < right)
    if (op === 'gt') return boolTri(left > right)
    if (op === 'neq') return boolTri(left !== right)
    return 'unknown'
  }

  if (valueType === 'boolean') {
    const left = asBoolean(actual)
    if (left === null) return 'unknown'
    const right = asBoolean(expected)
    if (right === null) return 'unknown'
    if (op === 'eq') return boolTri(left === right)
    if (op === 'neq') return boolTri(left !== right)
    return 'unknown'
  }

  const leftText = String(actual)
  if (op === 'in' || op === 'not_in') {
    const set = asStringList(expected)
    if (set.length === 0) return 'unknown'
    const included = set.includes(leftText)
    return boolTri(op === 'in' ? included : !included)
  }
  const rightText = expected === null || expected === undefined ? '' : String(expected)
  if (op === 'eq') return boolTri(leftText === rightText)
  if (op === 'neq') return boolTri(leftText !== rightText)
  return 'unknown'
}

function boolTri(value: boolean | null): Tri {
  if (value === null) return 'unknown'
  return value ? 'satisfy' : 'not_satisfy'
}

function applyNumberOp(left: number, op: CompareOp, right: number): boolean | null {
  switch (op) {
    case 'eq':
      return left === right
    case 'neq':
      return left !== right
    case 'gt':
      return left > right
    case 'gte':
      return left >= right
    case 'lt':
      return left < right
    case 'lte':
      return left <= right
    default:
      return null
  }
}

function betweenBounds(expected: unknown): [number, number] | null {
  if (Array.isArray(expected) && expected.length === 2) {
    const start = asNumber(expected[0])
    const end = asNumber(expected[1])
    if (start === null || end === null || start > end) return null
    return [start, end]
  }
  if (expected && typeof expected === 'object' && 'min' in expected && 'max' in expected) {
    const start = asNumber((expected as { min: unknown }).min)
    const end = asNumber((expected as { max: unknown }).max)
    if (start === null || end === null || start > end) return null
    return [start, end]
  }
  return null
}

function datetimeBetween(expected: unknown): [number, number] | null {
  if (Array.isArray(expected) && expected.length === 2) {
    const start = asDateMs(expected[0])
    const end = asDateMs(expected[1])
    if (start === null || end === null || start > end) return null
    return [start, end]
  }
  return null
}

function asDateMs(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number' && !(value instanceof Date)) return null
  const ms = new Date(value).getTime()
  return Number.isFinite(ms) ? ms : null
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (value === '是' || value === 'true') return true
  if (value === '否' || value === 'false') return false
  return null
}

function asStringList(expected: unknown): string[] {
  if (Array.isArray(expected)) return expected.map((item) => String(item))
  if (typeof expected === 'string' && expected !== '') return [expected]
  return []
}
