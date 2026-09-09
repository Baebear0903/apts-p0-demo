# APTS Demo Code Map

## Root (Authoritative Docs)
- CONTEXT.md (domain glossary)
- acceptance.md (验收清单)
- progress/ (phases)
- 分阶段实施提示词.md
- 患者标签画像服务-产品规格.md
- implementation-progress.md

## demo/ (Main Code)
- src/
  - App.tsx (router)
  - app/routes.ts (routes)
  - domain/ (types, ids, logicSummary)
  - engine/ (core logic: evaluate, validate, etc.)
  - pages/ (all UI pages)
  - store/ (state, selectors, context)
  - ui/ (components)
- demo/ (vite, package, README)

## Temp / Scratch
- .scratch/ (for issues, per local-markdown convention)
