export type Sex = '男' | '女'

export type TagType = 'basic' | 'composite'
export type TagStatus = 'draft' | 'published' | 'manually_disabled' | 'deleted'
export type TagCategory = '基本属性' | '就诊特征' | '评估结果' | '组合筛选'

export type MetricCatalog = '患者属性' | '就诊记录' | '眼表评估' | '衍生指标'
export type MetricKind = 'field_binding' | 'derived'
export type MetricStatus = 'active' | 'disabled'
export type ValueType = 'integer' | 'number' | 'enum' | 'datetime' | 'boolean' | 'text'
export type DataGrain = '患者' | '就诊' | '采集'

export type JudgmentType =
  | 'direct_compare'
  | 'latest'
  | 'exists'
  | 'count'
  | 'zero_records'
  | 'recent_n'
  | 'consecutive_dates'
  | 'first_abnormal'
  | 'change'

export type CompareOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'between' | 'in' | 'not_in'

export type EventType = '门诊就诊' | '出院'

export type DatasetSource = 'CDR' | '时序库'

export type ConnectedSystemStatus = 'available' | 'disabled'
export type DeliveryMethod = 'direct_export' | 'snapshot_channel' | 'on_demand_query' | 'scheduled_full_push'

export type OpenConfigType = 'dataset_delivery' | 'tag_subscription'
export type OpenConfigStatus = 'draft' | 'enabled' | 'paused' | 'expired'

export type BatchKind = 'auto_recognition' | 'active_search' | 'dynamic_refresh'
export type ScopeConfirmStatus = 'pending' | 'confirmed'

export type CrowdType = 'dynamic' | 'snapshot'

export type RemoveReasonCode = 'not_satisfy' | 'not_for_this_operation' | 'other'

export type SessionMode = 'business' | 'ruleSamples'

export type ModuleKey = 'workbench' | 'tags' | 'recognition' | 'cohorts' | 'open' | 'analytics' | 'admin'

export type ButtonPermissionKey =
  | 'tagCreate'
  | 'tagEdit'
  | 'tagTrial'
  | 'tagPublish'
  | 'tagDisable'
  | 'tagDelete'
  | 'tagAutoRecognition'
  | 'recognitionConfirm'
  | 'cohortCreate'
  | 'cohortEdit'
  | 'cohortRefresh'
  | 'cohortSnapshot'
  | 'openCreate'
  | 'openEdit'
  | 'openEnable'
  | 'openPause'
  | 'openResume'
  | 'openExport'
  | 'metricMaintain'
  | 'systemMaintain'

export type TimeWindow =
  | { kind: 'relative_days'; days: number }
  | { kind: 'fixed'; start: string; end: string }
  | {
      kind: 'event'
      eventType: EventType
      occurrence: 'first' | 'latest' | 'any'
      offsetBeforeDays: number
      offsetAfterDays: number
    }

export type DirectCompareJudgment = {
  type: 'direct_compare'
  op: CompareOp
  value: unknown
}

export type LatestJudgment = {
  type: 'latest'
  window: TimeWindow
  op: CompareOp
  value: unknown
}

export type ExistsJudgment = {
  type: 'exists'
  window: TimeWindow
  filter?: { op: CompareOp; value: unknown }
}

export type CountJudgment = {
  type: 'count'
  window: TimeWindow
  op: CompareOp
  value: number
  filter?: { op: CompareOp; value: unknown }
}

export type ZeroRecordsJudgment = {
  type: 'zero_records'
  window: TimeWindow
}

export type RecentNJudgment = {
  type: 'recent_n'
  window: TimeWindow
  n: number
  op: CompareOp
  value: unknown
}

export type ConsecutiveDatesJudgment = {
  type: 'consecutive_dates'
  window: TimeWindow
  n: number
  daily: 'any_satisfy' | 'all_valid_satisfy'
  op: CompareOp
  value: unknown
}

export type FirstAbnormalJudgment = {
  type: 'first_abnormal'
  window: TimeWindow
  op: CompareOp
  value: unknown
}

export type ChangeJudgment = {
  type: 'change'
  mode: 'absolute' | 'rate'
  op: CompareOp
  value: number
}

export type Judgment =
  | DirectCompareJudgment
  | LatestJudgment
  | ExistsJudgment
  | CountJudgment
  | ZeroRecordsJudgment
  | RecentNJudgment
  | ConsecutiveDatesJudgment
  | FirstAbnormalJudgment
  | ChangeJudgment

export type ConditionNode = {
  kind: 'condition'
  id: string
  metricId: string
  judgment: Judgment
}

export type TagRefNode = {
  kind: 'tag_ref'
  id: string
  tagId: string
}

export type GroupNode = {
  kind: 'group'
  id: string
  operator: 'and' | 'or'
  sameEncounter?: boolean
  children: RuleNode[]
}

export type RecordGroupNode = {
  kind: 'record_group'
  id: string
  grain: DataGrain
  operator: 'and' | 'or'
  children: RuleNode[]
  outer: ExistsJudgment | CountJudgment | RecentNJudgment | ConsecutiveDatesJudgment
}

export type RuleNode = ConditionNode | TagRefNode | GroupNode | RecordGroupNode

export type RuleLogic = GroupNode | ConditionNode | TagRefNode | RecordGroupNode

export type Organization = {
  id: string
  name: string
}

export type PatientScope = {
  id: string
  name: string
  includesUnassignedArchives: boolean
  description: string
}

export type Patient = {
  id: string
  name: string
  sex: Sex
  age: number
  phone: string | null
}

export type Encounter = {
  id: string
  patientId: string
  department: string
  visitTime: string
  diagnosis: string
}

export type EyeAssessment = {
  observationId: string
  patientId: string
  encounterId: string | null
  observedAt: string
  ingestedAt: string
  score: number | null
  symptom: boolean | null
  revoked: boolean
  unjudgeable: boolean
}

export type ClinicalEvent = {
  id: string
  patientId: string
  type: EventType
  occurredAt: string
  ingestedAt: string
  encounterId?: string
}

export type DatasetField = {
  name: string
  label: string
  valueType: ValueType
  description: string
}

export type Dataset = {
  id: string
  name: string
  source: DatasetSource
  tableName: string
  grain: DataGrain
  fields: DatasetField[]
  associations: {
    patient: string
    encounter: string | null
    record: string
    time: string | null
  }
}

export type MetricBinding = {
  datasetId: string
  tableName: string
  field: string
}

export type DerivedFunction = 'avg' | 'sum' | 'count' | 'max' | 'min' | 'arithmetic' | 'date_diff'

export type DerivedMetricSpec = {
  function: DerivedFunction
  inputMetricIds: string[]
  windowDays?: number
  formula?: string
  resultUnit?: string
  dateDiffUnit?: 'days'
}

export type Metric = {
  id: string
  name: string
  catalog: MetricCatalog
  kind: MetricKind
  status: MetricStatus
  binding?: MetricBinding
  derived?: DerivedMetricSpec
  valueType: ValueType
  unit?: string
  grain: DataGrain
  businessTimeField?: string
  patientKey: string
  observationKey?: string
  sortField?: string
  associatedObservationKey?: string
  enumValues?: string[]
  comparable: boolean
  applicableJudgments: JudgmentType[]
  validityNote: string
  dedupeNote: string
}

export type Tag = {
  id: string
  name: string
  type: TagType
  category: TagCategory
  status: TagStatus
  responsibleOrgId: string
  suggestion?: string
  autoRecognitionEnabled: boolean
  autoRecognitionIntervalDays?: number
  logic: RuleLogic
  createdBy: string
  createdAt: string
  updatedBy: string
  updatedAt: string
}

export type TagLogicSnapshot = {
  tagId: string
  tagName: string
  logicSummary: string
  expandedLogic: RuleLogic
  referencedTags: TagLogicSnapshot[]
}

export type ComputeTimeRuleExplanation = {
  sourceType: 'tag' | 'cohort_include_exclude' | 'subscription'
  tagId?: string
  tagName?: string
  logicSummary: string
  expandedLogic: RuleLogic
  referencedTags?: TagLogicSnapshot[]
  includeTags?: TagLogicSnapshot[]
  excludeTags?: TagLogicSnapshot[]
  cohortId?: string
  cohortName?: string
}

export type ScopeConfirmation = {
  scopeId: string
  status: ScopeConfirmStatus
  confirmedAt?: string
  confirmedBy?: string
  retainedCount?: number
  snapshotId?: string | null
  zeroRetention?: boolean
}

export type Batch = {
  id: string
  tagId?: string
  cohortId?: string
  kind: BatchKind
  computedAt: string
  scopeConfirmations: Record<string, ScopeConfirmation>
  ruleExplanation: ComputeTimeRuleExplanation
}

export type EvidenceSlot = {
  role: string
  metricId: string
  patientId: string
  value: unknown
  businessTime: string
  ingestedAt?: string
  observationId?: string
  encounterId?: string
  sourceTable: string
}

export type Hit = {
  id: string
  batchId: string
  tagId?: string
  patientId: string
  computedAt: string
  slots: EvidenceSlot[]
}

export type SnapshotMember = {
  patientId: string
  name: string
  sex: Sex
  age: number
  encounterId?: string
  department?: string
  phone: string | null
}

export type Snapshot = {
  id: string
  name: string
  type: 'snapshot'
  responsibleOrgId: string
  sourceType: 'recognition' | 'active_query' | 'from_snapshot'
  sourceBatchId?: string
  sourceSnapshotId?: string
  confirmedBy: string
  confirmedAt: string
  computedAt: string
  members: SnapshotMember[]
  scopeId: string
  ruleExplanation?: ComputeTimeRuleExplanation
}

export type DynamicCohort = {
  id: string
  name: string
  type: 'dynamic'
  responsibleOrgId: string
  includeTagIds: string[]
  excludeTagIds: string[]
  scopeId: string
  lastSuccessfulComputedAt?: string
  lastSuccessfulMemberIds?: string[]
  lastSuccessfulBatchId?: string
  lastSuccessfulIncludeTagIds?: string[]
  lastSuccessfulExcludeTagIds?: string[]
  lastSuccessfulRuleExplanation?: ComputeTimeRuleExplanation
}

export type ReviewRecord = {
  id: string
  batchId: string
  scopeId: string
  patientId?: string
  action: 'remove' | 'confirm'
  at: string
  by: string
  reasonCode?: RemoveReasonCode
  reason?: string
  currentStatusSummary?: string
  snapshotId?: string | null
}

export type SubscriptionResult = {
  resultVersion: string
  computedAt: string
  patientIds: string[]
}

export type OpenDeliveryKind = 'download' | 'channel' | 'query' | 'push'

export type OpenDeliveryRecord = {
  id: string
  at: string
  by: string
  kind: OpenDeliveryKind
  reused?: boolean
  resultVersion?: string
  computedAt?: string
  patientCount?: number
}

export type OpenConfig = {
  id: string
  name: string
  type: OpenConfigType
  status: OpenConfigStatus
  consumer: string
  purpose: string
  description?: string
  boundSnapshotId?: string
  boundDynamicCohortId?: string
  method: DeliveryMethod
  systemId?: string
  responsibleOrgId: string
  scopeId: string
  validUntil?: string | null
  enabledAt?: string
  pendingResumeAfterExpiry?: boolean
  pauseReasons: string[]
  dependencyReasons: string[]
  pushPeriodMinutes?: number
  nextPushAt?: string
  lastResult?: SubscriptionResult
  deliveryRecords: OpenDeliveryRecord[]
  frozenCsv?: string
  frozenCsvAt?: string
  createdBy: string
  createdAt: string
  updatedBy: string
  updatedAt: string
}

export type ConnectedSystem = {
  id: string
  name: string
  code: string
  defaultConsumer: string
  status: ConnectedSystemStatus
  methods: Array<Exclude<DeliveryMethod, 'direct_export'>>
  queryMinIntervalMinutes?: number
  pushPeriodMinutes?: number[]
  channelId: string
  responsibleOrgId: string
  businessContact: string
  techContact: string
  lastValidatedAt: string
  remark?: string
}

export type SampleMeasure = {
  id: string
  patientId: string
  observationId: string
  observedAt: string
  ingestedAt: string
  revoked: boolean
  measureType: 'weight_kg' | 'height_m' | 'datetime_start' | 'datetime_end'
  value: number | string | null
}

export type RuleSampleCase = {
  id: string
  name: string
  patientIds: string[]
  computeAt: string
  expectedNote: string
}

export type RuleSamplePartition = {
  patients: Patient[]
  encounters: Encounter[]
  observations: EyeAssessment[]
  events: ClinicalEvent[]
  measures: SampleMeasure[]
  cases: RuleSampleCase[]
}

export type Dictionaries = {
  tagCategories: TagCategory[]
  metricCatalogs: MetricCatalog[]
  organizations: Organization[]
  consumers: string[]
  eventTypes: EventType[]
}

export type DemoPermissions = {
  modules: Record<ModuleKey, boolean>
  buttons: Record<ButtonPermissionKey, boolean>
}

export type DemoSession = {
  mode: SessionMode
  ruleSampleWorkingCopy: RuleSamplePartition | null
  simulateFailure: boolean
  permissions: DemoPermissions
  /** null/undefined = 演示账号默认全部授权 */
  authorizedTagIds?: string[] | null
}

export type AppState = {
  clock: string
  currentScopeId: string
  operatorId: string
  dictionaries: Dictionaries
  datasets: Dataset[]
  metrics: Metric[]
  patients: Patient[]
  encounters: Encounter[]
  observations: EyeAssessment[]
  events: ClinicalEvent[]
  tags: Tag[]
  batches: Batch[]
  hits: Hit[]
  dynamicCohorts: DynamicCohort[]
  snapshots: Snapshot[]
  reviewRecords: ReviewRecord[]
  openConfigs: OpenConfig[]
  connectedSystems: ConnectedSystem[]
  patientScope: PatientScope
  ruleSamples: RuleSamplePartition
  session: DemoSession
  /** Hard-deleted stable ids that must never be reused. */
  retiredIds: string[]
}

export type WorkbenchStats = {
  pendingRecognitionBatches: number
  pendingRecognitionPatients: number
  enabledOpenConfigs: number
  dynamicCohorts: number
  snapshots: number
  publishedTags: number
}
