# APTS 代码地图

## 阅读入口

[产品规格](患者标签画像服务-产品规格.md)定义产品行为，[CONTEXT](CONTEXT.md)统一术语，[README](README.md)说明获取与运行。工程位于 `demo/`。

## 代码职责（以下路径相对 demo/）

| 位置 | 职责及主要入口 |
|---|---|
| `src/main.tsx`、`src/App.tsx`、`src/app/routes.ts` | 应用挂载、路由容器、页面路由及路径常量 |
| `src/components/ui/` | shadcn 基础组件；生成配置见 `components.json` |
| `src/components/shared/` | `kit.tsx` 通用展示组件、`Modal.tsx` 弹层与提示、`PageHeader.tsx` 页头 |
| `src/components/app/` | `AppLayout.tsx` 全局布局与导航、`DemoControls.tsx` 演示控制 |
| `src/components/patients/PatientEvidencePanel.tsx` | 跨识别、患者等页面的证据面板、成员表、患者链接 |
| `src/pages/` | 工作台及 tags、recognition、cohorts、open、admin、patients、analytics 页面；专用表单和规则编辑器就近放置 |
| `src/domain/` | `types.ts` 领域类型、`ids.ts` 标识、`logicSummary.ts` 规则与人群条件文字 |
| `src/engine/` | 规则求值、依赖可用性、时间窗口、衍生计算与证据生成 |
| `src/store/` | `DemoStoreContext.tsx` 共享会话；`store.ts` 操作入口；selectors、识别、人群、开放、系统与 CSV 操作 |
| `src/data/` | 共享种子数据、字典、规则样例与演示目录 |
| `src/demo/clock.ts` | 演示时钟及时间格式化 |
| `src/hooks/`、`src/lib/` | 通用 hook 与组件辅助函数 |
| `src/index.css` | 全局样式与主题 |
| `src/test/`、就近的 `*.test.ts(x)` | 测试初始化、路由 HTTP 检查与业务/页面测试 |

## 常见修改路径

- 导航和路由：先看 `app/routes.ts`、`App.tsx`、`components/app/AppLayout.tsx`。
- 规则和指标：页面编辑器 → store → engine；文字显示同时查看 `domain/logicSummary.ts`。
- 识别、复核、人群：相应 pages → store → 共享患者证据组件。
- 数据开放：`pages/open/` → `store/open.ts`、`store/csv.ts`；检查实际下载内容。
- 演示数据：`data/seed.ts` 与 `demoCatalog.ts`；核对跨页面共享状态。

## 验证与记录

在 `demo/` 运行 `npm test`、`npm run build`；共享组件和路由修改后在浏览器检查受影响页面、交互和刷新。测试与实现就近维护。

根目录 `acceptance.md`、`implementation-progress.md` 和 `progress/` 保存首次 P0 搭建证据；新验证记录按本次实际结果追加。`.scratch/` 仅在需要本地任务票据时创建。

## 发布入口

`demo/src/main.tsx` 使用 HashRouter，`demo/vite.config.ts` 使用相对资源路径。`.github/workflows/pages.yml` 负责全新安装、测试、构建与 main 分支自动部署；发布步骤与访问范围见 README。
