# APTS P0 Demo 实施进度

## 路径

| 项 | 绝对路径 |
|---|---|
| 工程根（产品文档，勿改） | `/Users/yangyinglin/AI playground/APTS演示demo` |
| SPEC | `/Users/yangyinglin/AI playground/APTS演示demo/患者标签画像服务-产品规格.md` |
| CONTEXT | `/Users/yangyinglin/AI playground/APTS演示demo/CONTEXT.md` |
| 分阶段提示词 | `/Users/yangyinglin/AI playground/APTS演示demo/分阶段实施提示词.md` |
| Demo 工程 | `/Users/yangyinglin/AI playground/APTS演示demo/demo` |
| 验收清单 | `/Users/yangyinglin/AI playground/APTS演示demo/acceptance.md` |
| 阶段交接 | `/Users/yangyinglin/AI playground/APTS演示demo/progress/` |

## 技术栈

- React 18 + TypeScript + Vite 5
- React Router 6
- 共享内存状态（无真实后端、无持久化）
- Vitest + Testing Library；选择器测试驱动真实 seed／selector

## 运行命令

```bash
cd "/Users/yangyinglin/AI playground/APTS演示demo/demo"
npm install
npm run dev
npm test
npm run build
```

若本机 `~/.npm` 出现 EPERM：

```bash
npm install --cache "/Users/yangyinglin/AI playground/APTS演示demo/demo/.npm-cache"
```

访问地址：以 `npm run dev` 输出为准（预期 `http://localhost:5173/`）。

## 当前阶段

**阶段 1–4 已通过主会话验收。最终 Goal 达成（功能实现完成；真实浏览器 200% 缩放为工具受限未验证）。**

## 实际基线

可运行工程：`/Users/yangyinglin/AI playground/APTS演示demo/demo`

交接：`progress/phase-1.md` … `phase-4.md`。

主会话独立证据：`trialCompute` 11:00 五人；健康活动三人；`buildSnapshotCsv`/`downloadOpenCsv` 列名与电话；订阅现算李强／林晓／吴平。`npm test` 91 passed。

## 覆盖状态

第 14 章完整／占位／只读项均已验证。附录「可用性 200% 真实浏览器缩放」为工具受限未验证。见 `acceptance.md`。

## 阻塞项

本机 Chrome/Chromium headless 因沙箱 SIGSEGV 无法截图与 200% 缩放手测。页面内容由 RTL 渲染真实 `App` 覆盖。

## 下一步

无功能实施项。按 README 启动演示。
