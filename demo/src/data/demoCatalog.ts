import { shanghaiIso } from '../demo/clock'
import {
  BATCH_HISTORY_EYE_OP_ID,
  BATCH_HISTORY_LEGACY_ID,
  DEMO_COHORT_EYE_NAME,
  DEMO_COHORT_HEALTH_NAME,
  DEMO_OPEN_CHANNEL_NAME,
  DEMO_OPEN_EXPIRED_NAME,
  DEMO_OPEN_EXPORT_NAME,
  DEMO_OPEN_PUSH_NAME,
  DEMO_OPEN_SUB_NAME,
  DEMO_OPERATOR_ID,
  DEMO_SNAP_HEALTH_NAME,
  DEMO_SNAP_LEGACY_NAME,
  DEMO_SNAP_RECOG_NAME,
  INITIAL_HIT_PATIENT_IDS,
  SCOPE_HOSPITAL_ID,
  SYS_PATIENT_ID,
  TAG_ADULT_ID,
  TAG_EYE_OP_ID,
  TAG_LEGACY_FOLLOW_ID,
} from '../domain/ids'
import type { AppState, RemoveReasonCode, ReviewRecord, Snapshot } from '../domain/types'
import { buildTagRuleExplanation } from '../engine/evidence'
import { allocateDeliveryId, allocateOpenId, allocateReviewId, allocateSnapshotId } from '../store/allocate'
import { queryIncludeExclude, saveActiveSnapshot, saveDynamicCohort } from '../store/cohorts'
import { appendBatch, defaultOrgId, toSnapshotMembers } from '../store/compute'
import { buildSnapshotCsv } from '../store/csv'
import {
  downloadOpenCsv,
  enableOpenConfig,
  pauseOpenConfig,
  queryOpenConfig,
  saveOpenConfig,
} from '../store/open'

function must<T extends { ok: true } | { ok: false; reason: string }>(result: T, label: string): Extract<T, { ok: true }> {
  if (!result.ok) throw new Error(`${label}：${result.reason}`)
  return result as Extract<T, { ok: true }>
}

function phonesOf(state: AppState): Record<string, string | null> {
  return Object.fromEntries(state.patients.map((patient) => [patient.id, patient.phone]))
}

function seedConfirmedRecognition(
  state: AppState,
  input: {
    expectedBatchId: string
    tagId: string
    computedAt: string
    confirmedAt: string
    hitPatientIds: readonly string[]
    retainedPatientIds: readonly string[]
    snapshotName: string
    remove?: { patientId: string; reasonCode: RemoveReasonCode; reason: string }
  },
): AppState {
  const tag = state.tags.find((item) => item.id === input.tagId)
  if (!tag) throw new Error(`缺少标签 ${input.tagId}`)
  const appended = appendBatch(state, {
    kind: 'auto_recognition',
    computedAt: input.computedAt,
    tagId: tag.id,
    ruleExplanation: buildTagRuleExplanation(state, tag),
    patientIds: [...input.hitPatientIds],
    logics: [tag.logic],
  })
  if (appended.batch.id !== input.expectedBatchId) {
    throw new Error(`历史批次标识应为 ${input.expectedBatchId}，实际 ${appended.batch.id}`)
  }

  let reviewRecords: ReviewRecord[] = appended.state.reviewRecords
  if (input.remove) {
    reviewRecords = [
      ...reviewRecords,
      {
        id: allocateReviewId(appended.state),
        batchId: appended.batch.id,
        scopeId: state.currentScopeId,
        patientId: input.remove.patientId,
        action: 'remove',
        at: input.confirmedAt,
        by: state.operatorId,
        reasonCode: input.remove.reasonCode,
        reason: input.remove.reason,
        currentStatusSummary: '当前已不满足',
      },
    ]
  }

  const withReviews = { ...appended.state, reviewRecords }
  const snapshotId = allocateSnapshotId(withReviews)
  const snapshot: Snapshot = {
    id: snapshotId,
    name: input.snapshotName,
    type: 'snapshot',
    responsibleOrgId: defaultOrgId(state),
    sourceType: 'recognition',
    sourceBatchId: appended.batch.id,
    confirmedBy: state.operatorId,
    confirmedAt: input.confirmedAt,
    computedAt: input.computedAt,
    members: toSnapshotMembers(withReviews, [...input.retainedPatientIds], input.computedAt),
    scopeId: state.currentScopeId,
    ruleExplanation: structuredClone(appended.batch.ruleExplanation),
  }
  const confirmRecord: ReviewRecord = {
    id: allocateReviewId({ ...withReviews, snapshots: [...withReviews.snapshots, snapshot] }),
    batchId: appended.batch.id,
    scopeId: state.currentScopeId,
    action: 'confirm',
    at: input.confirmedAt,
    by: state.operatorId,
    snapshotId,
  }

  return {
    ...withReviews,
    snapshots: [...withReviews.snapshots, snapshot],
    reviewRecords: [...withReviews.reviewRecords, confirmRecord],
    batches: withReviews.batches.map((batch) =>
      batch.id === appended.batch.id
        ? {
            ...batch,
            scopeConfirmations: {
              ...batch.scopeConfirmations,
              [state.currentScopeId]: {
                scopeId: state.currentScopeId,
                status: 'confirmed',
                confirmedAt: input.confirmedAt,
                confirmedBy: state.operatorId,
                retainedCount: input.retainedPatientIds.length,
                snapshotId,
                zeroRetention: input.retainedPatientIds.length === 0,
              },
            },
          }
        : batch,
    ),
  }
}

function seedOpenConfigs(state: AppState): AppState {
  const recognitionSnapshot = state.snapshots.find((item) => item.name === DEMO_SNAP_RECOG_NAME)
  const healthSnapshot = state.snapshots.find((item) => item.name === DEMO_SNAP_HEALTH_NAME)
  const eyeCohort = state.dynamicCohorts.find((item) => item.name === DEMO_COHORT_EYE_NAME)
  const healthCohort = state.dynamicCohorts.find((item) => item.name === DEMO_COHORT_HEALTH_NAME)
  if (!recognitionSnapshot || !healthSnapshot || !eyeCohort || !healthCohort) {
    throw new Error('演示目录缺少人群或快照，无法配置数据开放')
  }

  const exportSaved = must(
    saveOpenConfig(state, {
      name: DEMO_OPEN_EXPORT_NAME,
      type: 'dataset_delivery',
      consumer: '眼科随访组',
      purpose: '眼科复诊随访名单一次性导出',
      description: '演示已启用的直接导出。授权已启用不表示对方已收到。',
      boundSnapshotId: recognitionSnapshot.id,
      method: 'direct_export',
      responsibleOrgId: defaultOrgId(state),
    }),
    '保存随访导出',
  )
  const exportEnabled = must(enableOpenConfig(exportSaved.state, exportSaved.id), '启用随访导出')
  const exported = must(downloadOpenCsv(exportEnabled.state, exportSaved.id), '预置随访导出下载记录')

  const channelSaved = must(
    saveOpenConfig(exported.state, {
      name: DEMO_OPEN_CHANNEL_NAME,
      type: 'dataset_delivery',
      consumer: '随访管理组',
      purpose: '通过已对接通道交付健康活动确认名单',
      boundSnapshotId: healthSnapshot.id,
      method: 'snapshot_channel',
      systemId: SYS_PATIENT_ID,
    }),
    '保存通道交付',
  )
  const channelEnabled = must(enableOpenConfig(channelSaved.state, channelSaved.id), '启用通道交付')
  const channelPaused = must(pauseOpenConfig(channelEnabled.state, channelSaved.id), '暂停通道交付')

  const subSaved = must(
    saveOpenConfig(channelPaused.state, {
      name: DEMO_OPEN_SUB_NAME,
      type: 'tag_subscription',
      consumer: '眼科随访组',
      purpose: '按需查询当前复诊随访人群',
      boundDynamicCohortId: eyeCohort.id,
      method: 'on_demand_query',
      systemId: SYS_PATIENT_ID,
    }),
    '保存复诊订阅',
  )
  const subEnabled = must(enableOpenConfig(subSaved.state, subSaved.id), '启用复诊订阅')
  const queried = must(queryOpenConfig(subEnabled.state, subSaved.id), '预置复诊订阅查询结果')

  const pushSaved = must(
    saveOpenConfig(queried.state, {
      name: DEMO_OPEN_PUSH_NAME,
      type: 'tag_subscription',
      consumer: '健康活动组织组',
      purpose: '健康活动通知名单定时推送（草稿，尚未启用）',
      boundDynamicCohortId: healthCohort.id,
      method: 'scheduled_full_push',
      systemId: SYS_PATIENT_ID,
      pushPeriodMinutes: 10080,
    }),
    '保存健康活动推送草稿',
  )

  const expiredId = allocateOpenId(pushSaved.state)
  const frozenCsv = buildSnapshotCsv(recognitionSnapshot, phonesOf(pushSaved.state))
  const expiredEnabledAt = shanghaiIso('2026-08-18', '10:00:00')
  const expiredUntil = shanghaiIso('2026-09-01', '00:00:00')
  const deliveryId = allocateDeliveryId(pushSaved.state)

  return {
    ...pushSaved.state,
    openConfigs: [
      ...pushSaved.state.openConfigs,
      {
        id: expiredId,
        name: DEMO_OPEN_EXPIRED_NAME,
        type: 'dataset_delivery',
        status: 'expired',
        consumer: '随访管理组',
        purpose: '上月随访名单一次性导出',
        description: '截止时间已过，下载已停止。调整期限后须人工恢复。',
        boundSnapshotId: recognitionSnapshot.id,
        method: 'direct_export',
        responsibleOrgId: defaultOrgId(pushSaved.state),
        scopeId: SCOPE_HOSPITAL_ID,
        validUntil: expiredUntil,
        enabledAt: expiredEnabledAt,
        pauseReasons: [],
        dependencyReasons: [],
        deliveryRecords: [
          {
            id: deliveryId,
            at: shanghaiIso('2026-08-18', '10:05:00'),
            by: DEMO_OPERATOR_ID,
            kind: 'download',
            patientCount: recognitionSnapshot.members.length,
          },
        ],
        frozenCsv,
        frozenCsvAt: shanghaiIso('2026-08-18', '10:05:00'),
        createdBy: DEMO_OPERATOR_ID,
        createdAt: expiredEnabledAt,
        updatedBy: DEMO_OPERATOR_ID,
        updatedAt: expiredUntil,
      },
    ],
  }
}

export function seedDemoCatalog(state: AppState): AppState {
  const previousEyeHits = [...INITIAL_HIT_PATIENT_IDS]
  const previousEyeRetained = previousEyeHits.filter((id) => id !== 'P-DEMO-002')

  let next = seedConfirmedRecognition(state, {
    expectedBatchId: BATCH_HISTORY_EYE_OP_ID,
    tagId: TAG_EYE_OP_ID,
    computedAt: shanghaiIso('2026-08-31', '08:00:00'),
    confirmedAt: shanghaiIso('2026-08-31', '11:20:00'),
    hitPatientIds: previousEyeHits,
    retainedPatientIds: previousEyeRetained,
    snapshotName: DEMO_SNAP_RECOG_NAME,
    remove: {
      patientId: 'P-DEMO-002',
      reasonCode: 'not_satisfy',
      reason: '当前已不满足',
    },
  })

  next = seedConfirmedRecognition(next, {
    expectedBatchId: BATCH_HISTORY_LEGACY_ID,
    tagId: TAG_LEGACY_FOLLOW_ID,
    computedAt: shanghaiIso('2026-08-24', '08:00:00'),
    confirmedAt: shanghaiIso('2026-08-24', '15:00:00'),
    hitPatientIds: state.patients.map((item) => item.id),
    retainedPatientIds: state.patients.map((item) => item.id),
    snapshotName: DEMO_SNAP_LEGACY_NAME,
  })

  const eyeQuery = must(queryIncludeExclude(next, [TAG_EYE_OP_ID], []), '计算复诊随访人群')
  const eyeSaved = must(
    saveDynamicCohort(next, {
      name: DEMO_COHORT_EYE_NAME,
      includeTagIds: [TAG_EYE_OP_ID],
      excludeTagIds: [],
      computed: {
        hitPatientIds: eyeQuery.hitPatientIds,
        computedAt: eyeQuery.computedAt,
        ruleExplanation: eyeQuery.ruleExplanation,
      },
    }),
    '保存复诊随访人群',
  )
  next = eyeSaved.state

  const healthQuery = must(queryIncludeExclude(next, [TAG_ADULT_ID], [TAG_EYE_OP_ID]), '计算健康活动圈选')
  const healthSaved = must(
    saveDynamicCohort(next, {
      name: DEMO_COHORT_HEALTH_NAME,
      includeTagIds: [TAG_ADULT_ID],
      excludeTagIds: [TAG_EYE_OP_ID],
      computed: {
        hitPatientIds: healthQuery.hitPatientIds,
        computedAt: healthQuery.computedAt,
        ruleExplanation: healthQuery.ruleExplanation,
      },
    }),
    '保存健康活动圈选',
  )
  next = healthSaved.state

  const healthSnap = must(
    saveActiveSnapshot(next, {
      name: DEMO_SNAP_HEALTH_NAME,
      includeTagIds: [TAG_ADULT_ID],
      excludeTagIds: [TAG_EYE_OP_ID],
      retainedPatientIds: healthQuery.hitPatientIds,
      computed: {
        hitPatientIds: healthQuery.hitPatientIds,
        computedAt: healthQuery.computedAt,
        ruleExplanation: healthQuery.ruleExplanation,
      },
    }),
    '保存健康活动确认名单',
  )

  return seedOpenConfigs(healthSnap.state)
}
