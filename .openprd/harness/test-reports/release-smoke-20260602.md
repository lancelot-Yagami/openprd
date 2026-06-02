# release smoke evidence

- generatedAt: 2026-06-02
- scope: npm publish tarball check and fresh workspace main flow smoke

## Smoke summary

- smoke: passed
- main flow: passed
- happy path: current release worktree can pack the CLI and initialize a fresh workspace without leaking local runtime state.

## Commands

- `npm pack --dry-run --json`
  - result: passed
  - evidence: tarball contains only source files and seed templates; it does not include `.openprd/reviews`, `.openprd/engagements/work-units`, `.openprd/knowledge/candidates`, or `.openprd/quality/reports`.
- `node --input-type=module <release-init-verification>`
  - result: passed
  - evidence: `initWorkspace` + `validateWorkspace` succeed on a fresh temp project, the generated PRD seed contains `类型专项模块`, discovery config includes `test-layer` / `evidence-plan` / `execution-mode` / `local-verify` / `integration-owner`, and the new workspace starts with empty `benchmarks/evidence`, `knowledge/candidates`, `knowledge/drafts`, and `reviews`.
