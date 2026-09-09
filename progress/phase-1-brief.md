# 阶段 1 任务包（主会话派发）

实施代理必须先读：

- `/Users/yangyinglin/AI playground/APTS演示demo/患者标签画像服务-产品规格.md`
- `/Users/yangyinglin/AI playground/APTS演示demo/CONTEXT.md`
- `/Users/yangyinglin/AI playground/APTS演示demo/implementation-progress.md`
- `/Users/yangyinglin/AI playground/APTS演示demo/acceptance.md`
- 本文件

不要读取任何旧原型或历史讨论。不要修改 SPEC、CONTEXT、分阶段实施提示词。

## 最终 Goal

在同一个前端工程中完成最新版 SPEC 与 CONTEXT 定义的全功能需求评审 Demo。所有“完整”操作可实际执行，规定的占位和只读入口正确呈现。

## 本阶段 Goal

一个能运行和导航的应用；七模块共用一套虚拟数据、状态与演示时钟，而不是静态页面拼接。

范围：WB-01、WB-05、WB-06、WB-07、ADM-01、ADM-08、ADM-09、ANL-01；其余页面只建立导航及必要布局。

## 允许修改

- `/Users/yangyinglin/AI playground/APTS演示demo/demo/**`（新建工程）
- `/Users/yangyinglin/AI playground/APTS演示demo/progress/phase-1.md`（交接记录，阶段结束时写）

禁止修改：SPEC、CONTEXT、分阶段实施提示词、acceptance.md（验收状态由主会话填写）。可更新 `implementation-progress.md` 中的运行命令与技术栈事实，不要把阶段标成最终完成。

## 技术约束

- React 18 + TypeScript + Vite + React Router
- 共享内存状态，刷新/重置恢复初始样例
- 医院时区 Asia/Shanghai
- 默认演示时钟 `2026-09-07 11:00`
- 数字全部从共享对象推导，禁止各页预写人数
- 不为阶段 2 伪造规则引擎命中；可预置初始批次对象（08:00 六人命中），但工作台数字必须从该对象 count 得出
- 独立规则样例数据与主故事隔离，演示控制区可载入，默认不覆盖业务数据
- Vitest；测试必须导入真实 seed/selector 函数，禁止把期望人数写死在测试里绕过对象
- 不新增触达执行、多院区、模型管理、审计功能
- 文案使用 SPEC 术语，禁用「预警任务」「服务策略」「交付成功」「一人一档」

## 视觉（SPEC 0.4）

- 桌面 Web；左侧一级导航 + 主区列表／详情
- 不为分类再加常驻二级菜单（系统管理五个子页除外）
- 浅灰页面、白色内容区、青蓝色主操作
- 正文约 14px，次要文字不小于 12px，状态含文字
- 工作台：顶部规模数字、左侧待办、右侧开放摘要、底部模块入口
- 演示控制：可折叠，默认关闭，不属于业务菜单
- 核心流程可键盘操作，焦点可见

建议 token：

- 页面背景 `#F3F5F7`
- 内容白 `#FFFFFF`
- 主色青蓝 `#0E8A9A`
- 主色悬停 `#0B7381`
- 正文 `#1C2430`
- 次要 `#5B6573`
- 边框 `#E2E6EB`
- 侧栏宽 220px
- 字体：`"IBM Plex Sans", "Noto Sans SC", sans-serif`

## 必须完成的数据关系（阶段 1 就要进共享 store）

### 数据集（只读，ADM-01 展示）

1. 患者基本信息 / CDR / cdr_patient / 患者 / patient_id, name, age, sex, phone
2. 门诊就诊记录 / CDR / cdr_encounter / 就诊 / patient_id, encounter_id, department, visit_time, diagnosis
3. 眼表评估记录 / 时序库 / ts_eye_assessment / 采集 / patient_id, encounter_id, observation_id, observed_at, score, symptom

禁止增删改停，禁止「配置为指标」。

### 指标库（对象先建，编辑 UI 阶段 2）

- 患者年龄：字段绑定 cdr_patient.age，直接比较，整数患者属性
- 就诊科室：cdr_encounter.department，最新／存在／次数／零记录，就诊枚举
- 就诊时间：cdr_encounter.visit_time，最新／存在
- 眼表评分：ts_eye_assessment.score，最新／存在／累计次数／最近 N 次／连续日期／首次异常／较前变化；单位分；观察粒度采集；按 observed_at 排序
- 不适症状：ts_eye_assessment.symptom，最新／存在；布尔；同 observation_id 关联
- 近 30 天平均眼表评分：衍生 平均值(眼表评分, 30 天)，直接比较

### 标签（对象先建，规则编辑阶段 2）

- TAG-EYE-HIGH 眼表评分偏高，基础，评估结果，近 90 天最新一次眼表评分 ≥ 10，自动识别关
- TAG-ADULT 成年患者，基础，基本属性，年龄 ≥ 18，关
- TAG-EYE-OP 眼科复诊运营筛选，复合，组合筛选，引用前两者且近 90 天存在眼科就诊，开 · 每 7 天

责任组织默认 ORG-INFO 信息管理部门。演示经办人 DEMO-OP。

### 主故事患者 8 人

就诊业务时间 = 就诊 ID 日期 09:00。触发评分观察 = 就诊日期 09:30。观察标识 `O-{患者尾号}-{YYYYMMDD}-{序号}`。入库默认业务时间 +1 分钟。

| ID | 姓名 | 性别 | 年龄 | 就诊 | 科室 | 08:00 评分 | 后续 | 电话 |
|---|---|---|---|---|---|---|---|---|
| P-DEMO-001 | 张敏 | 女 | 56 | V-20260820-011 | 眼科 | 16 | 09-07 09:00 评分 14 | DEMO-TEL-001 |
| P-DEMO-002 | 李强 | 男 | 61 | V-20260820-018 | 眼科 | 18 | 09-07 10:00 评分 7 | 空 |
| P-DEMO-003 | 王芳 | 女 | 48 | V-20260821-004 | 眼科 | 15 | — | DEMO-TEL-003 |
| P-DEMO-004 | 赵洋 | 男 | 52 | V-20260822-009 | 眼科 | 12 | — | DEMO-TEL-004 |
| P-DEMO-005 | 陈晨 | 女 | 44 | V-20260822-021 | 眼科 | 11 | — | DEMO-TEL-005 |
| P-DEMO-006 | 周宁 | 男 | 67 | V-20260824-002 | 眼科 | 13 | — | DEMO-TEL-006 |
| P-DEMO-007 | 林晓 | 女 | 35 | 2026-08-25 全科 | 全科 | 评分 5 | — | DEMO-TEL-007 |
| P-DEMO-008 | 吴平 | 男 | 40 | 2026-08-25 全科 | 全科 | 无评分 | — | 空 |

界面注明电话非真实号码。name/phone 属于 cdr_patient，symptom 属于 ts_eye_assessment。

林晓/吴平就诊 ID 自拟稳定值（如 V-20260825-007 / V-20260825-008），不要改八人事实。

### 初始批次

- B-20260907-0800，标签 TAG-EYE-OP，计算完成 2026-09-07 08:00
- 六人命中：001–006，触发评分 16/18/15/12/11/13
- 批次证据不得混入 09:00/10:00 两条计算后观察
- 待确认（全院），未确认

### 已对接系统（对象先建，维护 UI 阶段 4）

- SYS-PATIENT 患者服务系统，默认使用方眼科随访组，可用；一次性快照通道交付、按需查询、定时全量推送；查询最小间隔 1 天；推送每 7 天；通道 DEMO-CHANNEL-001
- SYS-LEGACY 旧随访接口，默认使用方随访管理组，停用；一次性快照通道交付、定时全量推送；不支持按需查询；通道 DEMO-CHANNEL-002

初始开放配置为空。无动态人群、无快照。

### 演示字典

标签分类：基本属性、就诊特征、评估结果、组合筛选。
指标目录：患者属性、就诊记录、眼表评估、衍生指标。
责任组织：ORG-INFO 信息管理部门；ORG-EYE 眼科。
使用方示例：眼科随访组、随访管理组、健康活动组织组。
事件类型：门诊就诊、出院。

### 独立规则样例（隔离，不进主故事规模）

按 SPEC 7.2 与演示字典预置独立患者/观察（RULE-*），存入 `ruleSamples` 分区。演示控制「规则能力样例」只载入临时试算副本，退出即回业务数据。阶段 1 只需数据与入口占位（载入可切到隔离副本并提示「规则能力样例，不覆盖业务数据」），不必实现完整规则计算。

### 工作台初始规模（必须从对象推导）

待确认识别批次 1、待确认人数 6、开放配置 0、动态人群 0、快照 0、已发布标签 3。全 0 时仍展示数字 0。

无审批待办。无异常时不显示红色待处理。首页无复核、开放启停、导出按钮。

运营分析入口进入占位页，标题「运营分析」，正文「模块开发中」。

标签使用授权：占位页「标签使用授权配置暂不演示」+ 演示账号说明。

患者范围：只读展示「全院」，说明不含无院区就诊的建档对象，无编辑。

## 路由

`/` 工作台
`/tags` `/tags/:id` 标签（阶段 1 列表骨架 + 详情占位说明）
`/recognition` `/recognition/:tagId/batches/:batchId` 识别（阶段 1 概览骨架，可列出已开启自动识别的标签与批次入口，不实现复核）
`/cohorts` `/cohorts/new` `/cohorts/:id` 人群（空态引导新建，新建页可先占位）
`/open` `/open/new` `/open/:id` 数据开放（空态引导新建）
`/analytics` 占位完整
`/admin/datasets` 完整只读
`/admin/metrics` 列表骨架（阶段 2 完成编辑）
`/admin/systems` 列表骨架（阶段 4 完成维护）
`/admin/auth` 占位完整
`/admin/scopes` 只读完整
`/patients/:id?from=` 画像骨架（阶段 3）

阶段性未实现入口必须明确标记「本页将在后续阶段提供完整操作」，不能做成伪功能按钮。

## 共享状态最低 API（供后续阶段复用）

建议：

- `src/domain/types.ts` 领域类型
- `src/data/seed.ts` `createInitialState(): AppState`
- `src/store/store.ts` 或 React context：state、reset()、setClock()、advanceClock()
- `src/store/selectors.ts` `workbenchStats(state)` 等纯函数
- `src/demo/clock.ts` 时区与格式化
- 演示控制组件：重置数据、推进时间（可先只改时钟）、模拟失败开关、按钮权限开关、载入规则样例

阶段 1 不要建设生产架构（无后端、无持久化、无真实门户）。为后续计算保留：患者、就诊、观察（含业务时间与入库时间）、指标、标签、批次、命中、证据槽位。

## 自检（必须跑）

1. `npm install` 成功
2. `npm test`：至少覆盖
   - seed 产生 8 名主故事患者、3 个已发布标签、1 个批次且命中 6 人
   - `workbenchStats` 得到 1/6/0/0/0/3
   - reset 后统计回到初始
   - 规则样例患者不计入主故事规模
   - 不得通过「expect(6)」绕过从 hit 数组 length 取值；应从 selector 与对象关系断言
3. `npm run build` 通过
4. 用 Playwright 或 `npx vite --host` + fetch 确认关键路由 200 且无死链（至少 `/` `/tags` `/recognition` `/cohorts` `/open` `/analytics` `/admin/datasets` `/admin/auth` `/admin/scopes`）
5. 工作台截图或 DOM 断言：规模数字、无复核/启停/导出按钮、运营分析入口存在

## 交接

写 `progress/phase-1.md`：修改范围、共享接口、运行与检查命令、结果、遗留问题。

向主会话报告。不要自行宣布阶段 1 通过或开始阶段 2。
