export const HOSPITAL_TIME_ZONE = 'Asia/Shanghai'
export const DEFAULT_DEMO_CLOCK = '2026-09-07T11:00:00+08:00'
export const DEMO_OPERATOR_ID = 'DEMO-OP'
export const DEMO_OPERATOR_NAME = '演示经办人'

export const SCOPE_HOSPITAL_ID = 'SCOPE-HOSPITAL'

export const ORG_INFO_ID = 'ORG-INFO'
export const ORG_EYE_ID = 'ORG-EYE'

export const TAG_EYE_HIGH_ID = 'TAG-EYE-HIGH'
export const TAG_ADULT_ID = 'TAG-ADULT'
export const TAG_EYE_OP_ID = 'TAG-EYE-OP'
export const TAG_DRY_CANDIDATE_ID = 'TAG-DRY-CANDIDATE'
export const TAG_LEGACY_FOLLOW_ID = 'TAG-LEGACY-FOLLOW'

export const BATCH_INITIAL_ID = 'B-20260907-0800'
export const BATCH_HISTORY_EYE_OP_ID = 'B-20260831-0800'
export const BATCH_HISTORY_LEGACY_ID = 'B-20260824-0800'

export const DEMO_COHORT_EYE_NAME = '眼科复诊随访人群'
export const DEMO_COHORT_HEALTH_NAME = '健康活动圈选'
export const DEMO_SNAP_RECOG_NAME = '眼科复诊运营筛选识别确认'
export const DEMO_SNAP_LEGACY_NAME = '旧版随访筛查识别确认'
export const DEMO_SNAP_HEALTH_NAME = '健康活动确认名单'
export const DEMO_OPEN_EXPORT_NAME = '眼科复诊随访导出'
export const DEMO_OPEN_CHANNEL_NAME = '随访通道交付'
export const DEMO_OPEN_SUB_NAME = '复诊人群订阅'
export const DEMO_OPEN_PUSH_NAME = '健康活动定时推送'
export const DEMO_OPEN_EXPIRED_NAME = '上月随访导出'

export const MET_AGE_ID = 'MET-AGE'
export const MET_DEPT_ID = 'MET-DEPT'
export const MET_VISIT_TIME_ID = 'MET-VISIT-TIME'
export const MET_EYE_SCORE_ID = 'MET-EYE-SCORE'
export const MET_SYMPTOM_ID = 'MET-SYMPTOM'
export const MET_EYE_AVG_30_ID = 'MET-EYE-AVG-30'

export const DS_PATIENT_ID = 'DS-PATIENT'
export const DS_ENCOUNTER_ID = 'DS-ENCOUNTER'
export const DS_EYE_ASSESSMENT_ID = 'DS-EYE-ASSESSMENT'

export const SYS_PATIENT_ID = 'SYS-PATIENT'
export const SYS_LEGACY_ID = 'SYS-LEGACY'

export const MAIN_STORY_PATIENT_IDS = [
  'P-DEMO-001',
  'P-DEMO-002',
  'P-DEMO-003',
  'P-DEMO-004',
  'P-DEMO-005',
  'P-DEMO-006',
  'P-DEMO-007',
  'P-DEMO-008',
] as const

export const INITIAL_HIT_PATIENT_IDS = [
  'P-DEMO-001',
  'P-DEMO-002',
  'P-DEMO-003',
  'P-DEMO-004',
  'P-DEMO-005',
  'P-DEMO-006',
] as const

export function nextStableId(prefix: string, used: Iterable<string>): string {
  const taken = new Set(used)
  for (let index = 1; index < 10000; index += 1) {
    const id = `${prefix}-${String(index).padStart(3, '0')}`
    if (!taken.has(id)) return id
  }
  throw new Error(`无法分配稳定标识: ${prefix}`)
}
