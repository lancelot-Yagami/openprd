# EVO Quality Gates Evidence 2026-06-02

- smoke: `node --test test/openprd.test.js test/openprd-run-fleet.test.js test/openprd-discovery-changes.test.js` passed locally with 39/39 cases for release ledger, handoff export, and version tag movement.
- feature coverage: OpenPrd change `openprd` is being closed against task-scoped evidence from change validation, standards, doctor, release ledger regression tests, handoff export validation, and loop commit/tag validation.
- redaction: reviewed `src/codex-hook-runner-template.mjs`, `skills/openprd-shared/SKILL.md`, and `skills/openprd-quality/SKILL.md`; raw vault reads stay blocked, secrets flow through `secrets-vault`, token redacted and pii masked guidance remains explicit in project rules.
- normal performance: `npm run test:perf` passed with performance p95 1.37ms, max 2.11ms, and peak memory 13.70MB on the release ledger summary path.
- extreme performance: `npm run test:perf:extreme` passed with extreme fixture `test/fixtures/release-ledger-extreme.json`, p95 22.39ms, max 25.22ms, and peak memory 54.88MB.
- knowledge: promoted `.openprd/knowledge/candidates/candidate-turn-1780116203372-5f266a79e968c758` into `.openprd/knowledge/skills/openprd-experience-diagnostic-candidate-turn-1780116203372-5f266a79e968c758/SKILL.md`.
