# Coding Guidelines

These guidelines apply in addition to the global working guidelines. Merge with project-specific instructions as needed.

## 1. Minimum Code

**Write only the code the task requires. Nothing speculative.**

- No abstractions for single-use code.
- No flexibility or configurability that was not requested.
- No error handling for impossible scenarios.
- Prefer existing patterns and dependencies.
- If the implementation is much larger than the problem, simplify it.

## 2. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Do not improve adjacent code, comments, or formatting.
- Do not refactor things that are not broken.
- Match the existing style, even if you would do it differently.
- Mention unrelated issues; do not fix them unless asked.

When your changes create orphans:

- Remove imports, variables, and functions made unused by your changes.
- Do not remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 3. Verify the Change

**Turn code changes into observable checks.**

- Bug fix → reproduce it, fix it, verify it.
- New behavior → test the expected and invalid paths.
- Refactor → confirm behavior before and after.
- Run the most relevant available checks.
- Do not claim tests passed unless they were actually run.



# APTS 工程约定

- 修改前先读 [code-map.md](code-map.md)，再读取涉及功能的产品规格章节；术语以 [CONTEXT.md](CONTEXT.md) 为准。
- 业务代码位于 `demo/`。shadcn 基础组件放 `src/components/ui/`，应用通用组件放 `shared/`，布局放 `app/`，跨页面患者组件放 `patients/`；页面专用组件与页面放在一起。
- 移动文件或改变模块职责时同步代码地图和当前使用文档。`progress/` 是首次搭建的历史记录，保留当时事实。
- 根据改动运行 `demo/package.json` 中的测试和构建脚本；共享组件或路由变化还需浏览器验证受影响页面、跳转及刷新。
- 分别提交目录整理、业务功能、文档与发布配置。报告实际检查结果及未验证项。
