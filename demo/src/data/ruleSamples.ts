import { addMinutes, shanghaiIso } from '../demo/clock'
import type { ClinicalEvent, EyeAssessment, Patient, RuleSampleCase, RuleSamplePartition, SampleMeasure } from '../domain/types'

const t = (date: string, time = '09:00:00') => shanghaiIso(date, time)

function samplePatient(id: string, name: string): Patient {
  return { id, name, sex: '女', age: 40, phone: null }
}

function scoreObs(
  observationId: string,
  patientId: string,
  observedAt: string,
  score: number | null,
  symptom: boolean | null = null,
  unjudgeable = false,
): EyeAssessment {
  return {
    observationId,
    patientId,
    encounterId: null,
    observedAt,
    ingestedAt: addMinutes(observedAt, 1),
    score,
    symptom,
    revoked: false,
    unjudgeable,
  }
}

export function createRuleSamples(): RuleSamplePartition {
  const patients: Patient[] = [
    samplePatient('RULE-NLAST', '规则样例-最近N次'),
    samplePatient('RULE-CONSEC', '规则样例-连续日期'),
    samplePatient('RULE-FIRST', '规则样例-首次异常'),
    samplePatient('RULE-CHANGE', '规则样例-较前变化'),
    samplePatient('RULE-COMBO', '规则样例-观察组合'),
    samplePatient('RULE-EVENT', '规则样例-事件窗口'),
    samplePatient('RULE-WINDOW', '规则样例-固定窗口'),
    samplePatient('RULE-BMI', '规则样例-算术'),
    samplePatient('RULE-DATE', '规则样例-日期差'),
    samplePatient('RULE-STAT', '规则样例-窗口统计'),
  ]

  const observations: EyeAssessment[] = [
    scoreObs('O-RULE-NLAST-20260901-1', 'RULE-NLAST', t('2026-09-01'), 12),
    scoreObs('O-RULE-NLAST-20260902-1', 'RULE-NLAST', t('2026-09-02'), null, null, true),
    scoreObs('O-RULE-NLAST-20260903-1', 'RULE-NLAST', t('2026-09-03'), 13),
    scoreObs('O-RULE-NLAST-20260904-1', 'RULE-NLAST', t('2026-09-04'), 14),
    scoreObs('O-RULE-CONSEC-20260901-1', 'RULE-CONSEC', t('2026-09-01'), 12),
    scoreObs('O-RULE-CONSEC-20260902-1', 'RULE-CONSEC', t('2026-09-02'), 13),
    scoreObs('O-RULE-CONSEC-20260902-2', 'RULE-CONSEC', t('2026-09-02', '15:00:00'), 7),
    scoreObs('O-RULE-CONSEC-20260903-1', 'RULE-CONSEC', t('2026-09-03'), 14),
    scoreObs('O-RULE-FIRST-20260701-1', 'RULE-FIRST', t('2026-07-01'), 12),
    scoreObs('O-RULE-FIRST-20260901-1', 'RULE-FIRST', t('2026-09-01'), 14),
    scoreObs('O-RULE-CHANGE-20260901-1', 'RULE-CHANGE', t('2026-09-01'), 10),
    scoreObs('O-RULE-CHANGE-20260902-1', 'RULE-CHANGE', t('2026-09-02'), 15),
    scoreObs('O-RULE-COMBO-A-1', 'RULE-COMBO', t('2026-09-01'), 12, false),
    scoreObs('O-RULE-COMBO-B-1', 'RULE-COMBO', t('2026-09-02'), 7, true),
    scoreObs('O-RULE-EVENT-20260815-1', 'RULE-EVENT', t('2026-08-15'), 12),
    scoreObs('O-RULE-WINDOW-20260901-1', 'RULE-WINDOW', t('2026-09-01', '00:00:00'), 10),
    scoreObs('O-RULE-WINDOW-20260907-1', 'RULE-WINDOW', t('2026-09-07', '23:59:00'), 10),
    scoreObs('O-RULE-STAT-20260901-1', 'RULE-STAT', t('2026-09-01'), 10),
    scoreObs('O-RULE-STAT-20260902-1', 'RULE-STAT', t('2026-09-02'), 20),
  ]

  const events: ClinicalEvent[] = [
    {
      id: 'EVT-RULE-EVENT-DC-1',
      patientId: 'RULE-EVENT',
      type: '出院',
      occurredAt: t('2026-08-01', '00:00:00'),
      ingestedAt: addMinutes(t('2026-08-01', '00:00:00'), 1),
    },
    {
      id: 'EVT-RULE-EVENT-DC-2',
      patientId: 'RULE-EVENT',
      type: '出院',
      occurredAt: t('2026-09-01', '00:00:00'),
      ingestedAt: addMinutes(t('2026-09-01', '00:00:00'), 1),
    },
  ]

  const bmiAt = t('2026-09-01')
  const measures: SampleMeasure[] = [
    {
      id: 'M-RULE-BMI-W',
      patientId: 'RULE-BMI',
      observationId: 'O-RULE-BMI-20260901-1',
      observedAt: bmiAt,
      ingestedAt: addMinutes(bmiAt, 1),
      revoked: false,
      measureType: 'weight_kg',
      value: 60,
    },
    {
      id: 'M-RULE-BMI-H',
      patientId: 'RULE-BMI',
      observationId: 'O-RULE-BMI-20260901-1',
      observedAt: bmiAt,
      ingestedAt: addMinutes(bmiAt, 1),
      revoked: false,
      measureType: 'height_m',
      value: 1.5,
    },
    {
      id: 'M-RULE-DATE-START',
      patientId: 'RULE-DATE',
      observationId: 'O-RULE-DATE-START',
      observedAt: t('2026-09-01'),
      ingestedAt: addMinutes(t('2026-09-01'), 1),
      revoked: false,
      measureType: 'datetime_start',
      value: t('2026-09-01'),
    },
    {
      id: 'M-RULE-DATE-END',
      patientId: 'RULE-DATE',
      observationId: 'O-RULE-DATE-END',
      observedAt: t('2026-09-03'),
      ingestedAt: addMinutes(t('2026-09-03'), 1),
      revoked: false,
      measureType: 'datetime_end',
      value: t('2026-09-03'),
    },
  ]

  const cases: RuleSampleCase[] = [
    {
      id: 'CASE-NLAST',
      name: '最近 N 次有效观察',
      patientIds: ['RULE-NLAST'],
      computeAt: t('2026-09-05', '11:00:00'),
      expectedNote: 'N=3、≥10 命中；9月3日改为7不命中；N=4不足次数',
    },
    {
      id: 'CASE-CONSEC',
      name: '连续日期',
      patientIds: ['RULE-CONSEC'],
      computeAt: t('2026-09-04', '11:00:00'),
      expectedNote: '当天存在一次满足命中；全部有效观察满足不命中；缺日两种均不命中',
    },
    {
      id: 'CASE-FIRST',
      name: '首次异常',
      patientIds: ['RULE-FIRST'],
      computeAt: t('2026-09-07', '11:00:00'),
      expectedNote: '9月首次阈值10不命中；移除7月记录后命中',
    },
    {
      id: 'CASE-CHANGE',
      name: '较前变化',
      patientIds: ['RULE-CHANGE'],
      computeAt: addMinutes(t('2026-09-02'), 1),
      expectedNote: '绝对差5、变化率50%；前次为0则变化率无法判断',
    },
    {
      id: 'CASE-COMBO',
      name: '观察组合',
      patientIds: ['RULE-COMBO'],
      computeAt: t('2026-09-03', '11:00:00'),
      expectedNote: '同次评分≥10且症状是不命中；B评分改12则命中',
    },
    {
      id: 'CASE-EVENT',
      name: '事件窗口',
      patientIds: ['RULE-EVENT'],
      computeAt: t('2026-09-07', '11:00:00'),
      expectedNote: '首次/任一次命中，最近一次不命中；无出院锚点不命中',
    },
    {
      id: 'CASE-WINDOW',
      name: '固定窗口',
      patientIds: ['RULE-WINDOW'],
      computeAt: t('2026-09-08', '11:00:00'),
      expectedNote: '9月1日至7日计数2；删除一条则1；模拟失败不等于0',
    },
    {
      id: 'CASE-BMI',
      name: '衍生算术',
      patientIds: ['RULE-BMI'],
      computeAt: t('2026-09-03', '11:00:00'),
      expectedNote: '体重60kg÷(身高1.5m)²=26.67；身高缺失或0无法判断',
    },
    {
      id: 'CASE-DATE',
      name: '日期差',
      patientIds: ['RULE-DATE'],
      computeAt: t('2026-09-03', '11:00:00'),
      expectedNote: '起点09-01至终点09-03为2天；交换为−2天；缺端点无法判断',
    },
    {
      id: 'CASE-STAT',
      name: '窗口统计',
      patientIds: ['RULE-STAT'],
      computeAt: t('2026-09-03', '11:00:00'),
      expectedNote: '计数2、和30、均值15、最大20、最小10；清空后计数0其余无法判断',
    },
  ]

  return {
    patients,
    encounters: [],
    observations,
    events,
    measures,
    cases,
  }
}
