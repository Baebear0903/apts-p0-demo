import type { AppState, Tag } from '../domain/types'
import { tagAvailability } from './availability'
import { evaluateTag, isBlocked } from './evaluate'
import { dataPartition } from './types'
import type { NodeEval } from './types'
import { QUERY_FAIL_REASON } from './types'

export function isTagAuthorized(state: AppState, tagId: string): boolean {
  const list = state.session.authorizedTagIds
  if (list == null) return true
  return list.includes(tagId)
}

export function unauthorizedTagIds(state: AppState, tagIds: string[]): string[] {
  return [...new Set(tagIds)].filter((id) => !isTagAuthorized(state, id))
}

export function tagDisplayName(state: AppState, tagId: string): string {
  const tag = state.tags.find((item) => item.id === tagId)
  if (!tag) return `${tagId}（已删除）`
  if (tag.status === 'deleted') return `${tag.name}（已删除标签）`
  return tag.name
}

export function includeExcludeAvailability(
  state: AppState,
  includeTagIds: string[],
  excludeTagIds: string[],
): { ok: true; tags: Tag[] } | { ok: false; reason: string } {
  const ids = [...includeTagIds, ...excludeTagIds]
  if (includeTagIds.length === 0) return { ok: false, reason: '至少选择一个纳入标签' }
  const missingAuth = unauthorizedTagIds(state, ids)
  if (missingAuth.length > 0) {
    return { ok: false, reason: `缺标签使用授权：${missingAuth.map((id) => tagDisplayName(state, id)).join('、')}` }
  }
  const tags: Tag[] = []
  const reasons: string[] = []
  for (const id of ids) {
    const tag = state.tags.find((item) => item.id === id)
    if (!tag) {
      reasons.push(`标签 ${id} 不存在`)
      continue
    }
    tags.push(tag)
    if (tag.status === 'deleted') {
      reasons.push(`标签「${tag.name}」已删除，不能继续计算`)
      continue
    }
    const availability = tagAvailability(state, tag)
    if (!availability.available) reasons.push(availability.reasons.join('；'))
  }
  if (reasons.length > 0) return { ok: false, reason: reasons.join('；') }
  return { ok: true, tags }
}

export function evaluateIncludeExclude(
  state: AppState,
  includeTagIds: string[],
  excludeTagIds: string[],
  computeAt: string,
  patientId: string,
): NodeEval {
  const availability = includeExcludeAvailability(state, includeTagIds, excludeTagIds)
  if (!availability.ok) return { unavailable: true, reason: availability.reason }
  if (state.session.simulateFailure) return { unavailable: true, reason: QUERY_FAIL_REASON }

  const includeParts: NodeEval[] = []
  for (const id of includeTagIds) {
    const tag = state.tags.find((item) => item.id === id)
    if (!tag) return { unavailable: true, reason: `标签 ${id} 不存在` }
    includeParts.push(evaluateTag(state, tag, computeAt, patientId))
  }
  const includeResult = combineAndLocal(includeParts)
  if (isBlocked(includeResult)) return includeResult
  if (includeResult === 'not_satisfy') return 'not_satisfy'

  for (const id of excludeTagIds) {
    const tag = state.tags.find((item) => item.id === id)
    if (!tag) return { unavailable: true, reason: `标签 ${id} 不存在` }
    const excluded = evaluateTag(state, tag, computeAt, patientId)
    if (isBlocked(excluded)) return excluded
    if (excluded === 'satisfy') return 'not_satisfy'
    if (excluded === 'unknown' && includeResult === 'satisfy') return 'unknown'
  }
  return includeResult
}

export type IncludeExcludeCompute =
  | { unavailableReason: string }
  | { hitPatientIds: string[]; computedAt: string }

export function computeIncludeExclude(
  state: AppState,
  includeTagIds: string[],
  excludeTagIds: string[],
  computeAt = state.clock,
): IncludeExcludeCompute {
  const availability = includeExcludeAvailability(state, includeTagIds, excludeTagIds)
  if (!availability.ok) return { unavailableReason: availability.reason }
  if (state.session.simulateFailure) return { unavailableReason: QUERY_FAIL_REASON }

  const hitPatientIds: string[] = []
  for (const patient of dataPartition(state).patients) {
    const result = evaluateIncludeExclude(state, includeTagIds, excludeTagIds, computeAt, patient.id)
    if (isBlocked(result)) return { unavailableReason: result.reason }
    if (result === 'satisfy') hitPatientIds.push(patient.id)
  }
  return { hitPatientIds, computedAt: computeAt }
}

function combineAndLocal(parts: NodeEval[]): NodeEval {
  if (parts.length === 0) return 'satisfy'
  const blocked = parts.find(isBlocked)
  if (blocked) return blocked
  const tris = parts as Array<'satisfy' | 'not_satisfy' | 'unknown'>
  if (tris.some((item) => item === 'not_satisfy')) return 'not_satisfy'
  if (tris.every((item) => item === 'satisfy')) return 'satisfy'
  return 'unknown'
}