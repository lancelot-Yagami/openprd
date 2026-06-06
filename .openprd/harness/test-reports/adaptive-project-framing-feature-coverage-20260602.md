# adaptive-project-framing feature coverage evidence

- generatedAt: 2026-06-02
- change: `adaptive-project-framing`
- scope: 首轮项目画像、自适应需求初始化、greenfield/existing-project 场景判定、clarify inline 展示与 intake-reflection 产出

## 实现与契约覆盖

- 共享契约与实现入口落在 `src/workspace-core.js`、`src/workspace-workflow.js`、`src/cli/basic-print.js`。
- 同步更新了 `.openprd/templates/base/intake.md`、`docs/basic/app-flow.md`、`docs/basic/backend-structure.md`、`skills/openprd-requirement-intake/SKILL.md`、`src/agent-integration.js`，确保模板、技能说明和 CLI 话术一致。

## 自动化测试

- `node --test test/openprd-workspace-flow.test.js`
  - 通过。
  - 覆盖 `clarify distinguishes existing-project cold start from empty cold start`。
  - 覆盖 `clarify keeps OpenPrd bootstrap-only fresh init in greenfield mode and writes intake reflection`。
- `node --test test/requirement-gate.test.js`
  - 通过。
  - 覆盖 `clarify keeps focused active requirement intake in the conversation`。
- `node --test test/openprd.test.js --test-name-pattern "clarify stays inline and synthesize writes a review artifact"`
  - 通过。
  - 覆盖 clarify 仍保持 inline、不会生成 `clarify.html`、会输出首轮项目画像并写入 `intake-reflection.md`。

## CLI smoke

- greenfield smoke
  - 路径: `/tmp/openprd-greenfield-smoke-MTUzkN`
  - 命令: `openprd init <dir> --template-pack agent` 后运行 `openprd clarify <dir> --json`
  - 结果: `scenario = cold-start-greenfield`，存在 `intakeReflectionPath`，inline 输出包含 `适用对象` 和 `第一版先做`。
- existing-project smoke
  - 路径: `/tmp/openprd-existing-smoke-KslPGf`
  - 命令: 预先写入 `README.md`，再运行 `openprd init <dir> --template-pack agent` 与 `openprd clarify <dir> --json`
  - 结果: `scenario = cold-start-existing-project`，并会追问 `existing-project-goal`。
- one-line prompt routing smoke
  - 路径: `/tmp/openprd-blog-context-inspect-BmDuxw`
  - 命令: `openprd run <dir> --context --message "我想做一个个人博客网站" --json`
  - 结果: `next.nextAction = clarify-user`，`suggestedCommand = openprd clarify .`，建议问题包含“给谁用”“第一版最小可用切片”“哪些不能破坏”。
- follow-up clarify smoke
  - 路径: `/tmp/openprd-blog-smoke-9Hswhl`
  - 命令: fresh init 后运行 `openprd clarify <dir> --json`
  - 结果: `scenario = cold-start-greenfield`，存在 `intakeReflection`，`mustAskUser` 包含 `project-overview`、`first-slice`、`guardrails`，inline 输出展示首轮项目画像与技术落点。

## 文档与治理门禁

- `openprd standards . --verify`
  - 通过。
  - `docs/basic` required docs `6/6`，manual templates `2/2`。
- `openprd change . --validate --change adaptive-project-framing`
  - 通过。
  - 当前 change 结构、spec、tasks、测试策略和执行策略均有效。

## 任务映射

- `T001.02` 到 `T001.08`: 由实现文件改动、自动化测试和 greenfield / existing-project / follow-up clarify smoke 共同覆盖。
- `T001.09` 到 `T001.14`: 由 `test/openprd-workspace-flow.test.js`、`test/requirement-gate.test.js`、`test/openprd.test.js --test-name-pattern ...` 共同覆盖。
- `T001.15` 到 `T001.17`: 由 requirement gate 自动化测试、场景判定 smoke、`run --context --message` 路由 smoke 和 follow-up clarify smoke 共同覆盖。
- `T001.18` 到 `T001.20`: 由 `openprd standards . --verify` 与 `openprd change . --validate --change adaptive-project-framing` 覆盖。
