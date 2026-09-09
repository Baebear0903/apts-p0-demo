# 阶段 2 交接记录

实施代理自检提交。主会话负责验收状态；本文不宣布阶段通过。

## 修改范围

工程 `/Users/yangyinglin/AI playground/APTS演示demo/demo`。未修改 SPEC、CONTEXT、分阶段提示词、acceptance.md。

未覆盖 seed 主故事八人事实，也未改写初始批次 `B-20260907-0800` 的 hits 与 `ruleExplanation.expandedLogic`（seed 改为对该说明做 `structuredClone`，与当前标签逻辑分对象）。

新增／完成：

- 纯函数规则引擎：直接比较、最新值、时间窗口、事件锚点、存在／计次／零记录、最近 N 次、观察内组合、首次异常、较前变化、连续日期、衍生算术／日期差／窗口统计
- 指标库 ADM-02..06：列表（目录、绑定、状态、真实引用数）、空态新建、弹层绑定或衍生、适用判断方式为源能力子集、改绑定列出受影响标签并阻止不兼容、停用／恢复依赖层、有引用不可删
- 标签中心 TAG-01..11：筛选（类型／状态／可用性）、新建基础／复合、左树右参数、草稿与已发布保存校验、试算、人工停用、自动识别开关／周期写同一对象、删除确认影响、无权限不显示按钮
- `AppState.retiredIds`：硬删除后的稳定标识不复用

未做：复核、人群确认、开放下载、工作台开放摘要完整联动。阶段 1 占位页保留。

## 共享接口

引擎入口（`demo/src/engine/`）：

```ts
evaluateNode(ctx: EvalContext, patientId: string, node: RuleNode): Tri | { unavailable: true; reason: string }
evaluateTag(state: AppState, tag: Tag, computeAt: string, patientId: string): Tri | { unavailable: true; reason: string }
trialCompute(state: AppState, tagId: string): { unavailableReason: string } | { hitPatientIds: string[]; samples: { patientId: string; maskedName: string }[] }
metricValue(state: AppState, metricId: string, patientId: string, computeAt: string): { status: 'value'; value: unknown } | { status: 'unknown' } | { status: 'error'; error: string }
buildEvalContext(state: AppState, computeAt?: string): EvalContext
tagAvailability(state: AppState, tag: Tag): { available: true } | { available: false; reasons: string[] }
```

`EvalContext` 含患者、就诊、观察、事件、指标、标签、measures、computeAt、simulateFailure。规则样例模式从 `session.ruleSampleWorkingCopy` 取观察与 measures，不读主故事观察。

store 增量：`saveMetric` / `disableMetric` / `restoreMetric` / `deleteMetric`、`saveTag` / `disableTag` / `restoreTag` / `deleteTag` / `setTagAutoRecognition`、`updateRuleSampleWorkingCopy`、`DemoStoreContext.patch`。

## 运行与检查命令

```bash
cd "/Users/yangyinglin/AI playground/APTS演示demo/demo"
npm test
npm run build
```

## 结果

| 检查 | 结果 |
|---|---|
| `npm test` | 9 files / 58 tests passed。含 7.2 各样例正反例；主故事 11:00 `trialCompute(TAG_EYE_OP_ID)` 5 人且样例不含李*；阈值 13 后 3 人（张敏／王芳／周宁）；旧批次 hits 仍 6 且李强 `latest_eye_score` 为 18；停用基础标签或指标后复合试算 `unavailableReason` 而非 0 人；连续日期缺日 vs 最近 N 次跳过无法判断；衍生缺输入／除 0；`summarizeLogic` 与保存值一致；有引用指标不可删 |
| `npm run build` | `tsc --noEmit` + `vite build` 通过 |

## 遗留问题

- 阶段 3+：识别复核、人群确认、开放下载、患者画像证据链、工作台开放摘要完整联动仍未做。
- 试算使用当前会话数据分区：载入规则能力样例后，业务标签试算改走样例观察，不读主故事八人。
- 验收状态由主会话填写 `acceptance.md`。
