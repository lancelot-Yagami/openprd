/*
 * 核心功能
 * 编排 OpenPrd loop 的规划、提示词生成、Agent 子会话运行、finish 和回归报告。
 *
 * 输入
 * 接收项目路径、change/task 选择、Agent 类型、执行/修复参数和 loop 状态文件。
 *
 * 输出
 * 写入 loop prompt、session 事件、进度状态和测试报告，并导出 loop workspace 函数。
 *
 * 定位
 * 位于 OpenPrd 长程单任务执行层，连接 OpenSpec task、quality、learning review 与 Agent runtime。
 *
 * 依赖
 * 依赖 openspec、quality、learning-review、knowledge、html-artifacts 和 codex-runtime 模块。
 *
 * 维护规则
 * 新增执行入口必须保持 dry-run 可见、失败可诊断；真实 Codex 子会话启动前需保留 runtime preflight。
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { buildTaskCommitMessage } from './change-summary.js';
import { ensureCodexCliReady } from './codex-runtime.js';
import { describeExecutionStrategy, labelOwnerRole, taskExecutionStrategy } from './execution-strategy.js';
import { defaultRegressionArtifactPath, renderRegressionArtifact, writeHtmlArtifact } from './html-artifacts.js';
import { OPENPRD_HARNESS_TURN_STATE, recordKnowledgeReviewSignal, reviewKnowledgeWorkspace } from './knowledge.js';
import { generateLearningReviewWorkspace } from './learning-review.js';
import { listOpenSpecTaskWorkspace, advanceOpenSpecTaskWorkspace, verifyOpenSpecTaskWorkspace } from './openspec/execute.js';
import { validateOpenSpecChangeWorkspace } from './openspec/change-validate.js';
import { verifyQualityWorkspace } from './quality.js';
import { appendReleaseEntry, getCurrentReleaseEntry, loadReleaseLedger, saveReleaseLedger, updateReleaseTag } from './release-ledger.js';
import { describeTestStrategy, taskTestStrategy } from './test-strategy.js';
import { timestamp } from './time.js';

const LOOP_FEATURE_LIST = path.join('.openprd', 'harness', 'feature-list.json');
const LOOP_STATE = path.join('.openprd', 'harness', 'loop-state.json');
const LOOP_PROGRESS = path.join('.openprd', 'harness', 'progress.md');
const LOOP_FAILED_APPROACHES = path.join('.openprd', 'harness', 'failed-approaches.md');
const LOOP_SESSIONS = path.join('.openprd', 'harness', 'agent-sessions.jsonl');
const LOOP_BOOTSTRAP = path.join('.openprd', 'harness', 'bootstrap.sh');
const LOOP_PROMPTS_DIR = path.join('.openprd', 'harness', 'loop-prompts');
const LOOP_TEST_REPORTS_DIR = path.join('.openprd', 'harness', 'test-reports');
const LOOP_AGENT_VALUES = ['codex', 'claude'];

function cjoin(...parts) {
  return path.join(...parts);
}

function exists(filePath) {
  return fs.access(filePath).then(() => true).catch(() => false);
}

async function readText(filePath) {
  return fs.readFile(filePath, 'utf8');
}

async function writeText(filePath, text) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, text, 'utf8');
}

async function appendText(filePath, text) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.appendFile(filePath, text, 'utf8');
}

async function readJson(filePath) {
  return JSON.parse(await readText(filePath));
}

async function writeJson(filePath, value) {
  await writeText(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function appendJsonl(filePath, value) {
  await appendText(filePath, `${JSON.stringify(value)}\n`);
}

function harnessPath(projectRoot, relativePath) {
  return cjoin(projectRoot, relativePath);
}

function normalizeAgent(agent = 'codex') {
  if (!LOOP_AGENT_VALUES.includes(agent)) {
    throw new Error(`Unsupported loop agent: ${agent}. Use codex or claude.`);
  }
  return agent;
}

function slugifyLoopToken(value, fallback = 'task') {
  const slug = String(value ?? '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return slug || fallback;
}

function buildTaskHandle(changeId, task) {
  return [
    slugifyLoopToken(changeId ?? 'change', 'change'),
    String(task.id ?? 'task').trim() || 'task',
    slugifyLoopToken(task.title ?? task.id ?? 'task', 'task'),
  ].join(':');
}

function normalizeTaskReference(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .trim()
    .toLowerCase();
}

function taskReferenceCandidates(task) {
  return new Set([
    task.id,
    task.title,
    task.taskHandle,
    task.taskSlug,
    task.changeId && task.id ? `${task.changeId}:${task.id}` : null,
    task.id && task.taskSlug ? `${task.id}:${task.taskSlug}` : null,
  ].filter(Boolean).map((item) => normalizeTaskReference(item)));
}

function bootstrapScript() {
  return [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    'ROOT="${1:-$(pwd)}"',
    'cd "$ROOT"',
    'echo "[openprd-loop] workspace: $PWD"',
    'openprd doctor . --tools all',
    'openprd run . --context',
    'git status --short || true',
    '',
  ].join('\n');
}

async function ensureLoopFiles(projectRoot) {
  await fs.mkdir(harnessPath(projectRoot, path.dirname(LOOP_FEATURE_LIST)), { recursive: true });
  await fs.mkdir(harnessPath(projectRoot, LOOP_PROMPTS_DIR), { recursive: true });
  await fs.mkdir(harnessPath(projectRoot, LOOP_TEST_REPORTS_DIR), { recursive: true });

  const bootstrapPath = harnessPath(projectRoot, LOOP_BOOTSTRAP);
  if (!(await exists(bootstrapPath))) {
    await writeText(bootstrapPath, bootstrapScript());
    await fs.chmod(bootstrapPath, 0o755).catch(() => {});
  }
  if (!(await exists(harnessPath(projectRoot, LOOP_PROGRESS)))) {
    await writeText(harnessPath(projectRoot, LOOP_PROGRESS), '# OpenPrd Loop Progress\n\n');
  }
  if (!(await exists(harnessPath(projectRoot, LOOP_FAILED_APPROACHES)))) {
    await writeText(
      harnessPath(projectRoot, LOOP_FAILED_APPROACHES),
      '# OpenPrd Failed Approaches\n\nRecord dead ends, mismatches, and why they were rejected so the next session does not repeat them.\n',
    );
  }
  if (!(await exists(harnessPath(projectRoot, LOOP_SESSIONS)))) {
    await writeText(harnessPath(projectRoot, LOOP_SESSIONS), '');
  }
  if (!(await exists(harnessPath(projectRoot, LOOP_STATE)))) {
    await writeJson(harnessPath(projectRoot, LOOP_STATE), {
      version: 1,
      active: true,
      currentTaskId: null,
      currentTaskHandle: null,
      currentTaskTitle: null,
      completedTaskIds: [],
      lastAgent: null,
      lastSessionAt: null,
      updatedAt: timestamp(),
    });
  }
}

function taskDeps(task) {
  const deps = task.metadata?.deps ?? '';
  return String(deps)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function combinedLoopEvidenceText(options = {}) {
  return [options.notes, options.evidence]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

function validateLoopFinishEvidence(task, options = {}) {
  const evidenceText = combinedLoopEvidenceText(options);
  if (!task.oracle) {
    return { ok: true, evidenceText };
  }
  if (evidenceText) {
    return { ok: true, evidenceText };
  }
  return {
    ok: false,
    evidenceText,
    error: `任务 ${task.id} 定义了 oracle/reference 对照基准；loop finish 时必须通过 --notes 或 --evidence 记录本轮对照结果。`,
  };
}

function renderFailedApproachEntry({ task, stage, reason, verification, notes, evidence }) {
  return [
    `\n## ${timestamp()} ${task.id} ${task.title}`,
    '',
    `- 阶段: ${stage}`,
    task.oracle ? `- 对照基准: ${task.oracle}` : null,
    verification?.command ? `- 自测命令: ${verification.command}` : null,
    `- 原因: ${reason}`,
    notes ? `- 备注: ${notes}` : null,
    evidence ? `- 补充证据: ${evidence}` : null,
    verification?.stdout ? `- 输出摘要: ${trimOutput(verification.stdout).replace(/\s+/g, ' ')}` : null,
    verification?.stderr ? `- 错误摘要: ${trimOutput(verification.stderr).replace(/\s+/g, ' ')}` : null,
    '',
  ].filter(Boolean).join('\n');
}

async function appendFailedApproach(projectRoot, payload) {
  await appendText(harnessPath(projectRoot, LOOP_FAILED_APPROACHES), renderFailedApproachEntry(payload));
}

function featureTaskFromOpenSpecTask(task, changeId) {
  const deps = taskDeps(task);
  const taskSlug = slugifyLoopToken(task.title ?? task.id ?? 'task', 'task');
  const testStrategy = taskTestStrategy(task);
  const executionStrategy = taskExecutionStrategy(task);
  return {
    id: task.id,
    title: task.title,
    taskSlug,
    taskHandle: buildTaskHandle(changeId, task),
    status: task.checked ? 'done' : 'pending',
    changeId,
    sourceTaskId: task.id,
    sourcePath: task.relativePath,
    sourceLine: task.lineNumber,
    deps,
    type: task.metadata?.type ?? task.metadata?.category ?? task.metadata?.kind ?? null,
    done: task.metadata?.done ?? null,
    verify: task.metadata?.verify ?? null,
    oracle: task.metadata?.oracle ?? null,
    testStrategy,
    testStrategyDescription: describeTestStrategy(testStrategy),
    executionStrategy,
    executionStrategyDescription: describeExecutionStrategy(executionStrategy),
    commitMessage: buildTaskCommitMessage(task),
    sessionScope: [
      '只处理这个任务，不要在同一会话继续下一个任务。',
      '完成代码后必须先自测，失败就修复并重新自测。',
      '代码修改完成后、最终回复前，针对本轮实际 touched code files 运行 `openprd dev-check . <file...>`；若出现需要关注的文件，最终回复直接复用 dev-check 生成的 **后续建议** 表格说明影响对象、关注程度、本次处理结果和后续建议，并保留“关注程度”列里的完整风险标签，不要缩成纯 emoji；如果你改写了“预警原因 / 本次处理结果 / 后续建议”，先用 `node scripts/dev-check-wrapup-copy.mjs --validate` 校验每格不超过 20 字；若报错，按提示缩短后重试。',
      '涉及前端界面时，在 Codex 客户端优先使用 Computer Use；在 Codex CLI 或 Claude Code 中优先使用 Playwright、MCP 或等价浏览器自动化。',
      '纯后端、脚本或库任务使用最贴近项目的脚本、单测、集成测试或命令行验证。',
      `本任务测试策略: ${describeTestStrategy(testStrategy)}`,
      `本任务执行策略: ${describeExecutionStrategy(executionStrategy)}`,
      executionStrategy.ownerRole === 'worker'
        ? `当前会话角色: ${labelOwnerRole(executionStrategy.ownerRole)}；写入范围限制为 ${executionStrategy.writeScope.join(', ')}，最终集成和总验证由主 Agent 负责。`
        : `当前会话角色: ${labelOwnerRole(executionStrategy.ownerRole)}；由主 Agent 直接推进并负责最终集成。`,
      '涉及后端、脚本、Agent、工具链、服务或数据处理变更时，把 CLI 与 API 视为同级接入面；检查命令入口、参数、输出契约、`help`/`doctor`/`dry-run`/`status` 与接口协议、返回结构、身份边界是否受影响，并同步更新 `docs/basic/backend-structure.md`；若某一面不适用也要明确写原因。',
      '新增或修改文件时先做文档影响判定：缺少 docs/basic、文件说明书或文件夹 README 就补齐；已有文档若因本任务职责、流程、结构、依赖或产品行为变化而过期，就同步更新。',
    ],
    updatedAt: timestamp(),
  };
}

function mergeExistingTaskState(existing, nextTask) {
  if (!existing) return nextTask;
  const preservedStatus = ['running', 'verified', 'done', 'failed', 'blocked'].includes(existing.status)
    ? existing.status
    : nextTask.status;
  return {
    ...nextTask,
    status: nextTask.status === 'done' ? 'done' : preservedStatus,
    lastSessionId: existing.lastSessionId ?? null,
    lastSessionAt: existing.lastSessionAt ?? null,
    lastVerifiedAt: existing.lastVerifiedAt ?? null,
    lastCommittedAt: existing.lastCommittedAt ?? null,
    commitSha: existing.commitSha ?? null,
    updatedAt: timestamp(),
  };
}

async function readFeatureList(projectRoot) {
  const filePath = harnessPath(projectRoot, LOOP_FEATURE_LIST);
  if (!(await exists(filePath))) return null;
  return readJson(filePath);
}

function buildLoopSummary(featureList) {
  const tasks = featureList?.tasks ?? [];
  return {
    total: tasks.length,
    done: tasks.filter((task) => task.status === 'done').length,
    pending: tasks.filter((task) => task.status === 'pending').length,
    running: tasks.filter((task) => task.status === 'running').length,
    verified: tasks.filter((task) => task.status === 'verified').length,
    failed: tasks.filter((task) => task.status === 'failed').length,
    blocked: tasks.filter((task) => task.status === 'blocked').length,
  };
}

function dependencyState(task, tasks) {
  const taskById = new Map(tasks.map((item) => [item.id, item]));
  const missing = [];
  const incomplete = [];
  for (const depId of task.deps ?? []) {
    const dep = taskById.get(depId);
    if (!dep) {
      missing.push(depId);
    } else if (dep.status !== 'done') {
      incomplete.push(depId);
    }
  }
  return {
    missing,
    incomplete,
    ready: missing.length === 0 && incomplete.length === 0,
  };
}

function resolveLoopTask(featureList, requestedRef) {
  const tasks = featureList?.tasks ?? [];
  const normalized = normalizeTaskReference(requestedRef);
  const matches = tasks.filter((task) => taskReferenceCandidates(task).has(normalized));
  if (matches.length === 1) {
    return matches[0];
  }
  if (matches.length > 1) {
    throw new Error(`Ambiguous OpenPrd loop task reference: ${requestedRef}`);
  }
  throw new Error(`Unknown OpenPrd loop task: ${requestedRef}`);
}

function nextLoopTask(featureList, requestedId = null) {
  const tasks = featureList?.tasks ?? [];
  if (requestedId) {
    const task = resolveLoopTask(featureList, requestedId);
    return { task, dependencyState: dependencyState(task, tasks) };
  }
  for (const task of tasks) {
    if (!['pending', 'failed'].includes(task.status)) continue;
    const state = dependencyState(task, tasks);
    if (state.ready) return { task, dependencyState: state };
  }
  return { task: null, dependencyState: null };
}

async function writeFeatureList(projectRoot, featureList) {
  await writeJson(harnessPath(projectRoot, LOOP_FEATURE_LIST), featureList);
}

async function updateLoopState(projectRoot, patch) {
  const statePath = harnessPath(projectRoot, LOOP_STATE);
  const state = (await exists(statePath)) ? await readJson(statePath) : {};
  const next = {
    version: 1,
    active: true,
    ...state,
    ...patch,
    updatedAt: timestamp(),
  };
  await writeJson(statePath, next);
  return next;
}

function renderProgressEntry(title, lines) {
  return `\n## ${title}\n\n${lines.filter(Boolean).map((line) => `- ${line}`).join('\n')}\n`;
}

function shellJoin(args) {
  return args.map((arg) => {
    const text = String(arg);
    if (/^[a-zA-Z0-9_./:=@-]+$/.test(text)) return text;
    return `'${text.replace(/'/g, "'\\''")}'`;
  }).join(' ');
}

function defaultAgentInvocation(agent, projectRoot, promptPath) {
  if (agent === 'codex') {
    return {
      command: 'codex',
      args: ['exec', '--full-auto', '-C', projectRoot, '-'],
      stdinFile: promptPath,
      display: `codex exec --full-auto -C ${shellJoin([projectRoot])} - < ${shellJoin([promptPath])}`,
    };
  }
  return {
    command: 'claude',
    args: ['--print', '--permission-mode', 'auto', '--output-format', 'text'],
    stdinFile: promptPath,
    display: `claude --print --permission-mode auto --output-format text < ${shellJoin([promptPath])}`,
  };
}

function renderLoopPrompt({ agent, projectRoot, featureList, task, dependency, mode }) {
  const screenshotPath = screenshotHintPath(projectRoot, task.id);
  const frontendStrategy = [
    '- 如果任务涉及页面、组件、样式、前端交互或浏览器行为，必须做界面级验证。',
    '- Codex 客户端环境: 优先使用 Computer Use 以第三方视角打开页面、点击、输入、截图或读取可访问性树。',
    '- Codex CLI / Claude Code 环境: 优先使用 Playwright、MCP 浏览器自动化或项目已有 e2e 工具。',
    `- 如需截图证据，默认保存到 ${screenshotPath}，并在 loop finish 时通过 --evidence 传入该路径。`,
    '- 每次发现问题后先修复，再重新运行验证；验证通过后才能提交。',
  ];
  return [
    '# OpenPrd 长程单任务执行会话',
    '',
    `Agent: ${agent}`,
    `模式: ${mode}`,
    `项目: ${projectRoot}`,
    `变更: ${task.changeId}`,
    `任务: ${task.id} ${task.title}`,
    `任务句柄: ${task.taskHandle}`,
    '',
    '## Harness 契约',
    '',
    '你正在运行一个隔离的 OpenPrd loop 单任务会话。本会话不假设拥有前一个会话的对话记忆。',
    '连续性只来自项目文件、OpenPrd 状态文件、测试报告和 Git 历史。',
    '',
    '## 启动步骤',
    '',
    '1. 读取 `AGENTS.md`，遵守 OpenPrd managed block。',
    '2. 如存在 `.openprd/harness/bootstrap.sh`，先运行 `.openprd/harness/bootstrap.sh .`。',
    '3. 查看 `git status --short`，不要覆盖无关用户改动。',
    '4. 读取 `.openprd/harness/feature-list.json`、`.openprd/harness/progress.md`、`.openprd/harness/failed-approaches.md` 和本任务来源文件。',
    '',
    '## 单任务边界',
    '',
    `只实现任务 ${task.id}: ${task.title}`,
    `跨对话继续请引用: ${task.taskHandle}`,
    `完成条件: ${task.done ?? '未指定'}`,
    `自测命令: ${task.verify ?? '未指定'}`,
    `测试策略: ${task.testStrategyDescription ?? describeTestStrategy(taskTestStrategy(task))}`,
    `执行策略: ${task.executionStrategyDescription ?? describeExecutionStrategy(task.executionStrategy ?? taskExecutionStrategy(task))}`,
    `当前角色: ${labelOwnerRole(task.executionStrategy?.ownerRole ?? taskExecutionStrategy(task).ownerRole)}`,
    `写入范围: ${(task.executionStrategy?.writeScope ?? taskExecutionStrategy(task).writeScope).join(', ')}`,
    `局部验证: ${task.executionStrategy?.localVerify ?? taskExecutionStrategy(task).localVerify}`,
    `最终集成 owner: ${task.executionStrategy?.integrationOwner ?? taskExecutionStrategy(task).integrationOwner}`,
    `对照基准: ${task.oracle ?? '未指定'}`,
    `依赖是否就绪: ${dependency?.ready ? '是' : '否'}`,
    dependency?.missing?.length ? `缺失依赖: ${dependency.missing.join(', ')}` : '',
    dependency?.incomplete?.length ? `未完成依赖: ${dependency.incomplete.join(', ')}` : '',
    `来源: ${task.sourcePath}:${task.sourceLine}`,
    '',
    '不要开始下一个任务。如果发现任务仍然过大，先拆分任务文件，并只完成最小可用切片。',
    task.oracle ? '如果任务定义了对照基准，必须显式对照 reference/oracle，并把偏差、死路或替代方案记到 `.openprd/harness/failed-approaches.md`。' : '',
    '代码修改完成后、最终回复前，针对本轮实际 touched code files 运行 `openprd dev-check . <file...>`；若出现需要关注的文件，最终回复直接复用 dev-check 生成的 **后续建议** 表格说明影响对象、关注程度、本次处理结果和后续建议，并保留“关注程度”列里的完整风险标签，不要缩成纯 emoji；如果你改写了“预警原因 / 本次处理结果 / 后续建议”，先用 `node scripts/dev-check-wrapup-copy.mjs --validate` 校验每格不超过 20 字；若报错，按提示缩短后重试。',
    '',
    '## 自测与界面验证要求',
    '',
    '1. 先按本任务测试策略选择最小足够证据：小范围逻辑优先单测，契约/跨模块用集成，用户主路径或运行态用端到端/专项验证。',
    '2. 必须运行本任务的自测命令，并把结果作为 task-scoped evidence 记录。',
    '3. 不要在每个 task 中运行全局 `openprd run . --verify`；它只用于无下一任务的阶段收口或高风险动作前。',
    ...frontendStrategy,
    '6. 阶段性测试报告会由 `openprd loop . --finish` 写入 `.openprd/harness/test-reports/`，并与本任务改动一起进入 commit。',
    '',
    '## 收尾步骤',
    '',
    '1. 确认本任务自测、界面验证和 evidence 记录都已经通过。',
    '2. 留下简洁总结，说明改动文件和验证结果。',
    '3. 如果这是手动执行 prompt，用以下命令结束任务并提交:',
    task.oracle
      ? `   openprd loop . --finish --item ${task.id} --commit --notes "<oracle/result summary>" --message ${JSON.stringify(task.commitMessage)}`
      : `   openprd loop . --finish --item ${task.id} --commit --message ${JSON.stringify(task.commitMessage)}`,
    '',
    '## 任务快照',
    '',
    JSON.stringify({
      version: featureList.version,
      changeId: featureList.changeId,
      summary: buildLoopSummary(featureList),
      task: {
        id: task.id,
        title: task.title,
        taskHandle: task.taskHandle,
        status: task.status,
        type: task.type,
        deps: task.deps,
        done: task.done,
        verify: task.verify,
        oracle: task.oracle,
        testStrategy: task.testStrategy ?? taskTestStrategy(task),
        executionStrategy: task.executionStrategy ?? taskExecutionStrategy(task),
      },
    }, null, 2),
    '',
  ].filter((line) => line !== '').join('\n');
}

async function runCommand(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      shell: Boolean(options.shell),
      env: options.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', (error) => resolve({ ok: false, status: null, stdout, stderr, error: error.message }));
    child.on('close', (status) => resolve({ ok: status === 0, status, stdout, stderr }));
    if (options.stdin) {
      child.stdin.write(options.stdin);
    }
    child.stdin.end();
  });
}

async function gitCommit(projectRoot, message) {
  const status = await runCommand('git', ['status', '--porcelain'], { cwd: projectRoot });
  if (!status.ok) {
    return { ok: false, skipped: false, message: 'git status 执行失败', status };
  }
  if (!status.stdout.trim()) {
    return { ok: true, skipped: true, message: '没有需要提交的 Git 变更。' };
  }
  const add = await runCommand('git', ['add', '-A'], { cwd: projectRoot });
  if (!add.ok) {
    return { ok: false, skipped: false, message: 'git add 执行失败', add };
  }
  const commit = await runCommand('git', ['commit', '-m', message], { cwd: projectRoot });
  if (!commit.ok) {
    return { ok: false, skipped: false, message: 'git commit 执行失败', commit };
  }
  const rev = await runCommand('git', ['rev-parse', '--short', 'HEAD'], { cwd: projectRoot });
  return {
    ok: true,
    skipped: false,
    message: '已提交',
    sha: rev.stdout.trim() || null,
    commit,
  };
}

async function gitCheckTagName(projectRoot, tagName) {
  return runCommand('git', ['check-ref-format', '--allow-onelevel', `refs/tags/${tagName}`], { cwd: projectRoot });
}

async function gitReadLocalTagSha(projectRoot, tagName) {
  const result = await runCommand('git', ['rev-parse', '-q', '--verify', `refs/tags/${tagName}`], { cwd: projectRoot });
  if (!result.ok) return null;
  return result.stdout.trim() || null;
}

async function gitReadRemoteTagSha(projectRoot, tagName) {
  const remote = await runCommand('git', ['remote', 'get-url', 'origin'], { cwd: projectRoot });
  if (!remote.ok) {
    return { status: 'no-remote', sha: null, warning: null };
  }
  const result = await runCommand('git', ['ls-remote', '--tags', '--refs', 'origin', `refs/tags/${tagName}`], { cwd: projectRoot });
  if (!result.ok) {
    return {
      status: 'unknown',
      sha: null,
      warning: `无法确认远端 tag ${tagName} 的状态；本地 tag 仍会按当前 commit 更新。`,
    };
  }
  const line = result.stdout.trim();
  if (!line) {
    return { status: 'absent', sha: null, warning: null };
  }
  return { status: 'present', sha: line.split(/\s+/u)[0] ?? null, warning: null };
}

async function syncLocalVersionTag(projectRoot, version, sha) {
  const tagName = String(version ?? '').trim();
  if (!tagName || !sha) {
    return { ok: true, skipped: true, tagName: tagName || null, warning: null };
  }

  const valid = await gitCheckTagName(projectRoot, tagName);
  if (!valid.ok) {
    return {
      ok: false,
      skipped: true,
      tagName,
      warning: `项目版本 ${tagName} 不能安全地作为 git tag 名称；已跳过本地 tag 更新。`,
    };
  }

  const localSha = await gitReadLocalTagSha(projectRoot, tagName);
  const remote = await gitReadRemoteTagSha(projectRoot, tagName);
  if (remote.status === 'present' && remote.sha && remote.sha !== sha) {
    return {
      ok: false,
      skipped: true,
      tagName,
      localSha,
      remoteSha: remote.sha,
      remoteStatus: remote.status,
      warning: `远端已有同名 tag ${tagName} 指向 ${remote.sha.slice(0, 7)}；为避免改写历史，已跳过本地 tag 移动。`,
    };
  }

  if (localSha === sha) {
    return {
      ok: true,
      skipped: false,
      tagName,
      localSha,
      remoteSha: remote.sha,
      remoteStatus: remote.status,
      warning: remote.warning,
    };
  }

  const command = localSha ? ['tag', '-f', tagName, sha] : ['tag', tagName, sha];
  const result = await runCommand('git', command, { cwd: projectRoot });
  if (!result.ok) {
    return {
      ok: false,
      skipped: true,
      tagName,
      localSha,
      remoteSha: remote.sha,
      remoteStatus: remote.status,
      warning: `git tag ${tagName} 更新失败：${trimOutput(result.stderr || result.stdout)}`,
    };
  }

  const nextLocalSha = await gitReadLocalTagSha(projectRoot, tagName);
  return {
    ok: true,
    skipped: false,
    tagName,
    localSha: nextLocalSha,
    remoteSha: remote.sha,
    remoteStatus: remote.status,
    warning: remote.warning,
  };
}

async function updateReleaseLedgerAfterFinish(projectRoot, task, commitSha = null) {
  const loaded = await loadReleaseLedger(projectRoot);
  const current = getCurrentReleaseEntry(loaded.ledger);
  if (!loaded.ledger.enabled || !current?.version) {
    return null;
  }
  if (current.status === 'released') {
    return {
      version: current.version,
      skipped: true,
      warnings: [`项目版本 ${current.version} 已标记为 released；本次任务不会自动累计到这个版本。`],
      tag: null,
    };
  }

  let ledger = loaded.ledger;
  const appended = appendReleaseEntry(ledger, task.done ?? task.title ?? task.id, {
    version: current.version,
    fallbackType: '调整',
    source: {
      kind: 'loop-finish',
      changeId: task.changeId ?? null,
      taskId: task.id ?? null,
      taskHandle: task.taskHandle ?? null,
      commitSha: commitSha ?? null,
    },
  });
  ledger = appended.ledger;

  let tag = null;
  if (commitSha) {
    tag = await syncLocalVersionTag(projectRoot, current.version, commitSha);
    const tagged = updateReleaseTag(ledger, {
      version: current.version,
      name: tag.tagName ?? current.version,
      localSha: tag.localSha ?? null,
      remoteSha: tag.remoteSha ?? null,
      remoteStatus: tag.remoteStatus ?? null,
      warning: tag.warning ?? null,
      updatedAt: timestamp(),
    });
    ledger = tagged.ledger;
  }

  await saveReleaseLedger(projectRoot, ledger);
  return {
    version: current.version,
    skipped: false,
    added: appended.added,
    warnings: tag?.warning ? [tag.warning] : [],
    tag,
  };
}

function trimOutput(value) {
  const text = String(value ?? '').trim();
  if (!text) return '无';
  return text.length > 4000 ? `${text.slice(-4000)}\n...` : text;
}

function reportFileName(taskId) {
  return `${taskId.replace(/[^a-zA-Z0-9._-]/g, '_')}.md`;
}

function inferUiVerificationHint(task, agent = 'codex') {
  const text = `${task.title} ${task.done ?? ''} ${task.verify ?? ''}`.toLowerCase();
  const looksFrontend = /前端|界面|页面|组件|样式|布局|浏览器|ui|css|html|react|vue|svelte|playwright|e2e/.test(text);
  if (!looksFrontend) {
    return '未识别为前端界面任务；请以任务自测命令、单测、集成测试或脚本验证为主。';
  }
  if (agent === 'codex') {
    return '识别为前端界面任务；Codex 客户端优先使用 Computer Use，Codex CLI 优先使用 Playwright/MCP 浏览器自动化。';
  }
  return '识别为前端界面任务；Claude Code 优先使用 Playwright、MCP 浏览器自动化或项目已有 e2e 工具。';
}

function screenshotHintPath(projectRoot, taskId) {
  return harnessPath(projectRoot, cjoin(LOOP_TEST_REPORTS_DIR, 'evidence', `${taskId.replace(/[^a-zA-Z0-9._-]/g, '_')}.png`));
}

function parseEvidenceArtifacts(projectRoot, evidenceText) {
  const raw = String(evidenceText ?? '').trim();
  if (!raw) {
    return { screenshots: [], textualEvidence: [] };
  }
  const entries = raw.split(/\n+/).map((item) => item.trim()).filter(Boolean);
  const screenshots = [];
  const textualEvidence = [];
  for (const entry of entries) {
    const normalized = entry.replace(/^screenshot:\s*/i, '').trim();
    if (/\.(png|jpe?g|webp|gif)$/i.test(normalized)) {
      const absolute = path.isAbsolute(normalized) ? normalized : path.resolve(projectRoot, normalized);
      screenshots.push({
        path: absolute,
        url: pathToFileURL(absolute).href,
      });
    } else {
      textualEvidence.push(entry);
    }
  }
  return { screenshots, textualEvidence };
}

async function writeTestReport(projectRoot, { task, agent, advanced, change }) {
  const relativePath = cjoin(LOOP_TEST_REPORTS_DIR, reportFileName(task.id));
  const htmlRelativePath = cjoin(LOOP_TEST_REPORTS_DIR, `${task.id.replace(/[^a-zA-Z0-9._-]/g, '_')}.html`);
  const evidenceText = advanced.evidence ?? inferUiVerificationHint(task, agent);
  const notesText = advanced.notes ?? '无';
  const evidenceArtifacts = parseEvidenceArtifacts(projectRoot, evidenceText);
  const report = {
    version: 1,
    generatedAt: timestamp(),
    kind: inferUiVerificationHint(task, agent).includes('前端界面任务') ? 'ui-regression' : 'command-regression',
    verifyCommand: advanced.verification?.command ?? task.verify ?? '未指定',
    oracle: task.oracle ?? null,
    testStrategy: task.testStrategy ?? taskTestStrategy(task),
    summary: {
      total: 1,
      passed: advanced.verification?.ok ? 1 : 0,
      failed: advanced.verification?.ok ? 0 : 1,
    },
    cases: [
      {
        id: `${task.id}.verify`,
        title: task.title,
        expected: task.done ?? '满足任务完成条件',
        actual: advanced.verification?.ok ? '验证命令执行通过' : '验证命令失败或未通过',
        passed: Boolean(advanced.verification?.ok),
        oracle: task.oracle ?? null,
        evidence: evidenceText,
      },
    ],
    screenshots: evidenceArtifacts.screenshots,
    textualEvidence: evidenceArtifacts.textualEvidence,
    notes: notesText,
  };
  const lines = [
    `# 阶段性测试报告: ${task.id} ${task.title}`,
    '',
    `- 测试时间: ${timestamp()}`,
    `- 变更: ${task.changeId}`,
    `- 完成条件: ${task.done ?? '未指定'}`,
    `- 自测命令: ${advanced.verification?.command ?? task.verify ?? '未指定'}`,
    `- 测试策略: ${task.testStrategyDescription ?? describeTestStrategy(task.testStrategy ?? taskTestStrategy(task))}`,
    `- 对照基准: ${task.oracle ?? '未指定'}`,
    `- 自测结果: ${advanced.verification?.ok ? '通过' : '失败或未运行'}`,
    `- Change 校验: ${change.ok ? '通过' : '失败'}`,
    `- EVO 冒烟证据: ${advanced.verification?.ok ? 'smoke pass via task verify command' : 'smoke failed or missing'}`,
    `- EVO 功能覆盖证据: feature coverage checked against OpenPrd task completion`,
    `- 界面验证策略: ${inferUiVerificationHint(task, agent)}`,
    `- 补充证据: ${evidenceText}`,
    `- 备注: ${notesText}`,
    '',
    ...(evidenceArtifacts.screenshots.length > 0 ? [
      '## 截图证据',
      '',
      ...evidenceArtifacts.screenshots.flatMap((item) => [
        `- ${item.path}`,
        `![截图证据](${item.path})`,
      ]),
      '',
    ] : []),
    '## 自测输出',
    '',
    '```text',
    trimOutput(advanced.verification?.stdout),
    '```',
    '',
    '## 错误输出',
    '',
    '```text',
    trimOutput(advanced.verification?.stderr),
    '```',
    '',
    '## OpenPrd 校验摘要',
    '',
    ...(change.checks ?? []).map((check) => `- ${check}`),
    ...(change.warnings?.length ? ['', '## 警告', '', ...change.warnings.map((warning) => `- ${warning}`)] : []),
    ...(change.errors?.length ? ['', '## 错误', '', ...change.errors.map((error) => `- ${error}`)] : []),
    '',
  ];
  await writeText(harnessPath(projectRoot, relativePath), `${lines.join('\n')}\n`);
  const htmlPath = defaultRegressionArtifactPath(projectRoot, task.id);
  await writeHtmlArtifact(htmlPath, renderRegressionArtifact({ task, report }));
  return {
    markdownPath: relativePath,
    htmlPath: htmlRelativePath,
    report,
  };
}

export async function initLoopWorkspace(projectRoot, options = {}) {
  await ensureLoopFiles(projectRoot);
  const featureList = (await readFeatureList(projectRoot)) ?? {
    version: 1,
    generatedAt: timestamp(),
    updatedAt: timestamp(),
    projectRoot,
    changeId: options.change ?? null,
    policy: {
      oneTaskPerSession: true,
      requireVerify: true,
      requireCommit: true,
      continuity: 'files-and-git-history',
      executionModes: ['serial', 'parallel-workers', 'parallel-workers-isolated'],
      coordinationRule: 'main-agent assigns bounded worker shards and owns final review/integration',
    },
    source: 'openprd loop init',
    tasks: [],
  };
  await writeFeatureList(projectRoot, featureList);
  await appendText(harnessPath(projectRoot, LOOP_PROGRESS), renderProgressEntry(timestamp(), [
    'Loop harness 已初始化。',
    `默认 Agent: ${normalizeAgent(options.agent ?? 'codex')}。`,
  ]));
  return {
    ok: true,
    action: 'loop-init',
    projectRoot,
    files: {
      featureList: LOOP_FEATURE_LIST,
      loopState: LOOP_STATE,
      progress: LOOP_PROGRESS,
      failedApproaches: LOOP_FAILED_APPROACHES,
      sessions: LOOP_SESSIONS,
      bootstrap: LOOP_BOOTSTRAP,
      testReports: LOOP_TEST_REPORTS_DIR,
    },
    featureList,
  };
}

export async function planLoopWorkspace(projectRoot, options = {}) {
  await ensureLoopFiles(projectRoot);
  const taskState = await listOpenSpecTaskWorkspace(projectRoot, { change: options.change });
  const existing = await readFeatureList(projectRoot);
  const existingById = new Map((existing?.tasks ?? []).map((task) => [task.id, task]));
  const tasks = taskState.tasks.map((task) => mergeExistingTaskState(
    existingById.get(task.id),
    featureTaskFromOpenSpecTask(task, taskState.changeId),
  ));
  const featureList = {
    version: 1,
    generatedAt: existing?.generatedAt ?? timestamp(),
    updatedAt: timestamp(),
    projectRoot,
    changeId: taskState.changeId,
    changeDir: path.relative(projectRoot, taskState.changeDir),
    source: 'openprd loop plan',
    policy: {
      oneTaskPerSession: true,
      requireVerify: true,
      requireCommit: true,
      continuity: 'files-and-git-history',
      agentSessionRule: 'start a new Codex or Claude session for exactly one task',
      testReportRule: 'write one staged test report before each task commit',
      executionModes: ['serial', 'parallel-workers', 'parallel-workers-isolated'],
      coordinationRule: 'main-agent assigns bounded worker shards and owns final review/integration',
      workerContract: ['write-scope', 'owner-role', 'local-verify', 'integration-owner'],
    },
    tasks,
  };
  await writeFeatureList(projectRoot, featureList);
  await appendText(harnessPath(projectRoot, LOOP_PROGRESS), renderProgressEntry(timestamp(), [
    `已从 change ${taskState.changeId} 规划 ${tasks.length} 个 loop 任务。`,
    '每个任务都是独立 Agent 会话边界。',
  ]));
  return {
    ok: true,
    action: 'loop-plan',
    projectRoot,
    changeId: taskState.changeId,
    featureList,
    summary: buildLoopSummary(featureList),
    next: nextLoopTask(featureList).task,
  };
}

export async function statusLoopWorkspace(projectRoot) {
  await ensureLoopFiles(projectRoot);
  const featureList = await readFeatureList(projectRoot);
  if (!featureList) {
    return {
      ok: false,
      action: 'loop-status',
      projectRoot,
      summary: buildLoopSummary(null),
      next: null,
      errors: ['Loop feature list is missing. Run openprd loop . --plan --change <id>.'],
    };
  }
  const { task, dependencyState: state } = nextLoopTask(featureList);
  return {
    ok: true,
    action: 'loop-status',
    projectRoot,
    changeId: featureList.changeId,
    summary: buildLoopSummary(featureList),
    next: task,
    dependencyState: state,
    files: {
      featureList: LOOP_FEATURE_LIST,
      progress: LOOP_PROGRESS,
      failedApproaches: LOOP_FAILED_APPROACHES,
      sessions: LOOP_SESSIONS,
    },
  };
}

export async function nextLoopWorkspace(projectRoot, options = {}) {
  const status = await statusLoopWorkspace(projectRoot);
  if (!status.ok) return status;
  if (options.item) {
    const featureList = await readFeatureList(projectRoot);
    const selected = nextLoopTask(featureList, options.item);
    return {
      ...status,
      action: 'loop-next',
      next: selected.task,
      dependencyState: selected.dependencyState,
    };
  }
  return { ...status, action: 'loop-next' };
}

export async function promptLoopWorkspace(projectRoot, options = {}) {
  await ensureLoopFiles(projectRoot);
  const agent = normalizeAgent(options.agent ?? 'codex');
  const featureList = await readFeatureList(projectRoot);
  if (!featureList) {
    throw new Error('Loop feature list is missing. Run openprd loop . --plan --change <id>.');
  }
  const { task, dependencyState: state } = nextLoopTask(featureList, options.item);
  if (!task) {
    return {
      ok: false,
      action: 'loop-prompt',
      projectRoot,
      agent,
      errors: ['当前没有可执行的 loop 任务。'],
    };
  }
  if (!state.ready) {
    return {
      ok: false,
      action: 'loop-prompt',
      projectRoot,
      agent,
      task,
      dependencyState: state,
      errors: [`任务 ${task.id} 尚未就绪。`],
    };
  }
  const prompt = renderLoopPrompt({
    agent,
    projectRoot,
    featureList,
    task,
    dependency: state,
    mode: options.mode ?? 'manual',
  });
  const promptFileName = `${task.id.replace(/[^a-zA-Z0-9._-]/g, '_')}-${agent}-${Date.now()}.md`;
  const promptPath = harnessPath(projectRoot, cjoin(LOOP_PROMPTS_DIR, promptFileName));
  await writeText(promptPath, prompt);
  const invocation = defaultAgentInvocation(agent, projectRoot, path.relative(projectRoot, promptPath));
  return {
    ok: true,
    action: 'loop-prompt',
    projectRoot,
    agent,
    task,
    dependencyState: state,
    prompt,
    promptPath: path.relative(projectRoot, promptPath),
    invocation,
  };
}

export async function verifyLoopWorkspace(projectRoot, options = {}) {
  await ensureLoopFiles(projectRoot);
  const featureList = await readFeatureList(projectRoot);
  if (!featureList) {
    throw new Error('Loop feature list is missing. Run openprd loop . --plan --change <id>.');
  }
  const { task, dependencyState: state } = nextLoopTask(featureList, options.item);
  if (!task) {
    const summary = buildLoopSummary(featureList);
    if (summary.total > 0 && summary.done === summary.total) {
      return {
        ok: true,
        action: 'loop-verify',
        projectRoot,
        summary,
        errors: [],
        checks: ['所有 OpenPrd loop 任务均已完成。'],
      };
    }
    return { ok: false, action: 'loop-verify', projectRoot, summary, errors: ['当前没有可执行的 loop 任务。'] };
  }
  if (!state.ready) {
    return { ok: false, action: 'loop-verify', projectRoot, task, dependencyState: state, errors: [`任务 ${task.id} 尚未就绪。`] };
  }
  const verify = await verifyOpenSpecTaskWorkspace(projectRoot, { change: task.changeId, item: task.sourceTaskId });
  return {
    ok: verify.ok,
    action: 'loop-verify',
    projectRoot,
    task,
    dependencyState: state,
    verify,
    errors: verify.ok ? [] : [verify.verification?.stderr || verify.verification?.stdout || `任务 ${task.id} 自测失败。`],
  };
}

function updateTask(featureList, taskId, patch) {
  return {
    ...featureList,
    updatedAt: timestamp(),
    tasks: featureList.tasks.map((task) => (
      task.id === taskId ? { ...task, ...patch, updatedAt: timestamp() } : task
    )),
  };
}

export async function finishLoopWorkspace(projectRoot, options = {}) {
  await ensureLoopFiles(projectRoot);
  const featureList = await readFeatureList(projectRoot);
  if (!featureList) {
    throw new Error('Loop feature list is missing. Run openprd loop . --plan --change <id>.');
  }
  const { task, dependencyState: state } = nextLoopTask(featureList, options.item);
  if (!task) {
    return { ok: false, action: 'loop-finish', projectRoot, errors: ['当前没有可执行的 loop 任务。'] };
  }
  if (!state.ready) {
    return { ok: false, action: 'loop-finish', projectRoot, task, dependencyState: state, errors: [`任务 ${task.id} 尚未就绪。`] };
  }

  const beforeChange = await validateOpenSpecChangeWorkspace(projectRoot, { change: task.changeId });
  if (!beforeChange.ok) {
    return {
      ok: false,
      action: 'loop-finish',
      projectRoot,
      task,
      change: beforeChange,
      errors: beforeChange.errors,
    };
  }

  const verification = await verifyOpenSpecTaskWorkspace(projectRoot, {
    change: task.changeId,
    item: task.sourceTaskId,
    evidence: options.evidence,
    notes: options.notes,
  });
  if (!verification.ok) {
    const failureReason = verification.verification?.stderr || verification.verification?.stdout || '自测失败';
    const failedList = updateTask(featureList, task.id, { status: 'failed', lastError: failureReason });
    await writeFeatureList(projectRoot, failedList);
    await appendFailedApproach(projectRoot, {
      task,
      stage: 'task-verify',
      reason: failureReason,
      verification: verification.verification,
      notes: options.notes ?? null,
      evidence: options.evidence ?? null,
    });
    return {
      ok: false,
      action: 'loop-finish',
      projectRoot,
      task,
      verification,
      errors: [failureReason || `任务 ${task.id} 自测失败。`],
    };
  }

  const finishEvidence = validateLoopFinishEvidence(task, options);
  if (!finishEvidence.ok) {
    const failedList = updateTask(featureList, task.id, { status: 'failed', lastError: finishEvidence.error });
    await writeFeatureList(projectRoot, failedList);
    await appendFailedApproach(projectRoot, {
      task,
      stage: 'finish-evidence',
      reason: finishEvidence.error,
      verification: verification.verification,
      notes: options.notes ?? null,
      evidence: options.evidence ?? null,
    });
    return {
      ok: false,
      action: 'loop-finish',
      projectRoot,
      task,
      verification,
      errors: [finishEvidence.error],
    };
  }

  const advanced = await advanceOpenSpecTaskWorkspace(projectRoot, {
    change: task.changeId,
    item: task.sourceTaskId,
    verify: false,
    evidence: options.evidence,
    notes: options.notes,
  });
  if (!advanced.ok) {
    const failureReason = advanced.errors?.[0] ?? `任务 ${task.id} 标记完成失败。`;
    const failedList = updateTask(featureList, task.id, { status: 'failed', lastError: failureReason });
    await writeFeatureList(projectRoot, failedList);
    await appendFailedApproach(projectRoot, {
      task,
      stage: 'task-advance',
      reason: failureReason,
      verification: verification.verification,
      notes: options.notes ?? null,
      evidence: options.evidence ?? null,
    });
    return {
      ok: false,
      action: 'loop-finish',
      projectRoot,
      task,
      verification,
      advanced,
      errors: [failureReason],
    };
  }
  const change = beforeChange;
  const finishResult = {
    ...advanced,
    verification: verification.verification,
  };

  let commit = null;
  const testReport = await writeTestReport(projectRoot, {
    task,
    agent: options.agent ?? 'codex',
    advanced: {
      ...finishResult,
      evidence: options.evidence ?? null,
      notes: options.notes ?? null,
    },
    change,
  });
  if (options.commit) {
    commit = await gitCommit(projectRoot, options.message ?? task.commitMessage);
    if (!commit.ok) {
      return {
        ok: false,
        action: 'loop-finish',
        projectRoot,
        task,
        advanced: finishResult,
        change,
        commit,
        errors: [commit.message],
      };
    }
  }

  const projectRelease = await updateReleaseLedgerAfterFinish(
    projectRoot,
    task,
    commit && !commit.skipped ? commit.sha : null,
  ).catch((error) => ({
    skipped: true,
    warnings: [error instanceof Error ? error.message : String(error)],
    tag: null,
  }));

  const updatedList = updateTask(featureList, task.id, {
    status: 'done',
    lastVerifiedAt: timestamp(),
    lastCommittedAt: commit && !commit.skipped ? timestamp() : null,
    commitSha: commit?.sha ?? null,
    lastTestReport: testReport.markdownPath,
  });
  const nextAfterFinish = nextLoopTask(updatedList).task;
  let quality = null;
  if (!nextAfterFinish) {
    quality = await verifyQualityWorkspace(projectRoot, { strict: true }).catch((error) => ({
      ok: false,
      action: 'quality-verify',
      errors: [error instanceof Error ? error.message : String(error)],
    }));
    const productionReady = quality.report?.readiness?.productionReady ?? null;
    if (!quality.ok || productionReady === false) {
      const attentionGates = quality.report?.readiness?.attentionGates ?? [];
      const qualityError = [
        'Final EVO quality gate is not production-ready.',
        attentionGates.length > 0 ? `Attention gates: ${attentionGates.join(', ')}` : null,
        quality.htmlPath ? `HTML report: ${path.relative(projectRoot, quality.htmlPath)}` : null,
      ].filter(Boolean).join(' ');
      const failedList = updateTask(featureList, task.id, {
        status: 'failed',
        lastError: qualityError,
        lastTestReport: testReport.markdownPath,
      });
      await writeFeatureList(projectRoot, failedList);
      await appendFailedApproach(projectRoot, {
        task,
        stage: 'final-quality',
        reason: qualityError,
        verification: verification.verification,
        notes: options.notes ?? null,
        evidence: options.evidence ?? null,
      });
      return {
        ok: false,
        action: 'loop-finish',
        projectRoot,
        task,
        advanced: finishResult,
        change,
        commit,
        testReport: testReport.markdownPath,
        regressionHtml: testReport.htmlPath,
        quality,
        errors: [qualityError, ...(quality.errors ?? [])],
      };
    }
  }
  await writeFeatureList(projectRoot, updatedList);
  let learningReview = null;
  try {
    learningReview = await generateLearningReviewWorkspace(projectRoot, {
      trigger: 'loop-finish',
      topic: `${task.id} ${task.title}`,
      sourceScope: 'loop',
      respectConfig: true,
      taskId: task.id,
      changeId: task.changeId,
      verifyCommand: finishResult.verification?.command ?? task.verify ?? null,
      testReport: testReport.markdownPath,
      commitSha: commit?.sha ?? null,
    });
  } catch (error) {
    learningReview = {
      ok: false,
      action: 'learning-review-generate',
      skipped: false,
      opened: false,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
  const learningProgress = learningReview?.skipped
    ? [`复盘学习: 已跳过 (${learningReview.reason})。`]
    : learningReview?.ok
      ? [
        `复盘学习包: ${learningReview.packageId}。`,
        `复盘写作状态: ${learningReview.packageMeta?.authoringStatus ?? 'unknown'}。`,
        `学习阅读器: ${path.relative(projectRoot, learningReview.packagePaths.readerHtml)}。`,
        ...(learningReview.packagePaths?.agentPrompt ? [`Agent 写作提示: ${path.relative(projectRoot, learningReview.packagePaths.agentPrompt)}。`] : []),
      ]
      : [`复盘学习: 生成失败 (${learningReview?.errors?.[0] ?? 'unknown'})。`];
  const knowledgeSignal = {
    kind: 'loop-finish',
    ok: true,
    productionReady: quality?.report?.readiness?.productionReady ?? null,
    attentionGates: quality?.report?.readiness?.attentionGates ?? [],
    summary: `loop finish ${task.id}: ${task.title}`,
  };
  await recordKnowledgeReviewSignal(projectRoot, knowledgeSignal).catch(() => null);
  const knowledgeReviewSource = (await exists(cjoin(projectRoot, OPENPRD_HARNESS_TURN_STATE)))
    ? OPENPRD_HARNESS_TURN_STATE
    : (quality?.reportPath ?? null);
  const knowledgeReview = await reviewKnowledgeWorkspace(projectRoot, {
    from: knowledgeReviewSource,
    signal: knowledgeSignal,
  }).catch((error) => ({
    ok: false,
    action: 'quality-knowledge-review',
    skipped: false,
    errors: [error instanceof Error ? error.message : String(error)],
  }));
  await appendText(harnessPath(projectRoot, LOOP_PROGRESS), renderProgressEntry(timestamp(), [
    `已完成 ${task.id}: ${task.title}。`,
    `自测: ${finishResult.verification?.ok ? '通过' : '未运行'}。`,
    task.oracle ? `对照基准: ${task.oracle}。` : null,
    `测试报告: ${testReport.markdownPath}。`,
    `HTML 回归报告: ${testReport.htmlPath}。`,
    ...(quality ? [
      `最终 EVO: ${quality.report?.readiness?.productionReady ? 'production-ready' : 'needs-attention'}。`,
      ...(quality.htmlPath ? [`EVO 报告: ${path.relative(projectRoot, quality.htmlPath)}。`] : []),
    ] : []),
    ...learningProgress,
    knowledgeReview?.skipped
      ? null
      : `项目经验草案: ${path.relative(projectRoot, knowledgeReview.files?.draftSkill ?? knowledgeReview.files?.candidateDir ?? '') || '已生成'}。`,
    commit ? `Commit: ${commit.skipped ? '跳过' : commit.sha}` : 'Commit: 未请求。',
    projectRelease?.version ? `项目版本: ${projectRelease.version}。` : null,
    projectRelease?.tag?.tagName ? `版本 tag: ${projectRelease.tag.tagName}${projectRelease.tag.localSha ? ` -> ${projectRelease.tag.localSha}` : ''}。` : null,
    ...(projectRelease?.warnings ?? []).map((warning) => `版本轨道: ${warning}`),
  ]));
  await appendJsonl(harnessPath(projectRoot, LOOP_SESSIONS), {
    version: 1,
    at: timestamp(),
    action: 'finish',
    taskId: task.id,
    taskHandle: task.taskHandle,
    taskTitle: task.title,
    changeId: task.changeId,
    ok: true,
    oracle: task.oracle ?? null,
    commit: commit ? { ok: commit.ok, skipped: commit.skipped, sha: commit.sha ?? null } : null,
    projectRelease: projectRelease ?? null,
    testReport: testReport.markdownPath,
    regressionHtml: testReport.htmlPath,
    quality: quality
      ? {
        ok: quality.ok,
        productionReady: quality.report?.readiness?.productionReady ?? null,
        reportPath: quality.reportPath ?? null,
        htmlPath: quality.htmlPath ?? null,
        attentionGates: quality.report?.readiness?.attentionGates ?? [],
      }
      : null,
    knowledgeReview: knowledgeReview?.skipped
      ? {
          ok: true,
          skipped: true,
          reason: knowledgeReview.reason ?? 'skipped',
        }
      : knowledgeReview
        ? {
            ok: knowledgeReview.ok !== false,
            skipped: false,
            candidateId: knowledgeReview.candidateId ?? null,
            draftSkill: knowledgeReview.files?.draftSkill ?? null,
            candidateDir: knowledgeReview.files?.candidateDir ?? null,
          }
        : null,
    learningReview: learningReview?.ok
      ? {
        ok: true,
        skipped: Boolean(learningReview.skipped),
        packageId: learningReview.packageId ?? null,
        readerHtml: learningReview.packagePaths?.readerHtml ?? null,
      }
      : {
        ok: false,
        skipped: false,
        errors: learningReview?.errors ?? [],
      },
  });
  await updateLoopState(projectRoot, {
    currentTaskId: nextAfterFinish?.id ?? null,
    currentTaskHandle: nextAfterFinish?.taskHandle ?? null,
    currentTaskTitle: nextAfterFinish?.title ?? null,
    completedTaskIds: updatedList.tasks.filter((item) => item.status === 'done').map((item) => item.id),
  });
  return {
    ok: true,
    action: 'loop-finish',
    projectRoot,
    task,
    advanced,
    change,
    commit,
    projectRelease,
    testReport: testReport.markdownPath,
    regressionHtml: testReport.htmlPath,
    quality,
    knowledgeReview,
    learningReview,
    summary: buildLoopSummary(updatedList),
    next: nextAfterFinish,
  };
}

export async function runLoopWorkspace(projectRoot, options = {}) {
  const agent = normalizeAgent(options.agent ?? 'codex');
  const promptResult = await promptLoopWorkspace(projectRoot, { ...options, agent, mode: 'loop-run' });
  if (!promptResult.ok) return promptResult;

  const absolutePromptPath = harnessPath(projectRoot, promptResult.promptPath);
  const prompt = await readText(absolutePromptPath);
  const invocation = options.agentCommand
    ? {
      command: options.agentCommand,
      args: [],
      stdinFile: promptResult.promptPath,
      display: `${options.agentCommand} < ${shellJoin([promptResult.promptPath])}`,
      shell: true,
    }
    : defaultAgentInvocation(agent, projectRoot, promptResult.promptPath);
  const codexPreflight = agent === 'codex' && !options.agentCommand && !options.dryRun
    ? await ensureCodexCliReady({
      cwd: projectRoot,
      repair: Boolean(options.repairAgent),
      runCommand: options.codexRunCommand,
      packageManager: options.packageManager,
    })
    : null;

  if (codexPreflight && !codexPreflight.ok) {
    await appendJsonl(harnessPath(projectRoot, LOOP_SESSIONS), {
      version: 1,
      at: timestamp(),
      action: codexPreflight.repairAttempted ? 'agent-preflight-repair-failed' : 'agent-preflight-failed',
      agent,
      taskId: promptResult.task.id,
      taskHandle: promptResult.task.taskHandle,
      taskTitle: promptResult.task.title,
      ok: false,
      preflight: {
        ok: codexPreflight.preflight.ok,
        diagnosticType: codexPreflight.preflight.diagnostic?.type ?? null,
        missingPackage: codexPreflight.preflight.diagnostic?.missingPackage ?? null,
        repairAttempted: codexPreflight.repairAttempted,
      },
    });
    return {
      ok: false,
      action: 'loop-run',
      projectRoot,
      agent,
      task: promptResult.task,
      promptPath: promptResult.promptPath,
      invocation,
      codexRuntime: codexPreflight,
      preflight: codexPreflight.preflight,
      repair: codexPreflight.repair,
      repairAttempted: codexPreflight.repairAttempted,
      errors: codexPreflight.errors,
    };
  }

  const sessionEvent = {
    version: 1,
    at: timestamp(),
    action: options.dryRun ? 'run-dry-run' : 'run',
    agent,
    taskId: promptResult.task.id,
    taskHandle: promptResult.task.taskHandle,
    taskTitle: promptResult.task.title,
    changeId: promptResult.task.changeId,
    promptPath: promptResult.promptPath,
    invocation: invocation.display,
    preflight: codexPreflight ? {
      ok: codexPreflight.preflight.ok,
      command: codexPreflight.preflight.command.display,
      repairAttempted: codexPreflight.repairAttempted,
    } : null,
  };
  await appendJsonl(harnessPath(projectRoot, LOOP_SESSIONS), sessionEvent);
  await updateLoopState(projectRoot, {
    currentTaskId: promptResult.task.id,
    currentTaskHandle: promptResult.task.taskHandle,
    currentTaskTitle: promptResult.task.title,
    lastAgent: agent,
    lastSessionAt: sessionEvent.at,
  });

  if (options.dryRun) {
    return {
      ok: true,
      action: 'loop-run',
      dryRun: true,
      projectRoot,
      agent,
      task: promptResult.task,
      promptPath: promptResult.promptPath,
      invocation,
      codexRuntime: codexPreflight,
      preflight: codexPreflight?.preflight ?? null,
      prompt: promptResult.prompt,
    };
  }

  const runAgentCommand = options.agentRunCommand ?? runCommand;
  const run = invocation.shell
    ? await runAgentCommand(invocation.command, [], { cwd: projectRoot, shell: true, stdin: prompt })
    : await runAgentCommand(invocation.command, invocation.args, { cwd: projectRoot, stdin: prompt });
  await appendJsonl(harnessPath(projectRoot, LOOP_SESSIONS), {
    version: 1,
    at: timestamp(),
    action: 'agent-exit',
    agent,
    taskId: promptResult.task.id,
    taskHandle: promptResult.task.taskHandle,
    taskTitle: promptResult.task.title,
    ok: run.ok,
    status: run.status,
  });
  if (!run.ok) {
    return {
      ok: false,
      action: 'loop-run',
      projectRoot,
      agent,
      task: promptResult.task,
      run,
      errors: [run.stderr || run.stdout || 'Agent 命令执行失败。'],
    };
  }

  const finish = await finishLoopWorkspace(projectRoot, {
    item: promptResult.task.id,
    commit: options.commit,
    message: options.message ?? promptResult.task.commitMessage,
    notes: `Finished by openprd loop run --agent ${agent}.`,
  });
  return {
    ok: finish.ok,
    action: 'loop-run',
    projectRoot,
    agent,
    task: promptResult.task,
    run,
    codexRuntime: codexPreflight,
    preflight: codexPreflight?.preflight ?? null,
    repair: codexPreflight?.repair ?? null,
    repairAttempted: Boolean(codexPreflight?.repairAttempted),
    finish,
    errors: finish.errors ?? [],
  };
}
