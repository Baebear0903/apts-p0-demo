export { evaluateNode, evaluateTag, trialCompute, maskPatientName, buildEvalContext, isBlocked } from './evaluate'
export type { Tri, NodeEval, TrialResult, TrialSample, EvalContext } from './evaluate'
export { metricValue, evaluateArithmetic } from './derived'
export { tagAvailability, metricReferences, metricReferenceCount, tagImpact } from './availability'
export { validateLogic, validateTag, validateMetricDraft, canChangeMetricBinding } from './validate'
export {
  computeIncludeExclude,
  evaluateIncludeExclude,
  includeExcludeAvailability,
  isTagAuthorized,
  unauthorizedTagIds,
  tagDisplayName,
} from './includeExclude'
export {
  collectEvidenceSlots,
  snapshotTagLogic,
  buildTagRuleExplanation,
  buildIncludeExcludeExplanation,
  latestEyeScoreSlot,
  findTagLogicSnapshot,
} from './evidence'
export {
  defaultWindow,
  defaultJudgment,
  createCondition,
  createGroup,
  createRecordGroup,
  createTagRef,
  createEmptyLogic,
  findNode,
  updateNode,
  removeNode,
  addChild,
  sourceApplicableJudgments,
} from './logicTree'
