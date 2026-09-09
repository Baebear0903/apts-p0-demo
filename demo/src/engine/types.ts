import type {
  AppState,
  ClinicalEvent,
  Encounter,
  EyeAssessment,
  Metric,
  Patient,
  SampleMeasure,
  Tag,
} from '../domain/types'

export type Tri = 'satisfy' | 'not_satisfy' | 'unknown'

export type Blocked = { unavailable: true; reason: string }

export type NodeEval = Tri | Blocked

export type EvalContext = {
  patients: Patient[]
  encounters: Encounter[]
  observations: EyeAssessment[]
  events: ClinicalEvent[]
  metrics: Metric[]
  tags: Tag[]
  measures: SampleMeasure[]
  computeAt: string
  simulateFailure: boolean
}

export type DataRecord = {
  patientId: string
  grainKey: string
  encounterId?: string
  observationId?: string
  businessTime: string
  ingestedAt: string
  revoked: boolean
  unjudgeable: boolean
  value: unknown
}

export type BoundScope = {
  observationId?: string
  encounterId?: string
}

export type QueryFail = { fail: true; reason: string }

export type MetricValueResult =
  | { status: 'value'; value: unknown }
  | { status: 'unknown' }
  | { status: 'error'; error: string }

export type TrialSample = {
  patientId: string
  maskedName: string
}

export type TrialResult =
  | { unavailableReason: string }
  | { hitPatientIds: string[]; samples: TrialSample[] }

export const QUERY_FAIL_REASON = '查询失败，不能当作零记录'

export function isBlocked(value: NodeEval): value is Blocked {
  return typeof value === 'object' && value.unavailable === true
}

export function isFail(value: unknown): value is QueryFail {
  return typeof value === 'object' && value !== null && (value as QueryFail).fail === true
}

export function queryFail(reason = QUERY_FAIL_REASON): QueryFail {
  return { fail: true, reason }
}

export function blocked(reason: string): Blocked {
  return { unavailable: true, reason }
}

export function combineAnd(parts: NodeEval[]): NodeEval {
  if (parts.length === 0) return 'unknown'
  const firstBlocked = parts.find(isBlocked)
  if (firstBlocked) return firstBlocked
  const tris = parts as Tri[]
  if (tris.some((item) => item === 'not_satisfy')) return 'not_satisfy'
  if (tris.every((item) => item === 'satisfy')) return 'satisfy'
  return 'unknown'
}

export function combineOr(parts: NodeEval[]): NodeEval {
  if (parts.length === 0) return 'unknown'
  const firstBlocked = parts.find(isBlocked)
  if (firstBlocked) return firstBlocked
  const tris = parts as Tri[]
  if (tris.some((item) => item === 'satisfy')) return 'satisfy'
  if (tris.every((item) => item === 'not_satisfy')) return 'not_satisfy'
  return 'unknown'
}

export function dataPartition(state: AppState): {
  patients: Patient[]
  encounters: Encounter[]
  observations: EyeAssessment[]
  events: ClinicalEvent[]
  measures: SampleMeasure[]
} {
  const sample = state.session.mode === 'ruleSamples' ? state.session.ruleSampleWorkingCopy : null
  if (sample) {
    return {
      patients: sample.patients,
      encounters: sample.encounters,
      observations: sample.observations,
      events: sample.events,
      measures: sample.measures,
    }
  }
  return {
    patients: state.patients,
    encounters: state.encounters,
    observations: state.observations,
    events: state.events,
    measures: [],
  }
}

export function buildEvalContext(state: AppState, computeAt = state.clock): EvalContext {
  const partition = dataPartition(state)
  return {
    ...partition,
    metrics: state.metrics,
    tags: state.tags,
    computeAt,
    simulateFailure: state.session.simulateFailure,
  }
}
