import { ORG_INFO_ID } from '../domain/ids'
import type {
  AppState,
  Batch,
  BatchKind,
  ComputeTimeRuleExplanation,
  Encounter,
  Hit,
  Patient,
  RuleLogic,
  SnapshotMember,
} from '../domain/types'
import { collectEvidenceSlots } from '../engine/evidence'
import { allocateBatchId } from './allocate'
import { latestEncounter, patientById } from './selectors'

export function makeHits(
  state: AppState,
  batchId: string,
  patientIds: string[],
  computeAt: string,
  logics: RuleLogic[],
  tagId?: string,
): Hit[] {
  return patientIds.map((patientId) => {
    const slots = dedupeSlots(
      logics.flatMap((logic) => collectEvidenceSlots(state, logic, patientId, computeAt)),
    )
    return {
      id: `HIT-${batchId}-${patientId}`,
      batchId,
      tagId,
      patientId,
      computedAt: computeAt,
      slots,
    }
  })
}

function dedupeSlots(slots: Hit['slots']): Hit['slots'] {
  const seen = new Set<string>()
  const result: Hit['slots'] = []
  for (const slot of slots) {
    const key = `${slot.role}|${slot.metricId}|${slot.observationId ?? slot.encounterId ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(slot)
  }
  return result
}

export function toSnapshotMembers(state: AppState, patientIds: string[], at = state.clock): SnapshotMember[] {
  return patientIds.map((patientId) => {
    const patient = patientById(state, patientId)
    const encounter = latestEncounter(state, patientId, at)
    return memberFrom(patient, encounter, patientId)
  })
}

function memberFrom(patient: Patient | undefined, encounter: Encounter | undefined, patientId: string): SnapshotMember {
  return {
    patientId,
    name: patient?.name ?? patientId,
    sex: patient?.sex ?? '男',
    age: patient?.age ?? 0,
    encounterId: encounter?.id,
    department: encounter?.department,
    phone: patient?.phone ?? null,
  }
}

export function appendBatch(
  state: AppState,
  input: {
    kind: BatchKind
    computedAt: string
    tagId?: string
    cohortId?: string
    ruleExplanation: ComputeTimeRuleExplanation
    patientIds: string[]
    logics: RuleLogic[]
  },
): { state: AppState; batch: Batch } {
  const batchId = allocateBatchId(state, input.computedAt)
  const batch: Batch = {
    id: batchId,
    tagId: input.tagId,
    cohortId: input.cohortId,
    kind: input.kind,
    computedAt: input.computedAt,
    scopeConfirmations: {
      [state.currentScopeId]: { scopeId: state.currentScopeId, status: 'pending' },
    },
    ruleExplanation: input.ruleExplanation,
  }
  const hits = makeHits(state, batchId, input.patientIds, input.computedAt, input.logics, input.tagId)
  return {
    batch,
    state: {
      ...state,
      batches: [...state.batches, batch],
      hits: [...state.hits, ...hits],
    },
  }
}

export function defaultOrgId(state: AppState): string {
  return state.dictionaries.organizations[0]?.id ?? ORG_INFO_ID
}