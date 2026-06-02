import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';

import { buildReviewExportPayload, renderReviewArtifact } from '../../src/html-artifacts.js';
import {
  addBenchmarkWorkspace,
  advanceOpenSpecTaskWorkspace,
  applyGrowthCandidateWorkspace,
  applyOpenPrdChangeWorkspace,
  approveBenchmarkWorkspace,
  archiveKnowledgeCandidate,
  archiveOpenPrdChangeWorkspace,
  captureWorkspace,
  checkDevelopmentStandardsWorkspace,
  checkStandardsWorkspace,
  clarifyWorkspace,
  classifyExternalReferenceWorkspace,
  classifyWorkspace,
  diagramWorkspace,
  diffWorkspace,
  doctorWorkspace,
  finishLoopWorkspace,
  fleetWorkspace,
  freezeWorkspace,
  generateLearningReviewWorkspace,
  generateOpenSpecChangeWorkspace,
  handoffWorkspace,
  historyWorkspace,
  initLoopWorkspace,
  initQualityWorkspace,
  initWorkspace,
  interviewWorkspace,
  learnQualityWorkspace,
  listAcceptedSpecsWorkspace,
  listBenchmarkWorkspace,
  listKnowledgeCandidates,
  listOpenPrdChangesWorkspace,
  listOpenSpecTaskWorkspace,
  main,
  nextLoopWorkspace,
  nextWorkspace,
  observeBenchmarkSourceWorkspace,
  openspecDiscoveryWorkspace,
  planLoopWorkspace,
  playgroundWorkspace,
  promptLoopWorkspace,
  rejectKnowledgeCandidate,
  releaseWorkspace,
  restoreKnowledgeCandidate,
  reviewGrowthWorkspace,
  reviewPresentationWorkspace,
  reviewWorkspace,
  runLoopWorkspace,
  runWorkspace,
  setLearningReviewModeWorkspace,
  setupAgentIntegrationWorkspace,
  statusLoopWorkspace,
  synthesizeWorkspace as synthesizeWorkspaceBase,
  updateAgentIntegrationWorkspace,
  validateOpenSpecChangeWorkspace,
  validateWorkspace,
  verifyBenchmarkWorkspace,
  verifyLoopWorkspace,
  verifyQualityWorkspace,
  visualCompareWorkspace,
} from '../../src/openprd.js';
import { checkCodexCliHealth, ensureCodexCliReady } from '../../src/codex-runtime.js';
import { createRunWorkspace } from '../../src/run-harness.js';

const OPENPRD_LITE_WRITE_TOOL_MATCHER = '^(apply_patch|Write|Edit)$';
const OPENPRD_GUARDED_WRITE_TOOL_MATCHER = '^(Bash|apply_patch|Write|Edit)$';
const TEST_OPENPRD_HOME = path.join(os.tmpdir(), 'openprd-test-home');

process.env.OPENPRD_HOME = TEST_OPENPRD_HOME;

function hasTomlFeatureKey(text, key) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === '[features]');
  if (start < 0) return false;
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (/^\[.+\]$/.test(line)) break;
    if (new RegExp(`^${key}\\s*=`).test(line)) return true;
  }
  return false;
}

function findOpenPrdHookGroup(groups) {
  return groups?.find((group) => group.hooks?.some((hook) => hook.command.includes('openprd-hook.mjs')));
}

async function makeTempProject() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'openprd-test-'));
  await fs.mkdir(path.join(dir, 'project'), { recursive: true });
  return path.join(dir, 'project');
}

async function pathExists(filePath) {
  return fs.stat(filePath).then(() => true, () => false);
}

async function readJsonl(filePath) {
  const text = await fs.readFile(filePath, 'utf8');
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function writeAnswersFile(project, filename, payload) {
  const filePath = path.join(project, filename);
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2));
  return filePath;
}

async function writeConcreteBasicDocs(project) {
  const docsRoot = path.join(project, 'docs', 'basic');
  await fs.mkdir(docsRoot, { recursive: true });
  const docs = {
    'file-structure.md': '# 文件结构\n\n## 核心文件\n\n- `src/index.js`: 示例入口。\n',
    'app-flow.md': '# 应用流程\n\n## 核心流程\n\n用户发起请求，系统处理并返回结果。\n',
    'prd.md': '# PRD\n\n## 目标\n\n交付可验证的最小需求闭环。\n',
    'frontend-guidelines.md': '# 前端准则\n\n## 界面规则\n\n界面保持清晰、可读、可验证。\n',
    'backend-structure.md': '# 后端结构\n\n## 模块\n\n服务层负责业务处理，存储层负责数据持久化。\n',
    'tech-stack.md': '# 技术栈\n\n## 运行时\n\nNode.js 与项目本地脚本。\n',
  };
  await Promise.all(Object.entries(docs).map(([filename, content]) => fs.writeFile(path.join(docsRoot, filename), content)));
}

async function writeSourceManual(filePath) {
  const manual = [
    '/*',
    '核心功能: 提供测试用源文件职责说明。',
    '输入: 测试调用方传入的数据。',
    '输出: 可断言的测试结果。',
    '定位: 用于 OpenPrd standards 测试。',
    '依赖: Node.js 标准库。',
    '维护规则: 修改职责时同步更新说明。',
    '*/',
    '',
  ].join('\n');
  const existing = await fs.readFile(filePath, 'utf8').catch(() => '');
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${manual}${existing}`);
}

async function writeFolderManual(folderPath) {
  await fs.mkdir(folderPath, { recursive: true });
  const folderName = path.basename(folderPath);
  const filePath = path.join(folderPath, `${folderName}_README.md`);
  await fs.writeFile(filePath, [
    `# ${folderName}`,
    '',
    '## 核心功能',
    '承载测试用目录职责说明。',
    '',
    '## 输入',
    '测试写入的源文件。',
    '',
    '## 输出',
    '可被 standards 检查读取的说明。',
    '',
    '## 定位',
    'OpenPrd standards 测试夹具。',
    '',
    '## 依赖',
    '无外部依赖。',
    '',
    '## 维护规则',
    '目录职责变化时同步更新。',
    '',
  ].join('\n'));
  return filePath;
}

async function writeFakeCodexBin(project) {
  const binDir = path.join(project, 'fake-bin');
  const binPath = path.join(binDir, 'codex');
  await fs.mkdir(binDir, { recursive: true });
  await fs.writeFile(binPath, [
    '#!/usr/bin/env node',
    "if (process.argv.includes('--version')) {",
    "  console.log('codex 0.0.0-test');",
    '} else {',
    "  console.log('fake codex');",
    '}',
    '',
  ].join('\n'));
  await fs.chmod(binPath, 0o755);
  return binDir;
}

function mergeReviewPresentation(base = {}, seed = {}) {
  return {
    ...base,
    ...seed,
    mapNodes: {
      ...(base.mapNodes ?? {}),
      ...(seed.mapNodes ?? {}),
    },
    panels: {
      ...(base.panels ?? {}),
      ...(seed.panels ?? {}),
    },
    flowNodes: seed.flowNodes ?? base.flowNodes,
  };
}

function validReviewPresentation(seed = {}) {
  const presentation = mergeReviewPresentation({
    mapNodes: {
      problem: { title: '问题定义', text: '确认核心问题' },
      goal: { title: '目标', text: '确认目标结果' },
      scope: { title: '范围', text: '确认交付边界' },
      flow: { title: '流程', text: '确认主线步骤' },
      risk: { title: '风险', text: '确认风险问题' },
    },
    flowNodes: [
      { text: '确认入口' },
      { text: '执行主步骤' },
      { text: '校验结果' },
      { text: '处理批量场景' },
    ],
    panels: {
      flow: [{ summary: '主线确认', detail: '用户能看懂入口、步骤和结果。' }],
      function: [{ summary: '功能确认', detail: '必须交付项和约束保持清晰。' }],
      guardrail: [{ summary: '护栏确认', detail: '成本、滥用和止损边界可见。' }],
      risk: [{ summary: '风险确认', detail: '开放问题和失败路径保留。' }],
    },
  }, seed);
  if (!presentation.diagram && Array.isArray(seed.flowNodes)) {
    presentation.diagram = { type: 'flow' };
  }
  return presentation;
}

async function writeValidReviewPresentation(project, versionId, seed = {}) {
  const presentationPath = path.join(project, `review-presentation-${versionId}.json`);
  const reviewPresentation = validReviewPresentation(seed);
  await fs.writeFile(presentationPath, JSON.stringify({
    reviewPresentation,
  }, null, 2));
  const result = await reviewPresentationWorkspace(project, {
    version: versionId,
    presentationPath,
    write: true,
  });
  assert.equal(result.ok, true, JSON.stringify(result.presentationFeedback, null, 2));
  return { ...result, reviewPresentation };
}

async function synthesizeWorkspace(project, options = {}) {
  const result = await synthesizeWorkspaceBase(project, options);
  const written = await writeValidReviewPresentation(project, result.snapshot.versionId, result.snapshot.reviewPresentation ?? {});
  return {
    ...result,
    reviewArtifact: written.reviewEntryPath,
    reviewEntryPath: written.reviewEntryPath,
    reviewPath: written.reviewPath,
    stableReviewArtifact: written.reviewPath,
    reviewPresentationRequired: false,
    snapshot: {
      ...result.snapshot,
      reviewPresentation: written.reviewPresentation,
    },
  };
}

async function writeMinimalChange(project, changeId, {
  title,
  requirementTitle = title,
  taskId = 'T001.01',
  taskTitle = title,
  verifyCommand = 'node -e "process.exit(0)"',
} = {}) {
  const changeDir = path.join(project, 'openprd', 'changes', changeId);
  const capability = changeId.split('-').slice(0, 2).join('-') || changeId;
  await fs.mkdir(path.join(changeDir, 'specs', capability), { recursive: true });
  await fs.writeFile(path.join(changeDir, 'proposal.md'), [
    `# ${title}`,
    '',
    '## Why',
    `${title} needs an isolated routing target.`,
    '',
    '## What Changes',
    `- ${title}`,
    '',
  ].join('\n'));
  await fs.writeFile(path.join(changeDir, 'specs', capability, 'spec.md'), [
    `# ${capability} spec`,
    '',
    '## ADDED Requirements',
    '',
    `### Requirement: ${requirementTitle}`,
    `${title} must remain addressable by routing.`,
    '',
  ].join('\n'));
  await fs.writeFile(path.join(changeDir, 'tasks.md'), [
    `- [ ] ${taskId} ${taskTitle}`,
    `  - done: ${taskTitle} is complete`,
    `  - verify: ${verifyCommand}`,
    '',
  ].join('\n'));
  return changeDir;
}

async function writeLoopProject(project, changeId = 'loop-demo') {
  await initWorkspace(project, { templatePack: 'agent' });
  await fs.writeFile(path.join(project, 'package.json'), `${JSON.stringify({
    type: 'module',
    scripts: {
      'test:smoke': 'node --test smoke.test.js',
    },
  }, null, 2)}\n`);
  await fs.mkdir(path.join(project, '.openprd', 'harness', 'test-reports'), { recursive: true });
  await fs.writeFile(path.join(project, '.openprd', 'harness', 'test-reports', 'loop-smoke.md'), [
    '# loop smoke evidence',
    '',
    '- smoke: passed loop task chain.',
    '- feature coverage: loop tasks have verification commands.',
    '',
  ].join('\n'));
  const changeDir = path.join(project, 'openprd', 'changes', changeId);
  await fs.mkdir(path.join(changeDir, 'specs', changeId), { recursive: true });
  await fs.writeFile(path.join(changeDir, 'proposal.md'), [
    `# ${changeId}`,
    '',
    '## Why',
    'Loop execution needs a small accepted task chain.',
    '',
    '## What Changes',
    '- Prepare loop state.',
    '- Launch one-task session.',
    '',
  ].join('\n'));
  await fs.writeFile(path.join(changeDir, 'specs', changeId, 'spec.md'), [
    `# ${changeId} spec`,
    '',
    '## ADDED Requirements',
    '',
    '### Requirement: Loop task chain is executable',
    'The loop task chain must expose stable task handles and dependency order.',
    '',
    '#### 场景：Agent 推进首个 Loop 任务',
    '- **当** Agent 验证第一个任务',
    '- **则** Loop 可以标记完成并暴露第二个任务',
    '',
  ].join('\n'));
  await fs.writeFile(path.join(changeDir, 'tasks.md'), [
    '- [ ] T001.01 Prepare loop state',
    '  - type: implementation',
    '  - done: loop state is ready for one-task execution',
    '  - verify: node -e "process.exit(0)"',
    '  - execution-mode: parallel-workers',
    '  - parallel-group: implementation',
    '  - write-scope: src/**, test/**',
    '  - owner-role: worker',
    '  - local-verify: node -e "process.exit(0)"',
    '  - integration-owner: main-agent',
    '',
    '- [ ] T001.02 Launch one-task session',
    '  - deps: T001.01',
    '  - type: implementation',
    '  - done: one-task session launch is ready',
    '  - verify: node -e "process.exit(0)"',
    '  - execution-mode: parallel-workers',
    '  - parallel-group: integration',
    '  - write-scope: src/**, test/**',
    '  - owner-role: worker',
    '  - local-verify: node -e "process.exit(0)"',
    '  - integration-owner: main-agent',
    '',
  ].join('\n'));
  return changeDir;
}

export {
  OPENPRD_GUARDED_WRITE_TOOL_MATCHER,
  OPENPRD_LITE_WRITE_TOOL_MATCHER,
  TEST_OPENPRD_HOME,
  addBenchmarkWorkspace,
  advanceOpenSpecTaskWorkspace,
  applyGrowthCandidateWorkspace,
  applyOpenPrdChangeWorkspace,
  approveBenchmarkWorkspace,
  archiveKnowledgeCandidate,
  archiveOpenPrdChangeWorkspace,
  assert,
  buildReviewExportPayload,
  captureWorkspace,
  checkCodexCliHealth,
  checkDevelopmentStandardsWorkspace,
  checkStandardsWorkspace,
  clarifyWorkspace,
  classifyExternalReferenceWorkspace,
  classifyWorkspace,
  createRunWorkspace,
  diagramWorkspace,
  diffWorkspace,
  doctorWorkspace,
  ensureCodexCliReady,
  findOpenPrdHookGroup,
  finishLoopWorkspace,
  fleetWorkspace,
  freezeWorkspace,
  fs,
  generateLearningReviewWorkspace,
  generateOpenSpecChangeWorkspace,
  handoffWorkspace,
  hasTomlFeatureKey,
  historyWorkspace,
  initLoopWorkspace,
  initQualityWorkspace,
  initWorkspace,
  interviewWorkspace,
  learnQualityWorkspace,
  listAcceptedSpecsWorkspace,
  listBenchmarkWorkspace,
  listKnowledgeCandidates,
  listOpenPrdChangesWorkspace,
  listOpenSpecTaskWorkspace,
  main,
  makeTempProject,
  mergeReviewPresentation,
  nextLoopWorkspace,
  nextWorkspace,
  observeBenchmarkSourceWorkspace,
  openspecDiscoveryWorkspace,
  os,
  path,
  pathExists,
  planLoopWorkspace,
  playgroundWorkspace,
  promptLoopWorkspace,
  readJsonl,
  rejectKnowledgeCandidate,
  releaseWorkspace,
  renderReviewArtifact,
  restoreKnowledgeCandidate,
  reviewGrowthWorkspace,
  reviewPresentationWorkspace,
  reviewWorkspace,
  runLoopWorkspace,
  runWorkspace,
  setLearningReviewModeWorkspace,
  setupAgentIntegrationWorkspace,
  sharp,
  spawnSync,
  statusLoopWorkspace,
  synthesizeWorkspace,
  synthesizeWorkspaceBase,
  updateAgentIntegrationWorkspace,
  validReviewPresentation,
  validateOpenSpecChangeWorkspace,
  validateWorkspace,
  verifyBenchmarkWorkspace,
  verifyLoopWorkspace,
  verifyQualityWorkspace,
  visualCompareWorkspace,
  writeAnswersFile,
  writeConcreteBasicDocs,
  writeFakeCodexBin,
  writeFolderManual,
  writeLoopProject,
  writeMinimalChange,
  writeSourceManual,
  writeValidReviewPresentation,
};
