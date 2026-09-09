import { describe, expect, it } from 'vitest'
import { createInitialState } from '../data/seed'
import {
  BATCH_INITIAL_ID,
  SYS_LEGACY_ID,
  SYS_PATIENT_ID,
  TAG_ADULT_ID,
  TAG_EYE_OP_ID,
} from '../domain/ids'
import type { AppState, OpenConfig } from '../domain/types'
import { computeIncludeExclude } from '../engine/includeExclude'
import { buildSnapshotCsv, parseCsv, SNAPSHOT_CSV_COLUMNS } from './csv'
import {
  advanceToNextPush,
  consumerAfterSystemSelect,
  downloadOpenCsv,
  enableOpenConfig,
  openStatus,
  pauseOpenConfig,
  pushOpenConfig,
  queryOpenConfig,
  resumeOpenConfig,
  saveOpenConfig,
  computeSubscriptionResult,
} from './open'
import {
  confirmRecognitionBatch,
  deleteTag,
  disableConnectedSystem,
  disableTag,
  restoreConnectedSystem,
  restoreTag,
  saveActiveSnapshot,
  saveConnectedSystem,
  saveDynamicCohort,
  setClock,
  setSimulateFailure,
  updateDynamicCohortConditions,
} from './store'
import { queryIncludeExclude } from './cohorts'
import { addMinutes } from '../demo/clock'

const LI_QIANG = 'P-DEMO-002'
const ZHANG_MIN = 'P-DEMO-001'
const WU_PING = 'P-DEMO-008'

function mustConfirmSnapshot(state = createInitialState()) {
  const confirmed = confirmRecognitionBatch(state, BATCH_INITIAL_ID)
  expect(confirmed.ok).toBe(true)
  if (!confirmed.ok || !confirmed.snapshotId) throw new Error('确认快照失败')
  return { state: confirmed.state, snapshotId: confirmed.snapshotId }
}

function mustCohort(state: AppState, includeTagIds = [TAG_ADULT_ID], excludeTagIds = [TAG_EYE_OP_ID]) {
  const query = queryIncludeExclude(state, includeTagIds, excludeTagIds)
  expect(query.ok).toBe(true)
  if (!query.ok) throw new Error(query.reason)
  const saved = saveDynamicCohort(state, {
    name: '健康活动圈选',
    includeTagIds,
    excludeTagIds,
    computed: {
      hitPatientIds: query.hitPatientIds,
      computedAt: query.computedAt,
      ruleExplanation: query.ruleExplanation,
    },
  })
  expect(saved.ok).toBe(true)
  if (!saved.ok) throw new Error(saved.reason)
  return { state: saved.state, cohortId: saved.cohortId, query }
}

function configOf(state: AppState, id: string): OpenConfig {
  const config = state.openConfigs.find((item) => item.id === id)
  if (!config) throw new Error(`missing ${id}`)
  return config
}

describe('阶段4 数据开放附录场景', () => {
  it('无审批：草稿不可下载，启用后 CSV 与快照成员一致，重下载字节一致', () => {
    const { state, snapshotId } = mustConfirmSnapshot()
    const snapshot = state.snapshots.find((item) => item.id === snapshotId)
    expect(snapshot).toBeDefined()
    if (!snapshot) return

    const saved = saveOpenConfig(state, {
      name: '复诊随访导出',
      type: 'dataset_delivery',
      consumer: '眼科随访组',
      purpose: '随访触达',
      boundSnapshotId: snapshotId,
      method: 'direct_export',
    })
    expect(saved.ok).toBe(true)
    if (!saved.ok) return
    expect(openStatus(saved.state, configOf(saved.state, saved.id))).toBe('draft')
    const draftDownload = downloadOpenCsv(saved.state, saved.id)
    expect(draftDownload.ok).toBe(false)

    const enabled = enableOpenConfig(saved.state, saved.id)
    expect(enabled.ok).toBe(true)
    if (!enabled.ok) return
    expect(openStatus(enabled.state, configOf(enabled.state, saved.id))).toBe('enabled')

    const phones = Object.fromEntries(snapshot.members.map((member) => {
      const patient = enabled.state.patients.find((item) => item.id === member.patientId)
      return [member.patientId, patient?.phone ?? null]
    }))
    const generated = buildSnapshotCsv(snapshot, phones)
    expect(generated).toContain('\r\n')
    const rows = parseCsv(generated)
    expect(rows[0]).toEqual([...SNAPSHOT_CSV_COLUMNS])
    expect(rows.slice(1).map((row) => row[0])).toEqual(snapshot.members.map((item) => item.patientId))

    const first = downloadOpenCsv(enabled.state, saved.id)
    expect(first.ok).toBe(true)
    if (!first.ok) return
    expect(first.csv).toBe(generated)
    const parsed = parseCsv(first.csv)
    expect(parsed[0]).toEqual([...SNAPSHOT_CSV_COLUMNS])
    expect(parsed.slice(1).map((row) => row[0])).toEqual(snapshot.members.map((item) => item.patientId))

    const zhang = parsed.find((row) => row[0] === ZHANG_MIN)
    const li = parsed.find((row) => row[0] === LI_QIANG)
    expect(zhang?.[5]).toBe('DEMO-TEL-001')
    expect(li?.[5]).toBe('')

    const mutated = {
      ...first.state,
      patients: first.state.patients.map((patient) =>
        patient.id === ZHANG_MIN ? { ...patient, phone: 'DEMO-TEL-999' } : patient,
      ),
    }
    const second = downloadOpenCsv(mutated, saved.id)
    expect(second.ok).toBe(true)
    if (!second.ok) return
    expect(second.csv).toBe(first.csv)
  })

  it('联系方式：有电话原样，缺失留空（李强／吴平空，张敏 DEMO-TEL-001）', () => {
    const { state, snapshotId } = mustConfirmSnapshot()
    const snapshot = state.snapshots.find((item) => item.id === snapshotId)!
    const csv = buildSnapshotCsv(
      snapshot,
      Object.fromEntries(state.patients.map((patient) => [patient.id, patient.phone])),
    )
    const rows = parseCsv(csv)
    expect(rows[0]).toEqual([...SNAPSHOT_CSV_COLUMNS])
    expect(csv).toContain('\r\n')
    expect(rows.find((row) => row[0] === ZHANG_MIN)?.[5]).toBe('DEMO-TEL-001')
    expect(rows.find((row) => row[0] === LI_QIANG)?.[5]).toBe('')

    const cohort = mustCohort(state)
    const query = cohort.query
    const snap = saveActiveSnapshot(cohort.state, {
      name: '健康活动快照',
      includeTagIds: [TAG_ADULT_ID],
      excludeTagIds: [TAG_EYE_OP_ID],
      retainedPatientIds: query.hitPatientIds,
      computed: { hitPatientIds: query.hitPatientIds, computedAt: query.computedAt, ruleExplanation: query.ruleExplanation },
    })
    expect(snap.ok).toBe(true)
    if (!snap.ok) return
    const health = snap.state.snapshots.find((item) => item.id === snap.snapshotId)!
    const healthCsv = buildSnapshotCsv(
      health,
      Object.fromEntries(snap.state.patients.map((patient) => [patient.id, patient.phone])),
    )
    const healthRows = parseCsv(healthCsv)
    expect(healthRows.find((row) => row[0] === WU_PING)?.[5]).toBe('')
    expect(healthRows.find((row) => row[0] === LI_QIANG)?.[5]).toBe('')
  })

  it('默认使用方预填：空时选 SYS-PATIENT 带出眼科随访组；启用前可改为健康活动组织组', () => {
    const system = createInitialState().connectedSystems.find((item) => item.id === SYS_PATIENT_ID)!
    expect(consumerAfterSystemSelect('', system)).toBe('眼科随访组')
    const { state, cohortId } = mustCohort(createInitialState())
    const saved = saveOpenConfig(state, {
      name: '健康活动订阅',
      type: 'tag_subscription',
      consumer: consumerAfterSystemSelect('', system),
      purpose: '活动通知',
      boundDynamicCohortId: cohortId,
      method: 'on_demand_query',
      systemId: SYS_PATIENT_ID,
    })
    expect(saved.ok).toBe(true)
    if (!saved.ok) return
    expect(configOf(saved.state, saved.id).consumer).toBe('眼科随访组')
    const renamed = saveOpenConfig(saved.state, {
      id: saved.id,
      name: '健康活动订阅',
      type: 'tag_subscription',
      consumer: '健康活动组织组',
      purpose: '活动通知',
      boundDynamicCohortId: cohortId,
      method: 'on_demand_query',
      systemId: SYS_PATIENT_ID,
    })
    expect(renamed.ok).toBe(true)
    if (!renamed.ok) return
    const enabled = enableOpenConfig(renamed.state, saved.id)
    expect(enabled.ok).toBe(true)
    if (!enabled.ok) return
    expect(configOf(enabled.state, saved.id).consumer).toBe('健康活动组织组')
  })

  it('默认值不覆盖：先填健康活动组织组再选系统不被覆盖；启用后改系统默认使用方不回写', () => {
    const system = createInitialState().connectedSystems.find((item) => item.id === SYS_PATIENT_ID)!
    expect(consumerAfterSystemSelect('健康活动组织组', system)).toBe('健康活动组织组')
    const { state, cohortId } = mustCohort(createInitialState())
    const saved = saveOpenConfig(state, {
      name: '健康活动订阅',
      type: 'tag_subscription',
      consumer: consumerAfterSystemSelect('健康活动组织组', system),
      purpose: '活动通知',
      boundDynamicCohortId: cohortId,
      method: 'on_demand_query',
      systemId: SYS_PATIENT_ID,
    })
    expect(saved.ok).toBe(true)
    if (!saved.ok) return
    const enabled = enableOpenConfig(saved.state, saved.id)
    expect(enabled.ok).toBe(true)
    if (!enabled.ok) return
    const changed = saveConnectedSystem(enabled.state, {
      ...system,
      defaultConsumer: '随访管理组',
    })
    expect(changed.ok).toBe(true)
    if (!changed.ok) return
    expect(configOf(changed.state, saved.id).consumer).toBe('健康活动组织组')
    const locked = saveOpenConfig(changed.state, {
      id: saved.id,
      name: '健康活动订阅',
      type: 'tag_subscription',
      consumer: '随访管理组',
      purpose: '活动通知',
      boundDynamicCohortId: cohortId,
      method: 'on_demand_query',
      systemId: SYS_PATIENT_ID,
    })
    expect(locked.ok).toBe(true)
    if (!locked.ok) return
    expect(configOf(locked.state, saved.id).consumer).toBe('健康活动组织组')
  })

  it('有效期：推进时钟到期停止；延期本身不恢复，点恢复才可下载／查询', () => {
    const { state, snapshotId } = mustConfirmSnapshot()
    const until = addMinutes(state.clock, 60)
    const saved = saveOpenConfig(state, {
      name: '限期导出',
      type: 'dataset_delivery',
      consumer: '眼科随访组',
      purpose: '随访触达',
      boundSnapshotId: snapshotId,
      method: 'direct_export',
      validUntil: until,
    })
    expect(saved.ok).toBe(true)
    if (!saved.ok) return
    const enabled = enableOpenConfig(saved.state, saved.id)
    expect(enabled.ok).toBe(true)
    if (!enabled.ok) return
    const expired = setClock(enabled.state, until)
    expect(openStatus(expired, configOf(expired, saved.id))).toBe('expired')
    expect(downloadOpenCsv(expired, saved.id).ok).toBe(false)

    const extendedUntil = addMinutes(until, 24 * 60)
    const edited = saveOpenConfig(expired, {
      id: saved.id,
      name: '限期导出',
      type: 'dataset_delivery',
      consumer: '眼科随访组',
      purpose: '随访触达',
      boundSnapshotId: snapshotId,
      method: 'direct_export',
      validUntil: extendedUntil,
    })
    expect(edited.ok).toBe(true)
    if (!edited.ok) return
    expect(openStatus(edited.state, configOf(edited.state, saved.id))).toBe('expired')
    expect(configOf(edited.state, saved.id).pendingResumeAfterExpiry).toBe(true)
    expect(downloadOpenCsv(edited.state, saved.id).ok).toBe(false)

    const resumed = resumeOpenConfig(edited.state, saved.id)
    expect(resumed.ok).toBe(true)
    if (!resumed.ok) return
    expect(openStatus(resumed.state, configOf(resumed.state, saved.id))).toBe('enabled')
    expect(downloadOpenCsv(resumed.state, saved.id).ok).toBe(true)
  })

  it('多重暂停：人工暂停后停用再恢复标签仍暂停；系统停用再恢复须配置上人工恢复', () => {
    const { state, cohortId } = mustCohort(createInitialState())
    const saved = saveOpenConfig(state, {
      name: '健康活动订阅',
      type: 'tag_subscription',
      consumer: '健康活动组织组',
      purpose: '活动通知',
      boundDynamicCohortId: cohortId,
      method: 'on_demand_query',
      systemId: SYS_PATIENT_ID,
    })
    expect(saved.ok).toBe(true)
    if (!saved.ok) return
    const enabled = enableOpenConfig(saved.state, saved.id)
    expect(enabled.ok).toBe(true)
    if (!enabled.ok) return
    const paused = pauseOpenConfig(enabled.state, saved.id)
    expect(paused.ok).toBe(true)
    if (!paused.ok) return
    const disabledTag = disableTag(paused.state, TAG_ADULT_ID)
    const restoredTag = restoreTag(disabledTag, TAG_ADULT_ID)
    expect(openStatus(restoredTag, configOf(restoredTag, saved.id))).toBe('paused')
    expect(queryOpenConfig(restoredTag, saved.id).ok).toBe(false)

    const disabledSys = disableConnectedSystem(restoredTag, SYS_PATIENT_ID)
    expect(disabledSys.ok).toBe(true)
    if (!disabledSys.ok) return
    expect(configOf(disabledSys.state, saved.id).pauseReasons).toContain('系统停用')
    const restoredSys = restoreConnectedSystem(disabledSys.state, SYS_PATIENT_ID)
    expect(restoredSys.ok).toBe(true)
    if (!restoredSys.ok) return
    const afterSys = configOf(restoredSys.state, saved.id)
    expect(afterSys.pauseReasons).toContain('系统已恢复，待人工恢复')
    expect(afterSys.pauseReasons).toContain('人工暂停')
    expect(openStatus(restoredSys.state, afterSys)).toBe('paused')
    expect(queryOpenConfig(restoredSys.state, saved.id).ok).toBe(false)
    const resumed = resumeOpenConfig(restoredSys.state, saved.id)
    expect(resumed.ok).toBe(true)
    if (!resumed.ok) return
    expect(openStatus(resumed.state, configOf(resumed.state, saved.id))).toBe('enabled')
  })

  it('删除依赖：排除标签删除后订阅不能忽略排除、不能返回缓存', () => {
    const { state, cohortId, query } = mustCohort(createInitialState())
    const saved = saveOpenConfig(state, {
      name: '健康活动订阅',
      type: 'tag_subscription',
      consumer: '健康活动组织组',
      purpose: '活动通知',
      boundDynamicCohortId: cohortId,
      method: 'on_demand_query',
      systemId: SYS_PATIENT_ID,
    })
    expect(saved.ok).toBe(true)
    if (!saved.ok) return
    const enabled = enableOpenConfig(saved.state, saved.id)
    expect(enabled.ok).toBe(true)
    if (!enabled.ok) return
    const first = queryOpenConfig(enabled.state, saved.id)
    expect(first.ok).toBe(true)
    if (!first.ok) return
    expect(first.patientIds).toEqual(query.hitPatientIds)
    const version = first.resultVersion

    const disabled = disableTag(first.state, TAG_EYE_OP_ID)
    const deleted = deleteTag(disabled, TAG_EYE_OP_ID)
    expect(deleted.ok).toBe(true)
    if (!deleted.ok) return
    const blocked = queryOpenConfig(deleted.state, saved.id)
    expect(blocked.ok).toBe(false)
    if (blocked.ok) return
    expect(blocked.reason).toMatch(/删除|停用/)
    expect(configOf(deleted.state, saved.id).lastResult?.resultVersion).toBe(version)
    expect(configOf(deleted.state, saved.id).lastResult?.patientIds).toEqual(query.hitPatientIds)

    const computed = computeSubscriptionResult(deleted.state, saved.id)
    expect(computed.ok).toBe(false)
    const withoutExclude = computeIncludeExclude(deleted.state, [TAG_ADULT_ID], [])
    expect('hitPatientIds' in withoutExclude).toBe(true)
    if ('hitPatientIds' in withoutExclude) {
      expect(withoutExclude.hitPatientIds.length).toBeGreaterThan(query.hitPatientIds.length)
    }
  })

  it('条件变更：改动态排除条件显示关联，已发出结果不改写，下次计算用新条件', () => {
    const { state, cohortId, query } = mustCohort(createInitialState())
    const saved = saveOpenConfig(state, {
      name: '健康活动订阅',
      type: 'tag_subscription',
      consumer: '健康活动组织组',
      purpose: '活动通知',
      boundDynamicCohortId: cohortId,
      method: 'on_demand_query',
      systemId: SYS_PATIENT_ID,
    })
    expect(saved.ok).toBe(true)
    if (!saved.ok) return
    const enabled = enableOpenConfig(saved.state, saved.id)
    expect(enabled.ok).toBe(true)
    if (!enabled.ok) return
    const first = queryOpenConfig(enabled.state, saved.id)
    expect(first.ok).toBe(true)
    if (!first.ok) return
    const updated = updateDynamicCohortConditions(first.state, cohortId, {
      includeTagIds: [TAG_ADULT_ID],
      excludeTagIds: [],
    })
    expect(updated.ok).toBe(true)
    if (!updated.ok) return
    expect(configOf(updated.state, saved.id).lastResult?.patientIds).toEqual(query.hitPatientIds)
    const reused = queryOpenConfig(updated.state, saved.id)
    expect(reused.ok).toBe(true)
    if (!reused.ok) return
    expect(reused.reused).toBe(true)
    expect(reused.patientIds).toEqual(query.hitPatientIds)

    const later = setClock(reused.state, addMinutes(reused.state.clock, 1440))
    const next = queryOpenConfig(later, saved.id)
    expect(next.ok).toBe(true)
    if (!next.ok) return
    expect(next.reused).toBe(false)
    expect(next.patientIds.length).toBeGreaterThan(query.hitPatientIds.length)
    expect(next.computedAt).toBe(later.clock)
  })

  it('失败与零结果：失败不生成新结果；成功零人有版本和时间', () => {
    const zero = mustCohort(createInitialState(), [TAG_EYE_OP_ID], [TAG_ADULT_ID])
    const saved = saveOpenConfig(zero.state, {
      name: '零人订阅',
      type: 'tag_subscription',
      consumer: '健康活动组织组',
      purpose: '核验',
      boundDynamicCohortId: zero.cohortId,
      method: 'on_demand_query',
      systemId: SYS_PATIENT_ID,
    })
    expect(saved.ok).toBe(true)
    if (!saved.ok) return
    const enabled = enableOpenConfig(saved.state, saved.id)
    expect(enabled.ok).toBe(true)
    if (!enabled.ok) return
    const failed = queryOpenConfig(setSimulateFailure(enabled.state, true), saved.id)
    expect(failed.ok).toBe(false)
    expect(configOf(enabled.state, saved.id).lastResult).toBeUndefined()

    const computed = computeSubscriptionResult(enabled.state, saved.id)
    expect(computed.ok).toBe(true)
    if (!computed.ok) return
    expect(computed.patientIds).toEqual([])

    const zeroQuery = queryOpenConfig(enabled.state, saved.id)
    expect(zeroQuery.ok).toBe(true)
    if (!zeroQuery.ok) return
    expect(zeroQuery.patientIds).toEqual([])
    expect(zeroQuery.resultVersion).toMatch(/^RV-/)
    expect(zeroQuery.computedAt).toBe(enabled.state.clock)
    expect(configOf(zeroQuery.state, saved.id).lastResult?.patientIds).toEqual([])
  })

  it('来源标签删除后旧快照仍可新建交付并下载', () => {
    const { state, snapshotId } = mustConfirmSnapshot()
    const disabled = disableTag(state, TAG_EYE_OP_ID)
    const deleted = deleteTag(disabled, TAG_EYE_OP_ID)
    expect(deleted.ok).toBe(true)
    if (!deleted.ok) return
    const saved = saveOpenConfig(deleted.state, {
      name: '历史快照导出',
      type: 'dataset_delivery',
      consumer: '眼科随访组',
      purpose: '历史随访',
      boundSnapshotId: snapshotId,
      method: 'direct_export',
    })
    expect(saved.ok).toBe(true)
    if (!saved.ok) return
    const enabled = enableOpenConfig(saved.state, saved.id)
    expect(enabled.ok).toBe(true)
    if (!enabled.ok) return
    const downloaded = downloadOpenCsv(enabled.state, saved.id)
    expect(downloaded.ok).toBe(true)
    if (!downloaded.ok) return
    const snapshot = enabled.state.snapshots.find((item) => item.id === snapshotId)!
    const generated = buildSnapshotCsv(
      snapshot,
      Object.fromEntries(enabled.state.patients.map((patient) => [patient.id, patient.phone])),
    )
    expect(downloaded.csv).toBe(generated)
    expect(parseCsv(downloaded.csv)[0]).toEqual([...SNAPSHOT_CSV_COLUMNS])
  })

  it('定时推送：首次时点=启用+周期，未到时点不能推送，推进后现算且不宣称发送', () => {
    const { state, cohortId, query } = mustCohort(createInitialState())
    const saved = saveOpenConfig(state, {
      name: '健康活动推送',
      type: 'tag_subscription',
      consumer: '健康活动组织组',
      purpose: '活动通知',
      boundDynamicCohortId: cohortId,
      method: 'scheduled_full_push',
      systemId: SYS_PATIENT_ID,
      pushPeriodMinutes: 10080,
    })
    expect(saved.ok).toBe(true)
    if (!saved.ok) return
    const enabled = enableOpenConfig(saved.state, saved.id)
    expect(enabled.ok).toBe(true)
    if (!enabled.ok) return
    const config = configOf(enabled.state, saved.id)
    expect(config.nextPushAt).toBe(addMinutes(enabled.state.clock, 10080))
    expect(pushOpenConfig(enabled.state, saved.id).ok).toBe(false)
    const advanced = advanceToNextPush(enabled.state, saved.id)
    expect(advanced.ok).toBe(true)
    if (!advanced.ok) return
    expect(advanced.patientIds).toEqual(query.hitPatientIds)
    expect(advanced.resultVersion).toMatch(/^RV-/)
    expect(advanced.state.clock).toBe(config.nextPushAt)
    const computed = computeSubscriptionResult(advanced.state, saved.id)
    expect(computed.ok).toBe(true)
    if (!computed.ok) return
    expect(computed.patientIds).toEqual(advanced.patientIds)
  })

  it('停用系统不可启用通道交付；SYS-LEGACY 保持停用', () => {
    const { state, snapshotId } = mustConfirmSnapshot()
    const saved = saveOpenConfig(state, {
      name: '旧通道',
      type: 'dataset_delivery',
      consumer: '随访管理组',
      purpose: '通道',
      boundSnapshotId: snapshotId,
      method: 'snapshot_channel',
      systemId: SYS_LEGACY_ID,
    })
    expect(saved.ok).toBe(true)
    if (!saved.ok) return
    const enabled = enableOpenConfig(saved.state, saved.id)
    expect(enabled.ok).toBe(false)
    if (enabled.ok) return
    expect(enabled.reason).toMatch(/停用/)
  })
})
