import { addMinutes, shanghaiIso } from '../demo/clock'
import {
  BATCH_INITIAL_ID,
  DEFAULT_DEMO_CLOCK,
  DEMO_OPERATOR_ID,
  DS_ENCOUNTER_ID,
  DS_EYE_ASSESSMENT_ID,
  DS_PATIENT_ID,
  INITIAL_HIT_PATIENT_IDS,
  MET_AGE_ID,
  MET_DEPT_ID,
  MET_EYE_AVG_30_ID,
  MET_EYE_SCORE_ID,
  MET_SYMPTOM_ID,
  MET_VISIT_TIME_ID,
  ORG_INFO_ID,
  SCOPE_HOSPITAL_ID,
  SYS_LEGACY_ID,
  SYS_PATIENT_ID,
  TAG_ADULT_ID,
  TAG_EYE_HIGH_ID,
  TAG_EYE_OP_ID,
} from '../domain/ids'
import type {
  AppState,
  Batch,
  ButtonPermissionKey,
  ConnectedSystem,
  Dataset,
  DemoPermissions,
  Encounter,
  EvidenceSlot,
  EyeAssessment,
  Hit,
  Metric,
  ModuleKey,
  Patient,
  PatientScope,
  RuleLogic,
  Tag,
} from '../domain/types'
import { createDictionaries } from './dictionaries'
import { createRuleSamples } from './ruleSamples'

const MODULE_KEYS: ModuleKey[] = ['workbench', 'tags', 'recognition', 'cohorts', 'open', 'analytics', 'admin']
const BUTTON_KEYS: ButtonPermissionKey[] = [
  'tagCreate',
  'tagEdit',
  'tagTrial',
  'tagPublish',
  'tagDisable',
  'tagDelete',
  'tagAutoRecognition',
  'recognitionConfirm',
  'cohortCreate',
  'cohortEdit',
  'cohortRefresh',
  'cohortSnapshot',
  'openCreate',
  'openEdit',
  'openEnable',
  'openPause',
  'openResume',
  'openExport',
  'metricMaintain',
  'systemMaintain',
]

export function defaultPermissions(): DemoPermissions {
  return {
    modules: Object.fromEntries(MODULE_KEYS.map((key) => [key, true])) as Record<ModuleKey, boolean>,
    buttons: Object.fromEntries(BUTTON_KEYS.map((key) => [key, true])) as Record<ButtonPermissionKey, boolean>,
  }
}

function visitTimeFromEncounterId(encounterId: string): string {
  const match = encounterId.match(/V-(\d{4})(\d{2})(\d{2})-/)
  const year = match?.[1]
  const month = match?.[2]
  const day = match?.[3]
  if (!year || !month || !day) {
    throw new Error(`无法从就诊标识解析业务日期: ${encounterId}`)
  }
  return shanghaiIso(`${year}-${month}-${day}`, '09:00:00')
}

function observationId(patientTail: string, ymd: string, seq: number): string {
  return `O-${patientTail}-${ymd}-${seq}`
}

function createDatasets(): Dataset[] {
  return [
    {
      id: DS_PATIENT_ID,
      name: '患者基本信息',
      source: 'CDR',
      tableName: 'cdr_patient',
      grain: '患者',
      fields: [
        { name: 'patient_id', label: '主患者标识', valueType: 'text', description: '跨系统统一身份标识' },
        { name: 'name', label: '姓名', valueType: 'text', description: '属于 cdr_patient' },
        { name: 'age', label: '年龄', valueType: 'integer', description: '患者属性，直接比较' },
        { name: 'sex', label: '性别', valueType: 'enum', description: '男／女' },
        { name: 'phone', label: '联系电话', valueType: 'text', description: '虚构演示号码，非真实号码' },
      ],
      associations: { patient: 'patient_id', encounter: null, record: 'patient_id', time: null },
    },
    {
      id: DS_ENCOUNTER_ID,
      name: '门诊就诊记录',
      source: 'CDR',
      tableName: 'cdr_encounter',
      grain: '就诊',
      fields: [
        { name: 'patient_id', label: '主患者标识', valueType: 'text', description: '关联患者' },
        { name: 'encounter_id', label: '就诊标识', valueType: 'text', description: '一次就诊' },
        { name: 'department', label: '就诊科室', valueType: 'enum', description: '就诊枚举' },
        { name: 'visit_time', label: '就诊时间', valueType: 'datetime', description: '就诊业务时间' },
        { name: 'diagnosis', label: '诊断', valueType: 'text', description: '就诊诊断摘要' },
      ],
      associations: {
        patient: 'patient_id',
        encounter: 'encounter_id',
        record: 'encounter_id',
        time: 'visit_time',
      },
    },
    {
      id: DS_EYE_ASSESSMENT_ID,
      name: '眼表评估记录',
      source: '时序库',
      tableName: 'ts_eye_assessment',
      grain: '采集',
      fields: [
        { name: 'patient_id', label: '主患者标识', valueType: 'text', description: '关联患者' },
        { name: 'encounter_id', label: '就诊标识', valueType: 'text', description: '可空，关联当次就诊' },
        { name: 'observation_id', label: '观察标识', valueType: 'text', description: '一次采集' },
        { name: 'observed_at', label: '观察业务时间', valueType: 'datetime', description: '按此字段排序' },
        { name: 'score', label: '眼表评分', valueType: 'number', description: '单位分' },
        { name: 'symptom', label: '不适症状', valueType: 'boolean', description: '同 observation_id 关联，不属于 cdr_patient' },
      ],
      associations: {
        patient: 'patient_id',
        encounter: 'encounter_id',
        record: 'observation_id',
        time: 'observed_at',
      },
    },
  ]
}

function createMetrics(): Metric[] {
  return [
    {
      id: MET_AGE_ID,
      name: '患者年龄',
      catalog: '患者属性',
      kind: 'field_binding',
      status: 'active',
      binding: { datasetId: DS_PATIENT_ID, tableName: 'cdr_patient', field: 'age' },
      valueType: 'integer',
      grain: '患者',
      patientKey: 'patient_id',
      comparable: true,
      applicableJudgments: ['direct_compare'],
      validityNote: '患者属性当前值',
      dedupeNote: '按主患者标识',
    },
    {
      id: MET_DEPT_ID,
      name: '就诊科室',
      catalog: '就诊记录',
      kind: 'field_binding',
      status: 'active',
      binding: { datasetId: DS_ENCOUNTER_ID, tableName: 'cdr_encounter', field: 'department' },
      valueType: 'enum',
      grain: '就诊',
      businessTimeField: 'visit_time',
      patientKey: 'patient_id',
      observationKey: 'encounter_id',
      sortField: 'visit_time',
      enumValues: ['眼科', '全科'],
      comparable: true,
      applicableJudgments: ['latest', 'exists', 'count', 'zero_records'],
      validityNote: '撤销记录不参与',
      dedupeNote: '按就诊标识',
    },
    {
      id: MET_VISIT_TIME_ID,
      name: '就诊时间',
      catalog: '就诊记录',
      kind: 'field_binding',
      status: 'active',
      binding: { datasetId: DS_ENCOUNTER_ID, tableName: 'cdr_encounter', field: 'visit_time' },
      valueType: 'datetime',
      grain: '就诊',
      businessTimeField: 'visit_time',
      patientKey: 'patient_id',
      observationKey: 'encounter_id',
      sortField: 'visit_time',
      comparable: true,
      applicableJudgments: ['latest', 'exists'],
      validityNote: '业务时间须不晚于计算时点且已入库',
      dedupeNote: '按就诊标识',
    },
    {
      id: MET_EYE_SCORE_ID,
      name: '眼表评分',
      catalog: '眼表评估',
      kind: 'field_binding',
      status: 'active',
      binding: { datasetId: DS_EYE_ASSESSMENT_ID, tableName: 'ts_eye_assessment', field: 'score' },
      valueType: 'number',
      unit: '分',
      grain: '采集',
      businessTimeField: 'observed_at',
      patientKey: 'patient_id',
      observationKey: 'observation_id',
      sortField: 'observed_at',
      comparable: true,
      applicableJudgments: [
        'latest',
        'exists',
        'count',
        'recent_n',
        'consecutive_dates',
        'first_abnormal',
        'change',
      ],
      validityNote: '无法判断的采集不计次；修订以同观察最新入库项为准',
      dedupeNote: '按 observation_id；并列时间按指标声明，主故事无同一业务时刻冲突',
    },
    {
      id: MET_SYMPTOM_ID,
      name: '不适症状',
      catalog: '眼表评估',
      kind: 'field_binding',
      status: 'active',
      binding: { datasetId: DS_EYE_ASSESSMENT_ID, tableName: 'ts_eye_assessment', field: 'symptom' },
      valueType: 'boolean',
      grain: '采集',
      businessTimeField: 'observed_at',
      patientKey: 'patient_id',
      observationKey: 'observation_id',
      associatedObservationKey: 'observation_id',
      sortField: 'observed_at',
      comparable: true,
      applicableJudgments: ['latest', 'exists'],
      validityNote: '与评分同 observation_id 关联',
      dedupeNote: '按 observation_id',
    },
    {
      id: MET_EYE_AVG_30_ID,
      name: '近 30 天平均眼表评分',
      catalog: '衍生指标',
      kind: 'derived',
      status: 'active',
      derived: {
        function: 'avg',
        inputMetricIds: [MET_EYE_SCORE_ID],
        windowDays: 30,
        formula: '平均值(眼表评分, 30 天)',
        resultUnit: '分',
      },
      valueType: 'number',
      unit: '分',
      grain: '患者',
      patientKey: 'patient_id',
      comparable: true,
      applicableJudgments: ['direct_compare'],
      validityNote: '空集合无法判断均值，不能声称平均 0',
      dedupeNote: '统计前按观察去重并排除无效值',
    },
  ]
}

function createPatients(): Patient[] {
  return [
    { id: 'P-DEMO-001', name: '张敏', sex: '女', age: 56, phone: 'DEMO-TEL-001' },
    { id: 'P-DEMO-002', name: '李强', sex: '男', age: 61, phone: null },
    { id: 'P-DEMO-003', name: '王芳', sex: '女', age: 48, phone: 'DEMO-TEL-003' },
    { id: 'P-DEMO-004', name: '赵洋', sex: '男', age: 52, phone: 'DEMO-TEL-004' },
    { id: 'P-DEMO-005', name: '陈晨', sex: '女', age: 44, phone: 'DEMO-TEL-005' },
    { id: 'P-DEMO-006', name: '周宁', sex: '男', age: 67, phone: 'DEMO-TEL-006' },
    { id: 'P-DEMO-007', name: '林晓', sex: '女', age: 35, phone: 'DEMO-TEL-007' },
    { id: 'P-DEMO-008', name: '吴平', sex: '男', age: 40, phone: null },
  ]
}

function createEncounters(): Encounter[] {
  const rows: Array<[string, string, string, string]> = [
    ['V-20260820-011', 'P-DEMO-001', '眼科', '眼表评估随访'],
    ['V-20260820-018', 'P-DEMO-002', '眼科', '眼表评估随访'],
    ['V-20260821-004', 'P-DEMO-003', '眼科', '眼表评估随访'],
    ['V-20260822-009', 'P-DEMO-004', '眼科', '眼表评估随访'],
    ['V-20260822-021', 'P-DEMO-005', '眼科', '眼表评估随访'],
    ['V-20260824-002', 'P-DEMO-006', '眼科', '眼表评估随访'],
    ['V-20260825-007', 'P-DEMO-007', '全科', '全科门诊'],
    ['V-20260825-008', 'P-DEMO-008', '全科', '全科门诊'],
  ]
  return rows.map(([id, patientId, department, diagnosis]) => ({
    id,
    patientId,
    department,
    visitTime: visitTimeFromEncounterId(id),
    diagnosis,
  }))
}

function eyeAssessment(
  patientId: string,
  encounterId: string | null,
  observedAt: string,
  score: number | null,
  seq = 1,
): EyeAssessment {
  const tail = patientId.slice(-3)
  const ymd = observedAt.slice(0, 10).replaceAll('-', '')
  return {
    observationId: observationId(tail, ymd, seq),
    patientId,
    encounterId,
    observedAt,
    ingestedAt: addMinutes(observedAt, 1),
    score,
    symptom: false,
    revoked: false,
    unjudgeable: false,
  }
}

function createObservations(encounters: Encounter[]): EyeAssessment[] {
  const encounterOf = (patientId: string) => encounters.find((item) => item.patientId === patientId)?.id ?? null
  const triggerAt = (encounterId: string) => addMinutes(visitTimeFromEncounterId(encounterId), 30)

  const triggerScores: Array<[string, number]> = [
    ['P-DEMO-001', 16],
    ['P-DEMO-002', 18],
    ['P-DEMO-003', 15],
    ['P-DEMO-004', 12],
    ['P-DEMO-005', 11],
    ['P-DEMO-006', 13],
    ['P-DEMO-007', 5],
  ]

  const triggerRows = triggerScores.map(([patientId, score]) => {
    const encounterId = encounterOf(patientId)
    if (!encounterId) {
      throw new Error(`主故事患者缺少就诊: ${patientId}`)
    }
    return eyeAssessment(patientId, encounterId, triggerAt(encounterId), score, 1)
  })

  const laterRows: EyeAssessment[] = [
    eyeAssessment('P-DEMO-001', null, shanghaiIso('2026-09-07', '09:00:00'), 14, 1),
    eyeAssessment('P-DEMO-002', null, shanghaiIso('2026-09-07', '10:00:00'), 7, 1),
  ]

  return [...triggerRows, ...laterRows]
}

function adultLogic(): RuleLogic {
  return {
    kind: 'condition',
    id: 'cond-adult-age',
    metricId: MET_AGE_ID,
    judgment: { type: 'direct_compare', op: 'gte', value: 18 },
  }
}

function eyeHighLogic(): RuleLogic {
  return {
    kind: 'condition',
    id: 'cond-eye-high-latest',
    metricId: MET_EYE_SCORE_ID,
    judgment: {
      type: 'latest',
      window: { kind: 'relative_days', days: 90 },
      op: 'gte',
      value: 10,
    },
  }
}

function eyeOpLogic(): RuleLogic {
  return {
    kind: 'group',
    id: 'group-eye-op-root',
    operator: 'and',
    children: [
      { kind: 'tag_ref', id: 'ref-eye-high', tagId: TAG_EYE_HIGH_ID },
      { kind: 'tag_ref', id: 'ref-adult', tagId: TAG_ADULT_ID },
      {
        kind: 'condition',
        id: 'cond-eye-dept-exists',
        metricId: MET_DEPT_ID,
        judgment: {
          type: 'exists',
          window: { kind: 'relative_days', days: 90 },
          filter: { op: 'eq', value: '眼科' },
        },
      },
    ],
  }
}

function createTags(): Tag[] {
  const stamp = shanghaiIso('2026-09-01', '09:00:00')
  return [
    {
      id: TAG_EYE_HIGH_ID,
      name: '眼表评分偏高',
      type: 'basic',
      category: '评估结果',
      status: 'published',
      responsibleOrgId: ORG_INFO_ID,
      autoRecognitionEnabled: false,
      logic: eyeHighLogic(),
      createdBy: DEMO_OPERATOR_ID,
      createdAt: stamp,
      updatedBy: DEMO_OPERATOR_ID,
      updatedAt: stamp,
    },
    {
      id: TAG_ADULT_ID,
      name: '成年患者',
      type: 'basic',
      category: '基本属性',
      status: 'published',
      responsibleOrgId: ORG_INFO_ID,
      autoRecognitionEnabled: false,
      logic: adultLogic(),
      createdBy: DEMO_OPERATOR_ID,
      createdAt: stamp,
      updatedBy: DEMO_OPERATOR_ID,
      updatedAt: stamp,
    },
    {
      id: TAG_EYE_OP_ID,
      name: '眼科复诊运营筛选',
      type: 'composite',
      category: '组合筛选',
      status: 'published',
      responsibleOrgId: ORG_INFO_ID,
      autoRecognitionEnabled: true,
      autoRecognitionIntervalDays: 7,
      logic: eyeOpLogic(),
      createdBy: DEMO_OPERATOR_ID,
      createdAt: stamp,
      updatedBy: DEMO_OPERATOR_ID,
      updatedAt: stamp,
    },
  ]
}

function latestEligibleObservation(
  observations: EyeAssessment[],
  patientId: string,
  computedAt: string,
): EyeAssessment | undefined {
  return observations
    .filter(
      (item) =>
        item.patientId === patientId &&
        !item.revoked &&
        !item.unjudgeable &&
        item.score !== null &&
        item.ingestedAt <= computedAt &&
        item.observedAt <= computedAt,
    )
    .sort((a, b) => (a.observedAt < b.observedAt ? 1 : -1))[0]
}

function latestEncounter(encounters: Encounter[], patientId: string, computedAt: string): Encounter | undefined {
  return encounters
    .filter((item) => item.patientId === patientId && item.visitTime <= computedAt)
    .sort((a, b) => (a.visitTime < b.visitTime ? 1 : -1))[0]
}

function createInitialBatch(
  patients: Patient[],
  encounters: Encounter[],
  observations: EyeAssessment[],
  tags: Tag[],
): { batch: Batch; hits: Hit[] } {
  const computedAt = shanghaiIso('2026-09-07', '08:00:00')
  const tag = tags.find((item) => item.id === TAG_EYE_OP_ID)
  if (!tag) {
    throw new Error('缺少眼科复诊运营筛选标签')
  }

  const batch: Batch = {
    id: BATCH_INITIAL_ID,
    tagId: TAG_EYE_OP_ID,
    kind: 'auto_recognition',
    computedAt,
    scopeConfirmations: {
      [SCOPE_HOSPITAL_ID]: { scopeId: SCOPE_HOSPITAL_ID, status: 'pending' },
    },
    ruleExplanation: {
      sourceType: 'tag',
      tagId: tag.id,
      tagName: tag.name,
      logicSummary: '引用「眼表评分偏高」且引用「成年患者」且近 90 天存在眼科就诊',
      expandedLogic: structuredClone(tag.logic),
    },
  }

  const hits: Hit[] = INITIAL_HIT_PATIENT_IDS.map((patientId) => {
    const patient = patients.find((item) => item.id === patientId)
    const observation = latestEligibleObservation(observations, patientId, computedAt)
    const encounter = latestEncounter(encounters, patientId, computedAt)
    if (!patient || !observation || observation.score === null || !encounter) {
      throw new Error(`初始批次无法从对象装配命中证据: ${patientId}`)
    }
    const slots: EvidenceSlot[] = [
      {
        role: 'age',
        metricId: MET_AGE_ID,
        patientId,
        value: patient.age,
        businessTime: computedAt,
        sourceTable: 'cdr_patient',
      },
      {
        role: 'latest_eye_score',
        metricId: MET_EYE_SCORE_ID,
        patientId,
        value: observation.score,
        businessTime: observation.observedAt,
        ingestedAt: observation.ingestedAt,
        observationId: observation.observationId,
        encounterId: observation.encounterId ?? undefined,
        sourceTable: 'ts_eye_assessment',
      },
      {
        role: 'ophthalmology_visit',
        metricId: MET_DEPT_ID,
        patientId,
        value: encounter.department,
        businessTime: encounter.visitTime,
        encounterId: encounter.id,
        sourceTable: 'cdr_encounter',
      },
    ]
    return {
      id: `HIT-${BATCH_INITIAL_ID}-${patientId}`,
      batchId: BATCH_INITIAL_ID,
      tagId: TAG_EYE_OP_ID,
      patientId,
      computedAt,
      slots,
    }
  })

  return { batch, hits }
}

function createConnectedSystems(): ConnectedSystem[] {
  const lastValidatedAt = shanghaiIso('2026-09-01', '09:00:00')
  return [
    {
      id: SYS_PATIENT_ID,
      name: '患者服务系统',
      code: 'SYS-PATIENT',
      defaultConsumer: '眼科随访组',
      status: 'available',
      methods: ['snapshot_channel', 'on_demand_query', 'scheduled_full_push'],
      queryMinIntervalMinutes: 1440,
      pushPeriodMinutes: [10080],
      channelId: 'DEMO-CHANNEL-001',
      responsibleOrgId: ORG_INFO_ID,
      businessContact: '演示业务联系人',
      techContact: '演示技术联系人',
      lastValidatedAt,
    },
    {
      id: SYS_LEGACY_ID,
      name: '旧随访接口',
      code: 'SYS-LEGACY',
      defaultConsumer: '随访管理组',
      status: 'disabled',
      methods: ['snapshot_channel', 'scheduled_full_push'],
      pushPeriodMinutes: [10080],
      channelId: 'DEMO-CHANNEL-002',
      responsibleOrgId: ORG_INFO_ID,
      businessContact: '演示业务联系人',
      techContact: '演示技术联系人',
      lastValidatedAt,
    },
  ]
}

function createPatientScope(): PatientScope {
  return {
    id: SCOPE_HOSPITAL_ID,
    name: '全院',
    includesUnassignedArchives: false,
    description: '各院区就诊归属的并集，不含无院区就诊的建档对象。P0 固定全院，无范围编辑。',
  }
}

export function createInitialState(): AppState {
  const patients = createPatients()
  const encounters = createEncounters()
  const observations = createObservations(encounters)
  const tags = createTags()
  const { batch, hits } = createInitialBatch(patients, encounters, observations, tags)
  const events = encounters.map((encounter) => ({
    id: `EVT-${encounter.id}`,
    patientId: encounter.patientId,
    type: '门诊就诊' as const,
    occurredAt: encounter.visitTime,
    ingestedAt: addMinutes(encounter.visitTime, 1),
    encounterId: encounter.id,
  }))

  return {
    clock: DEFAULT_DEMO_CLOCK,
    currentScopeId: SCOPE_HOSPITAL_ID,
    operatorId: DEMO_OPERATOR_ID,
    dictionaries: createDictionaries(),
    datasets: createDatasets(),
    metrics: createMetrics(),
    patients,
    encounters,
    observations,
    events,
    tags,
    batches: [batch],
    hits,
    dynamicCohorts: [],
    snapshots: [],
    reviewRecords: [],
    openConfigs: [],
    connectedSystems: createConnectedSystems(),
    patientScope: createPatientScope(),
    ruleSamples: createRuleSamples(),
    session: {
      mode: 'business',
      ruleSampleWorkingCopy: null,
      simulateFailure: false,
      permissions: defaultPermissions(),
    },
    retiredIds: [],
  }
}
