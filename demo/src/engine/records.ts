import { isNotAfter } from '../demo/clock'
import type { Metric, SampleMeasure } from '../domain/types'
import type { BoundScope, DataRecord, EvalContext, QueryFail } from './types'
import { queryFail } from './types'

export function isEligible(record: DataRecord, computeAt: string): boolean {
  return (
    !record.revoked &&
    isNotAfter(record.businessTime, computeAt) &&
    isNotAfter(record.ingestedAt, computeAt)
  )
}

export function isJudgeable(record: DataRecord): boolean {
  return !record.unjudgeable && record.value !== null && record.value !== undefined && record.value !== ''
}

export function dedupeRecords(records: DataRecord[]): DataRecord[] {
  const best = new Map<string, DataRecord>()
  for (const record of records) {
    const current = best.get(record.grainKey)
    if (!current || newerRevision(record, current)) {
      best.set(record.grainKey, record)
    }
  }
  return [...best.values()]
}

function newerRevision(candidate: DataRecord, current: DataRecord): boolean {
  if (candidate.ingestedAt !== current.ingestedAt) return candidate.ingestedAt > current.ingestedAt
  if (candidate.businessTime !== current.businessTime) return candidate.businessTime > current.businessTime
  return candidate.grainKey > current.grainKey
}

export function sortLatestFirst(records: DataRecord[]): DataRecord[] {
  return records.slice().sort((a, b) => {
    if (a.businessTime !== b.businessTime) return a.businessTime < b.businessTime ? 1 : -1
    if (a.ingestedAt !== b.ingestedAt) return a.ingestedAt < b.ingestedAt ? 1 : -1
    return a.grainKey < b.grainKey ? 1 : -1
  })
}

export function sortEarliestFirst(records: DataRecord[]): DataRecord[] {
  return sortLatestFirst(records).reverse()
}

export function recordsForMetric(
  ctx: EvalContext,
  metric: Metric,
  patientId: string,
  bound?: BoundScope,
): DataRecord[] | QueryFail {
  if (metric.kind === 'derived') {
    return derivedPlaceholderRecords(ctx, metric, patientId)
  }
  const field = metric.binding?.field
  if (!field) return []

  if (needsQuery(metric) && ctx.simulateFailure) return queryFail()

  let records: DataRecord[]
  if (isPatientField(field) || metric.grain === '患者') {
    records = patientRecords(ctx, patientId, field, ctx.computeAt)
  } else if (isEncounterField(field) || metric.grain === '就诊') {
    records = encounterRecords(ctx, patientId, field)
  } else if (isMeasureField(field)) {
    records = measureRecords(ctx, patientId, field)
  } else {
    records = observationRecords(ctx, patientId, field)
  }

  let filtered = records.filter((record) => isEligible(record, ctx.computeAt))
  if (bound?.observationId) {
    filtered = filtered.filter((record) => record.observationId === bound.observationId)
  } else if (bound?.encounterId) {
    filtered = filtered.filter(
      (record) => record.encounterId === bound.encounterId || record.grainKey === bound.encounterId,
    )
  }
  return dedupeRecords(filtered)
}

function needsQuery(metric: Metric): boolean {
  return metric.grain !== '患者'
}

function isPatientField(field: string): boolean {
  return field === 'age' || field === 'name' || field === 'sex' || field === 'phone' || field === 'patient_id'
}

function isEncounterField(field: string): boolean {
  return field === 'department' || field === 'visit_time' || field === 'diagnosis' || field === 'encounter_id'
}

function isMeasureField(field: string): boolean {
  return field === 'weight_kg' || field === 'height_m' || field === 'datetime_start' || field === 'datetime_end'
}

function patientRecords(ctx: EvalContext, patientId: string, field: string, computeAt: string): DataRecord[] {
  const patient = ctx.patients.find((item) => item.id === patientId)
  if (!patient) return []
  const value = field === 'age' ? patient.age : field === 'name' ? patient.name : field === 'sex' ? patient.sex : field === 'phone' ? patient.phone : patient.id
  return [
    {
      patientId,
      grainKey: patientId,
      businessTime: computeAt,
      ingestedAt: computeAt,
      revoked: false,
      unjudgeable: value === null || value === undefined,
      value,
    },
  ]
}

function encounterRecords(ctx: EvalContext, patientId: string, field: string): DataRecord[] {
  return ctx.encounters
    .filter((encounter) => encounter.patientId === patientId)
    .map((encounter) => {
      const value =
        field === 'department'
          ? encounter.department
          : field === 'visit_time'
            ? encounter.visitTime
            : field === 'diagnosis'
              ? encounter.diagnosis
              : encounter.id
      return {
        patientId,
        grainKey: encounter.id,
        encounterId: encounter.id,
        businessTime: encounter.visitTime,
        ingestedAt: encounter.visitTime,
        revoked: false,
        unjudgeable: value === null || value === undefined,
        value,
      }
    })
}

function observationRecords(ctx: EvalContext, patientId: string, field: string): DataRecord[] {
  return ctx.observations
    .filter((item) => item.patientId === patientId)
    .map((item) => {
      const value = field === 'symptom' ? item.symptom : field === 'observed_at' ? item.observedAt : item.score
      return {
        patientId,
        grainKey: item.observationId,
        observationId: item.observationId,
        encounterId: item.encounterId ?? undefined,
        businessTime: item.observedAt,
        ingestedAt: item.ingestedAt,
        revoked: item.revoked,
        unjudgeable: item.unjudgeable || value === null || value === undefined,
        value,
      }
    })
}

function measureRecords(ctx: EvalContext, patientId: string, field: string): DataRecord[] {
  return ctx.measures
    .filter((item) => item.patientId === patientId && item.measureType === field)
    .map((item: SampleMeasure) => ({
      patientId,
      grainKey: item.observationId,
      observationId: item.observationId,
      businessTime: item.observedAt,
      ingestedAt: item.ingestedAt,
      revoked: item.revoked,
      unjudgeable: item.value === null || item.value === undefined,
      value: item.value,
    }))
}

function derivedPlaceholderRecords(
  ctx: EvalContext,
  metric: Metric,
  patientId: string,
): DataRecord[] | QueryFail {
  if (ctx.simulateFailure) return queryFail()
  return [
    {
      patientId,
      grainKey: `${patientId}:${metric.id}`,
      businessTime: ctx.computeAt,
      ingestedAt: ctx.computeAt,
      revoked: false,
      unjudgeable: false,
      value: null,
    },
  ]
}
