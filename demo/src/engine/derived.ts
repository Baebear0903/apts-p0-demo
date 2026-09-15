import { addDays, daysBetween } from '../demo/clock'
import type { AppState, DerivedMetricSpec, Metric } from '../domain/types'
import { asNumber, compareValues } from './compare'
import { isEligible, isJudgeable, recordsForMetric, sortLatestFirst } from './records'
import type { DataRecord, EvalContext, MetricValueResult, QueryFail } from './types'
import { buildEvalContext, isFail, QUERY_FAIL_REASON } from './types'
import { inInterval } from './window'

export function metricValue(
  state: AppState,
  metricId: string,
  patientId: string,
  computeAt: string,
): MetricValueResult {
  const ctx = buildEvalContext(state, computeAt)
  const metric = ctx.metrics.find((item) => item.id === metricId)
  if (!metric) return { status: 'unknown' }
  if (metric.status === 'disabled') {
    return { status: 'error', error: `依赖指标「${metric.name}」已停用` }
  }
  return metricValueInContext(ctx, metric, patientId)
}

export function metricValueInContext(
  ctx: EvalContext,
  metric: Metric,
  patientId: string,
): MetricValueResult {
  if (metric.kind === 'derived') {
    return derivedValue(ctx, metric, patientId)
  }
  if (ctx.simulateFailure && metric.grain !== '患者') {
    return { status: 'error', error: QUERY_FAIL_REASON }
  }
  const records = recordsForMetric(ctx, metric, patientId)
  if (isFail(records)) return { status: 'error', error: records.reason }
  const latest = sortLatestFirst(records.filter(isJudgeable))[0]
  if (!latest) return { status: 'unknown' }
  return { status: 'value', value: latest.value }
}

function derivedValue(ctx: EvalContext, metric: Metric, patientId: string): MetricValueResult {
  const spec = metric.derived
  if (!spec) return { status: 'unknown' }
  if (ctx.simulateFailure) return { status: 'error', error: QUERY_FAIL_REASON }

  for (const inputId of spec.inputMetricIds) {
    const input = ctx.metrics.find((item) => item.id === inputId)
    if (!input) return { status: 'unknown' }
    if (input.status === 'disabled') {
      return { status: 'error', error: `依赖指标「${input.name}」已停用` }
    }
  }

  if (spec.function === 'arithmetic') {
    return arithmeticValue(ctx, patientId, spec, spec.formula ?? '')
  }
  if (spec.function === 'date_diff') {
    return dateDiffValue(ctx, patientId, spec)
  }
  return windowStatValue(ctx, spec, patientId)
}

function windowStatValue(
  ctx: EvalContext,
  spec: DerivedMetricSpec,
  patientId: string,
): MetricValueResult {
  const inputMetricId = spec.inputMetricIds[0]
  if (!inputMetricId) return { status: 'unknown' }
  const input = ctx.metrics.find((item) => item.id === inputMetricId)
  if (!input) return { status: 'unknown' }
  const records = recordsForMetric(ctx, input, patientId)
  if (isFail(records)) return { status: 'error', error: records.reason }
  const start = addDays(ctx.computeAt, -(spec.windowDays ?? 30))
  const numbers = records
    .filter((record) => isEligible(record, ctx.computeAt) && isJudgeable(record))
    .filter((record) => inInterval(record.businessTime, { start, end: ctx.computeAt }, ctx.computeAt))
    .filter((record) => !spec.filter || compareValues(record.value, spec.filter.op, spec.filter.value, input.valueType) === 'satisfy')
    .map((record) => asNumber(record.value))
    .filter((value): value is number => value !== null)

  if (spec.function === 'count') return { status: 'value', value: numbers.length }
  if (numbers.length === 0) return { status: 'unknown' }
  if (spec.function === 'sum') return { status: 'value', value: numbers.reduce((acc, item) => acc + item, 0) }
  if (spec.function === 'avg') {
    return { status: 'value', value: numbers.reduce((acc, item) => acc + item, 0) / numbers.length }
  }
  if (spec.function === 'max') return { status: 'value', value: Math.max(...numbers) }
  if (spec.function === 'min') return { status: 'value', value: Math.min(...numbers) }
  return { status: 'unknown' }
}

function arithmeticValue(
  ctx: EvalContext,
  patientId: string,
  spec: DerivedMetricSpec,
  formula: string,
): MetricValueResult {
  const values = associatedNumbers(ctx, patientId, spec.inputMetricIds, spec.association)
  if (isFail(values)) return { status: 'error', error: values.reason }
  if (!values) return { status: 'unknown' }
  const result = evaluateArithmetic(formula, values)
  if (result === null) return { status: 'unknown' }
  return { status: 'value', value: result }
}

function dateDiffValue(ctx: EvalContext, patientId: string, spec: DerivedMetricSpec): MetricValueResult {
  const startId = spec.dateStartMetricId ?? spec.inputMetricIds[0]
  const endId = spec.dateEndMetricId ?? spec.inputMetricIds[1]
  if (!startId || !endId) return { status: 'unknown' }
  const pair = associatedDatetimes(ctx, patientId, startId, endId, spec.association)
  if (isFail(pair)) return { status: 'error', error: pair.reason }
  if (!pair) return { status: 'unknown' }
  return { status: 'value', value: daysBetween(pair[0], pair[1]) }
}

function associatedNumbers(
  ctx: EvalContext,
  patientId: string,
  inputMetricIds: string[],
  association: DerivedMetricSpec['association'],
): number[] | null | QueryFail {
  const chosen = associatedRecords(ctx, patientId, inputMetricIds, association)
  if (isFail(chosen)) return chosen
  if (!chosen) return null
  const numbers = chosen.map((record) => asNumber(record.value))
  if (numbers.some((item) => item === null)) return null
  return numbers as number[]
}

function associatedDatetimes(
  ctx: EvalContext,
  patientId: string,
  startId: string,
  endId: string,
  association: DerivedMetricSpec['association'],
): [string, string] | null | QueryFail {
  const chosen = associatedRecords(ctx, patientId, [startId, endId], association)
  if (isFail(chosen)) return chosen
  if (!chosen || typeof chosen[0]?.value !== 'string' || typeof chosen[1]?.value !== 'string') return null
  return [chosen[0].value, chosen[1].value]
}

function associatedRecords(
  ctx: EvalContext,
  patientId: string,
  inputMetricIds: string[],
  association: DerivedMetricSpec['association'],
): DataRecord[] | null | QueryFail {
  const loaded: DataRecord[][] = []
  for (const id of inputMetricIds) {
    const metric = ctx.metrics.find((item) => item.id === id)
    if (!metric) return null
    const records = recordsForMetric(ctx, metric, patientId)
    if (isFail(records)) return records
    const judgeable = sortLatestFirst(records.filter(isJudgeable))
    if (judgeable.length === 0) return null
    loaded.push(judgeable)
  }
  if (loaded.length === 1) return latestOfEach(loaded)
  return association === 'same_patient_latest' ? latestOfEach(loaded) : joinByObservation(loaded)
}

function joinByObservation(loaded: DataRecord[][]): DataRecord[] | null {
  if (loaded.length === 0) return null
  const first = loaded[0]
  if (!first || first.every((item) => !item.observationId)) return null
  const keys = new Set(first.map((item) => item.observationId).filter((id): id is string => Boolean(id)))
  const complete: DataRecord[][] = []
  for (const key of keys) {
    const group: DataRecord[] = []
    let ok = true
    for (const records of loaded) {
      const match = records.find((item) => item.observationId === key)
      if (!match) {
        ok = false
        break
      }
      group.push(match)
    }
    if (ok) complete.push(group)
  }
  if (complete.length === 0) return null
  complete.sort((a, b) => {
    const aTime = a[0]?.businessTime ?? ''
    const bTime = b[0]?.businessTime ?? ''
    return aTime < bTime ? 1 : -1
  })
  return complete[0] ?? null
}

function latestOfEach(loaded: DataRecord[][]): DataRecord[] | null {
  const result: DataRecord[] = []
  for (const records of loaded) {
    const latest = records[0]
    if (!latest) return null
    result.push(latest)
  }
  return result
}

export function evaluateArithmetic(formula: string, inputs: Array<number | null>): number | null {
  if (inputs.some((item) => item === null || item === undefined || Number.isNaN(item))) return null
  const tokens = tokenize(formula)
  if (!tokens) return null
  let index = 0

  const peek = () => tokens[index]
  const consume = () => {
    const token = tokens[index]
    index += 1
    return token
  }

  function parseExpression(): number | null {
    let left = parseTerm()
    if (left === null) return null
    while (true) {
      const token = peek()
      if (!token || token.kind !== 'op' || (token.value !== '+' && token.value !== '-')) break
      const op = token.value
      consume()
      const right = parseTerm()
      if (right === null) return null
      left = op === '+' ? left + right : left - right
    }
    return left
  }

  function parseTerm(): number | null {
    let left = parseFactor()
    if (left === null) return null
    while (true) {
      const token = peek()
      if (!token || token.kind !== 'op' || (token.value !== '*' && token.value !== '/')) break
      const op = token.value
      consume()
      const right = parseFactor()
      if (right === null) return null
      if (op === '/') {
        if (right === 0) return null
        left = left / right
      } else {
        left = left * right
      }
    }
    return left
  }

  function parseFactor(): number | null {
    const token = peek()
    if (!token) return null
    if (token.kind === 'op' && token.value === '-') {
      consume()
      const inner = parseFactor()
      return inner === null ? null : -inner
    }
    if (token.kind === 'lp') {
      consume()
      const inner = parseExpression()
      if (peek()?.kind !== 'rp') return null
      consume()
      return inner
    }
    if (token.kind === 'num') {
      consume()
      return token.value
    }
    if (token.kind === 'ref') {
      consume()
      const value = inputs[token.index]
      return value === null || value === undefined ? null : value
    }
    return null
  }

  const value = parseExpression()
  if (value === null || index !== tokens.length) return null
  return value
}

type Token =
  | { kind: 'num'; value: number }
  | { kind: 'op'; value: string }
  | { kind: 'lp' }
  | { kind: 'rp' }
  | { kind: 'ref'; index: number }

function tokenize(formula: string): Token[] | null {
  const tokens: Token[] = []
  const source = formula.replaceAll('×', '*').replaceAll('÷', '/').replaceAll('−', '-')
  let i = 0
  while (i < source.length) {
    const ch = source[i]
    if (ch === undefined) break
    if (/\s/.test(ch)) {
      i += 1
      continue
    }
    if (ch === '$') {
      i += 1
      let digits = ''
      while (i < source.length && /[0-9]/.test(source[i] ?? '')) {
        digits += source[i]
        i += 1
      }
      if (digits === '') return null
      tokens.push({ kind: 'ref', index: Number(digits) })
      continue
    }
    if (ch === '(') {
      tokens.push({ kind: 'lp' })
      i += 1
      continue
    }
    if (ch === ')') {
      tokens.push({ kind: 'rp' })
      i += 1
      continue
    }
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/') {
      tokens.push({ kind: 'op', value: ch })
      i += 1
      continue
    }
    if (/[0-9.]/.test(ch)) {
      let raw = ''
      while (i < source.length && /[0-9.]/.test(source[i] ?? '')) {
        raw += source[i]
        i += 1
      }
      const value = Number(raw)
      if (!Number.isFinite(value)) return null
      tokens.push({ kind: 'num', value })
      continue
    }
    return null
  }
  return tokens
}
