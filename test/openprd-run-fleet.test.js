import test from 'node:test';
import { upsertSessionBinding } from '../src/session-binding.js';

import {
  assert,
  spawnSync,
  fs,
  os,
  path,
  sharp,
  buildReviewExportPayload,
  renderReviewArtifact,
  addBenchmarkWorkspace,
  advanceOpenSpecTaskWorkspace,
  applyGrowthCandidateWorkspace,
  applyOpenPrdChangeWorkspace,
  approveBenchmarkWorkspace,
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
  releaseWorkspace,
  reviewGrowthWorkspace,
  reviewPresentationWorkspace,
  reviewWorkspace,
  runLoopWorkspace,
  runWorkspace,
  setLearningReviewModeWorkspace,
  setupAgentIntegrationWorkspace,
  statusLoopWorkspace,
  synthesizeWorkspaceBase,
  updateAgentIntegrationWorkspace,
  validateOpenSpecChangeWorkspace,
  validateWorkspace,
  verifyBenchmarkWorkspace,
  verifyLoopWorkspace,
  verifyQualityWorkspace,
  visualCompareWorkspace,
  archiveKnowledgeCandidate,
  listKnowledgeCandidates,
  rejectKnowledgeCandidate,
  restoreKnowledgeCandidate,
  checkCodexCliHealth,
  ensureCodexCliReady,
  createRunWorkspace,
  OPENPRD_LITE_WRITE_TOOL_MATCHER,
  OPENPRD_GUARDED_WRITE_TOOL_MATCHER,
  TEST_OPENPRD_HOME,
  hasTomlFeatureKey,
  findOpenPrdHookGroup,
  makeTempProject,
  pathExists,
  readJsonl,
  writeAnswersFile,
  writeConcreteBasicDocs,
  writeSourceManual,
  writeFolderManual,
  writeFakeCodexBin,
  writeLoopProject,
  mergeReviewPresentation,
  validReviewPresentation,
  writeValidReviewPresentation,
  synthesizeWorkspace,
  writeMinimalChange,
} from 'openprd-test-helpers';
test('run exposes hook-stable context and records hook iterations', async () => {
  const project = await makeTempProject();
  await initWorkspace(project, { templatePack: 'consumer' });
  await synthesizeWorkspace(project, {
    title: 'Run Loop',
    owner: 'PM',
    problemStatement: 'Agents need a stable next execution unit',
    whyNow: 'Hook-driven runs should not depend on chat history',
    primaryUsers: ['Product agents'],
    goals: ['Make the next unit explicit'],
    successMetrics: ['Run context points to the next task'],
    acceptanceGoals: ['The hook can record iterations'],
    inScope: ['Run context'],
    outOfScope: ['External schedulers'],
    primaryFlows: ['Agent reads run context'],
    functional: Array.from({ length: 10 }, (_, index) => `Expose next task slice ${index + 1}`),
    productType: 'consumer',
  });
  await reviewWorkspace(project, { mark: 'confirmed' });
  await generateOpenSpecChangeWorkspace(project, { change: 'run-loop' });

  const context = await runWorkspace(project, { context: true });
  assert.equal(context.action, 'run-context');
  assert.equal(context.activeChange, 'run-loop');
  assert.equal(context.recommendation.type, 'loop-task');
  assert.equal(context.recommendation.loop.required, true);
  assert.equal(context.recommendation.executionMode, 'parallel-workers-isolated');
  assert.equal(context.recommendation.parallelPlan.eligible, true);
  assert.equal(context.recommendation.parallelPlan.worktreeRecommended, true);
  assert.ok(context.recommendation.parallelPlan.workerCandidates.length > 0);
  assert.equal(context.recommendation.intentGate.confirmationChecklistRequired, true);
  assert.equal(context.recommendation.executionConfirmationChecklist.required, true);
  assert.equal(context.recommendation.executionConfirmationChecklist.title, '执行确认清单');
  assert.ok(context.recommendation.executionConfirmationChecklist.implementationItems.some((item) => item.includes('openprd loop . --run --agent codex')));
  assert.ok(context.recommendation.executionConfirmationChecklist.implementationItems.some((item) => item.includes('并行策略:')));
  assert.ok(context.recommendation.executionConfirmationChecklist.outOfScope.some((item) => item.includes('不默认处理清单外')));
  assert.ok(context.recommendation.executionConfirmationChecklist.verification.some((item) => item.includes('openprd dev-check')));
  assert.ok(context.recommendation.command.includes('openprd tasks . --change'));
  assert.ok(context.recommendation.preparationCommand.includes('openprd loop . --plan --change'));
  assert.ok(context.recommendation.executionCommand.includes('openprd loop . --run --agent codex'));
  assert.equal(context.recommendation.executionCommand.includes('--commit'), false);
  assert.ok(context.recommendation.commitCommand.includes('openprd loop . --finish'));
  assert.equal(context.recommendation.intentGate.requiresExplicitIntent, true);
  const continuationContext = await runWorkspace(project, {
    context: true,
    message: '继续执行这个记录：019e5ac7-088b-7ff2-86d1-4c026ff68105',
  });
  assert.equal(continuationContext.lane.kind, 'continuation');
  assert.equal(continuationContext.lane.selectorType, 'session');
  assert.equal(continuationContext.lane.target.sessionId, '019e5ac7-088b-7ff2-86d1-4c026ff68105');
  assert.equal(continuationContext.lane.target.changeId, null);
  assert.equal(continuationContext.recommendation.type, 'session-continuation');
  assert.equal(continuationContext.recommendation.continuationTarget.sessionId, '019e5ac7-088b-7ff2-86d1-4c026ff68105');
  assert.ok(continuationContext.recommendation.reason.includes('工具无关的会话 ID'));
  assert.ok(continuationContext.recommendation.reason.includes('不能用相似历史、当前 active change'));
  assert.equal(continuationContext.recommendation.reason.includes('存在一个依赖已就绪的 OpenPrd 任务'), false);
  assert.ok(await fs.stat(path.join(project, '.openprd', 'harness', 'run-state.json')).then(() => true));
  assert.ok(await fs.stat(path.join(project, '.openprd', 'harness', 'iterations.jsonl')).then(() => true));

  const recorded = await runWorkspace(project, {
    recordHook: true,
    event: 'UserPromptSubmit',
    risk: 'low',
    outcome: 'context-injected',
    preview: 'start run',
  });
  assert.equal(recorded.ok, true);
  const iterations = await fs.readFile(path.join(project, '.openprd', 'harness', 'iterations.jsonl'), 'utf8');
  assert.ok(iterations.includes('UserPromptSubmit'));
  assert.ok(iterations.includes('context-injected'));

  const logs = [];
  const originalLog = console.log;
  console.log = (...args) => logs.push(args.join(' '));
  try {
    assert.equal(await main(['run', project, '--context']), 0);
  } finally {
    console.log = originalLog;
  }
  assert.ok(logs.some((line) => line.includes('OpenPrd 运行上下文')));
  assert.ok(logs.some((line) => line.includes('建议只读命令')));
  assert.ok(logs.some((line) => line.includes('执行门槛')));
  assert.ok(logs.some((line) => line.includes('执行模式:')));
  assert.ok(logs.some((line) => line.includes('并行计划:')));

  const continuationLogs = [];
  console.log = (...args) => continuationLogs.push(args.join(' '));
  try {
    assert.equal(await main(['run', project, '--context', '--message', '继续执行这个记录：019e5ac7-088b-7ff2-86d1-4c026ff68105']), 0);
  } finally {
    console.log = originalLog;
  }
  assert.ok(continuationLogs.some((line) => line.includes('执行流: 继续已有任务')));
  assert.ok(continuationLogs.some((line) => line.includes('下一步类型: session-continuation')));
  assert.ok(continuationLogs.some((line) => line.includes('会话 ID')));

  const tasksPath = path.join(project, 'openprd', 'changes', 'run-loop', 'tasks.md');
  const tasksText = await fs.readFile(tasksPath, 'utf8');
  await fs.writeFile(tasksPath, tasksText.replace(/- \[ \]/g, '- [x]'));
  await fs.writeFile(path.join(project, 'package.json'), `${JSON.stringify({
    type: 'module',
    scripts: {
      'test:smoke': 'node --test smoke.test.js',
    },
  }, null, 2)}\n`);
  await fs.mkdir(path.join(project, '.openprd', 'harness', 'test-reports'), { recursive: true });
  await fs.writeFile(path.join(project, '.openprd', 'harness', 'test-reports', 'run-loop-smoke.md'), [
    '# EVO run-loop report',
    '',
    '- smoke: passed run context main flow',
    '- feature coverage: tasks done',
    '',
  ].join('\n'));

  const verified = await runWorkspace(project, { verify: true });
  assert.equal(verified.ok, true);
  assert.ok(verified.checks.some((check) => check.name === 'change' && check.ok));
});

test('run context keeps lightweight task advance below the implementation task threshold', async () => {
  const project = await makeTempProject();
  await initWorkspace(project, { templatePack: 'consumer' });
  await synthesizeWorkspace(project, {
    title: 'Small Run',
    owner: 'PM',
    problemStatement: 'Small changes should stay lightweight',
    whyNow: 'Loop should be reserved for larger work',
    primaryUsers: ['Product agents'],
    goals: ['Keep small work simple'],
    successMetrics: ['Run context points to a lightweight task'],
    acceptanceGoals: ['The hook can recommend a single task'],
    inScope: ['Run context'],
    outOfScope: ['Large feature loops'],
    primaryFlows: ['Agent reads run context'],
    functional: ['Expose next task'],
    productType: 'consumer',
  });
  await reviewWorkspace(project, { mark: 'confirmed' });
  const generated = await generateOpenSpecChangeWorkspace(project, { change: 'small-run' });
  await fs.writeFile(path.join(generated.changeDir, 'tasks.md'), [
    '- [ ] T001.01 Prepare small state',
    '  - done: small state is ready',
    '  - verify: node -e "process.exit(0)"',
    '- [ ] T001.02 Wire small command',
    '  - done: small command is ready',
    '  - verify: node -e "process.exit(0)"',
    '',
  ].join('\n'));

  const context = await runWorkspace(project, { context: true });
  assert.equal(context.recommendation.type, 'task');
  assert.equal(context.recommendation.loop.required, false);
  assert.equal(context.recommendation.executionMode, 'serial');
  assert.equal(context.recommendation.parallelPlan.eligible, false);
  assert.equal(context.recommendation.executionConfirmationChecklist.required, true);
  assert.ok(context.recommendation.executionConfirmationChecklist.implementationItems.some((item) => item.includes('openprd tasks . --change')));
  assert.ok(context.recommendation.command.includes('openprd tasks . --change'));
});

test('run context recommends parallel workers before the isolated loop threshold', async () => {
  const project = await makeTempProject();
  await initWorkspace(project, { templatePack: 'consumer' });
  await synthesizeWorkspace(project, {
    title: 'Parallel Run',
    owner: 'PM',
    problemStatement: 'Medium changes benefit from bounded parallel workers',
    whyNow: 'The main agent should not carry every shard in one thread',
    primaryUsers: ['Product agents'],
    goals: ['Recommend worker mode before isolated worktrees are required'],
    successMetrics: ['Run context surfaces a worker recommendation'],
    acceptanceGoals: ['The hook can describe a worker shard plan'],
    inScope: ['Run context'],
    outOfScope: ['Automatic worker spawning'],
    primaryFlows: ['Agent reads run context'],
    functional: ['Expose parallel worker guidance'],
    productType: 'consumer',
  });
  await reviewWorkspace(project, { mark: 'confirmed' });
  const generated = await generateOpenSpecChangeWorkspace(project, { change: 'parallel-run' });
  await fs.writeFile(path.join(generated.changeDir, 'tasks.md'), [
    '- [ ] T001.01 Prepare shared contract',
    '  - type: implementation',
    '  - done: contract is ready',
    '  - verify: node -e "process.exit(0)"',
    '- [ ] T001.02 Wire domain slice',
    '  - type: implementation',
    '  - deps: T001.01',
    '  - done: domain slice is ready',
    '  - verify: node -e "process.exit(0)"',
    '- [ ] T001.03 Prepare verification slice',
    '  - type: implementation',
    '  - deps: T001.02',
    '  - done: verification slice is ready',
    '  - verify: node -e "process.exit(0)"',
    '',
  ].join('\n'));

  const context = await runWorkspace(project, { context: true });
  assert.equal(context.recommendation.type, 'task');
  assert.equal(context.recommendation.executionMode, 'parallel-workers');
  assert.equal(context.recommendation.parallelPlan.eligible, true);
  assert.equal(context.recommendation.parallelPlan.worktreeRecommended, false);
  assert.ok(context.recommendation.parallelPlan.workerCandidates.length > 0);
  assert.ok(context.recommendation.parallelPlan.groups.includes('implementation') || context.recommendation.parallelPlan.groups.includes('contracts'));
  assert.ok(context.recommendation.preparationCommand.includes('openprd loop . --plan --change'));
  assert.ok(context.recommendation.reason.includes('并行候选阈值'));
});

test('run context prioritizes active requirement intake over historical active change tasks', async () => {
  const project = await makeTempProject();
  await initWorkspace(project, { templatePack: 'consumer' });
  await synthesizeWorkspace(project, {
    title: 'Historical Change',
    owner: 'PM',
    problemStatement: 'The workspace has an older unfinished change',
    whyNow: 'The older change should not take over a new intake',
    primaryUsers: ['Product agents'],
    goals: ['Keep new intake separate'],
    successMetrics: ['Run context points to intake first'],
    acceptanceGoals: ['Historical change is only a reminder'],
    inScope: ['Run context recommendation'],
    outOfScope: ['Executing the older task'],
    primaryFlows: ['Agent reads run context'],
    functional: ['Expose next task'],
    productType: 'consumer',
  });
  await reviewWorkspace(project, { mark: 'confirmed' });
  await generateOpenSpecChangeWorkspace(project, { change: 'historical-change' });
  await fs.writeFile(path.join(project, '.openprd', 'harness', 'requirement-gate.json'), JSON.stringify({
    version: 1,
    active: true,
    status: 'requires-clarification',
    openedAt: '2026-05-25 10:00:00',
    updatedAt: '2026-05-25 10:00:00',
    promptPreview: '新增一个本轮独立需求入口，不要继续旧任务。',
    requiredFlow: ['clarify', 'capture', 'synthesize', 'review', 'change-generate', 'tasks', 'implementation'],
    intakeMode: 'focused-reflection',
  }, null, 2));

  const context = await runWorkspace(project, { context: true });
  assert.equal(context.activeChange, 'historical-change');
  assert.equal(context.activeRequirementGate.status, 'requires-clarification');
  assert.equal(context.recommendation.type, 'requirement-intake');
  assert.equal(context.recommendation.changeId, null);
  assert.ok(context.recommendation.command.includes('openprd clarify'));
  assert.ok(context.recommendation.reason.includes('历史 active change historical-change 仅作为提醒'));

  const continuationContext = await runWorkspace(project, {
    context: true,
    message: '继续执行这个记录：019e5ac7-088b-7ff2-86d1-4c026ff68105',
  });
  assert.equal(continuationContext.lane.selectorType, 'session');
  assert.equal(continuationContext.lane.target.changeId, null);
  assert.equal(continuationContext.recommendation.type, 'session-continuation');
  assert.ok(continuationContext.recommendation.reason.includes('不能用相似历史、当前 active change'));
  assert.ok(continuationContext.recommendation.reason.includes('只作为背景提醒'));
  assert.equal(continuationContext.recommendation.reason.includes('存在一个依赖已就绪的 OpenPrd 任务'), false);
});

test('run context can route by user-described requirement instead of the global active change', async () => {
  const project = await makeTempProject();
  await initWorkspace(project, { templatePack: 'consumer' });
  await writeMinimalChange(project, 'hermes-playwright-chromium-oss', {
    title: 'Hermes Playwright Chromium OSS',
    requirementTitle: 'Hermes Playwright Chromium OSS',
    taskTitle: 'Keep Hermes browser loop alive',
  });
  await writeMinimalChange(project, 'resource-layer-public-model-api', {
    title: 'Resource Layer Public Model API',
    requirementTitle: 'Public model API for the resource layer',
    taskTitle: 'Build public model API for the resource layer',
  });
  await fs.writeFile(path.join(project, '.openprd', 'state', 'changes.json'), JSON.stringify({
    version: 1,
    activeChange: 'hermes-playwright-chromium-oss',
    changes: {
      'hermes-playwright-chromium-oss': { id: 'hermes-playwright-chromium-oss', status: 'active' },
      'resource-layer-public-model-api': { id: 'resource-layer-public-model-api', status: 'draft' },
    },
  }, null, 2));

  const context = await runWorkspace(project, {
    context: true,
    message: 'resource-layer-public-model-api 公共模型 API 需求',
  });
  assert.equal(context.activeChange, 'hermes-playwright-chromium-oss');
  assert.equal(context.focus.changeId, 'resource-layer-public-model-api');
  assert.equal(context.lane.kind, 'targeted');
  assert.equal(context.lane.target.changeId, 'resource-layer-public-model-api');
  assert.equal(context.recommendation.changeId, 'resource-layer-public-model-api');
  assert.equal(context.nextTask.id, 'T001.01');
  assert.equal(context.nextTask.title, 'Build public model API for the resource layer');
  assert.ok(context.recommendation.reason.includes('当前用户消息已经命中变更 resource-layer-public-model-api'));
});

test('run context resolves a historical session from local session artifacts before considering active change', async () => {
  const project = await makeTempProject();
  await initWorkspace(project, { templatePack: 'consumer' });
  await writeMinimalChange(project, 'hermes-playwright-chromium-oss', {
    title: 'Hermes Playwright Chromium OSS',
    requirementTitle: 'Hermes Playwright Chromium OSS',
    taskTitle: 'Keep Hermes browser loop alive',
  });
  await writeMinimalChange(project, 'resource-layer-public-model-api', {
    title: 'Resource Layer Public Model API',
    requirementTitle: 'Public model API for the resource layer',
    taskTitle: 'Build public model API for the resource layer',
  });
  await fs.writeFile(path.join(project, '.openprd', 'state', 'changes.json'), JSON.stringify({
    version: 1,
    activeChange: 'hermes-playwright-chromium-oss',
    changes: {
      'hermes-playwright-chromium-oss': { id: 'hermes-playwright-chromium-oss', status: 'active' },
      'resource-layer-public-model-api': { id: 'resource-layer-public-model-api', status: 'draft' },
    },
  }, null, 2));
  const sessionId = '019e5d11-8c9d-7652-a5cb-24125046ea48';
  await fs.mkdir(path.join(project, '.openprd', 'harness', 'requirement-gates'), { recursive: true });
  await fs.writeFile(path.join(project, '.openprd', 'harness', 'requirement-gates', `${sessionId}.json`), JSON.stringify({
    version: 1,
    active: false,
    status: 'execution-authorized',
    sessionId,
    promptPreview: '继续 resource-layer-public-model-api 公共模型 API 需求',
  }, null, 2));

  const context = await runWorkspace(project, {
    context: true,
    message: `继续这个Codex任务：${sessionId}`,
  });
  assert.equal(context.activeChange, 'hermes-playwright-chromium-oss');
  assert.equal(context.lane.selectorType, 'session');
  assert.equal(context.lane.target.sessionId, sessionId);
  assert.equal(context.lane.target.changeId, 'resource-layer-public-model-api');
  assert.equal(context.recommendation.type, 'session-continuation');
  assert.equal(context.recommendation.changeId, 'resource-layer-public-model-api');
  assert.ok(context.recommendation.reason.includes('本地已恢复到 变更 resource-layer-public-model-api'));
  assert.ok(context.recommendation.reason.includes('当前工作区 active change hermes-playwright-chromium-oss 只作为背景提醒'));
});

test('run context prefers a persisted session binding over ambiguous requirement gate text', async () => {
  const project = await makeTempProject();
  await initWorkspace(project, { templatePack: 'consumer' });
  await writeMinimalChange(project, 'hermes-playwright-chromium-oss', {
    title: 'Hermes Playwright Chromium OSS',
    requirementTitle: 'Hermes Playwright Chromium OSS',
    taskTitle: 'Keep Hermes browser loop alive',
  });
  await writeMinimalChange(project, 'resource-layer-public-model-api', {
    title: 'Resource Layer Public Model API',
    requirementTitle: 'Public model API for the resource layer',
    taskTitle: 'Build public model API for the resource layer',
  });
  await fs.writeFile(path.join(project, '.openprd', 'state', 'changes.json'), JSON.stringify({
    version: 1,
    activeChange: 'hermes-playwright-chromium-oss',
    changes: {
      'hermes-playwright-chromium-oss': { id: 'hermes-playwright-chromium-oss', status: 'active' },
      'resource-layer-public-model-api': { id: 'resource-layer-public-model-api', status: 'draft' },
    },
  }, null, 2));
  const sessionId = '019e5f21-54be-7042-bb92-9ba6b2c24757';
  await fs.mkdir(path.join(project, '.openprd', 'harness', 'requirement-gates'), { recursive: true });
  await fs.mkdir(path.join(project, '.openprd', 'harness', 'session-bindings'), { recursive: true });
  await fs.writeFile(path.join(project, '.openprd', 'harness', 'requirement-gates', `${sessionId}.json`), JSON.stringify({
    version: 1,
    active: true,
    status: 'prd-review-required',
    sessionId,
    promptPreview: '继续这个记录，别被当前 active change 带偏。',
  }, null, 2));
  await fs.writeFile(path.join(project, '.openprd', 'harness', 'session-bindings', `${sessionId}.json`), JSON.stringify({
    version: 1,
    sessionId,
    promptPreview: '继续资源层公共模型 API 需求',
    title: 'Resource Layer Public Model API',
    changeId: 'resource-layer-public-model-api',
    workUnitId: 'wu-20260525220909-30c25b2d',
    versionId: 'v0165',
    digest: 'deadbeef',
    reviewStatus: 'confirmed',
  }, null, 2));

  const context = await runWorkspace(project, {
    context: true,
    message: `继续这个Codex任务：${sessionId}`,
  });
  assert.equal(context.activeChange, 'hermes-playwright-chromium-oss');
  assert.equal(context.lane.selectorType, 'session');
  assert.equal(context.lane.target.sessionId, sessionId);
  assert.equal(context.lane.target.changeId, 'resource-layer-public-model-api');
  assert.equal(context.recommendation.changeId, 'resource-layer-public-model-api');
  assert.ok(context.lane.resolution.reason.includes('lane 绑定指向变更 resource-layer-public-model-api'));
  assert.ok(context.recommendation.reason.includes('本地已恢复到 变更 resource-layer-public-model-api'));
  assert.ok(context.recommendation.reason.includes('当前工作区 active change hermes-playwright-chromium-oss 只作为背景提醒'));
});

test('run context resolves cross-workspace session continuation through the global session registry', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'openprd-session-registry-test-'));
  const projectA = path.join(root, 'workspace-a');
  const projectB = path.join(root, 'workspace-b');
  await fs.mkdir(projectA, { recursive: true });
  await fs.mkdir(projectB, { recursive: true });
  await initWorkspace(projectA, { templatePack: 'consumer' });
  await initWorkspace(projectB, { templatePack: 'consumer' });
  await writeMinimalChange(projectA, 'local-active-change', {
    title: 'Local Active Change',
    requirementTitle: 'Local Active Change',
    taskTitle: 'Keep local change active',
  });
  await writeMinimalChange(projectB, 'resource-layer-public-model-api', {
    title: 'Resource Layer Public Model API',
    requirementTitle: 'Public model API for the resource layer',
    taskTitle: 'Build public model API for the resource layer',
  });
  await fs.writeFile(path.join(projectA, '.openprd', 'state', 'changes.json'), JSON.stringify({
    version: 1,
    activeChange: 'local-active-change',
    changes: {
      'local-active-change': { id: 'local-active-change', status: 'active' },
    },
  }, null, 2));

  const sessionId = '019e8758-7f59-7f92-bf42-1667e3264af8';
  await upsertSessionBinding(projectB, sessionId, {
    promptPreview: '继续资源层公共模型 API 需求',
    title: 'Resource Layer Public Model API',
    changeId: 'resource-layer-public-model-api',
    versionId: 'v0007',
    digest: 'cafebabe',
    workUnitId: 'wu-20260602161152-66db6ad6',
    gateStatus: 'execution-authorized',
    gateActive: false,
  });

  const context = await runWorkspace(projectA, {
    context: true,
    message: `继续这个 Codex 任务：${sessionId}`,
  });
  assert.equal(context.activeChange, 'local-active-change');
  assert.equal(context.focus.changeId, null);
  assert.equal(context.focus.workspaceRoot, projectB);
  assert.equal(context.lane.kind, 'continuation');
  assert.equal(context.lane.target.sessionId, sessionId);
  assert.equal(context.lane.target.changeId, 'resource-layer-public-model-api');
  assert.equal(context.lane.target.workspaceRoot, projectB);
  assert.equal(context.recommendation.type, 'session-continuation');
  assert.equal(context.recommendation.changeId, 'resource-layer-public-model-api');
  assert.equal(context.recommendation.command, `openprd run '${projectB}' --context --message '${sessionId}'`);
  assert.equal(context.recommendation.isolation.required, true);
  assert.equal(context.recommendation.isolation.worktreeRecommended, true);
  assert.ok(context.recommendation.reason.includes('全局 session registry'));
  assert.ok(context.recommendation.reason.includes(`该会话归属到工作区 ${projectB}`));
  assert.ok(context.recommendation.reason.includes('不能继续复用当前工作区的 active 状态'));
});

test('run verify validates the focused change instead of the global active change', async () => {
  const project = await makeTempProject();
  await initWorkspace(project, { templatePack: 'consumer' });
  await writeMinimalChange(project, 'hermes-playwright-chromium-oss', {
    title: 'Hermes Playwright Chromium OSS',
    requirementTitle: 'Hermes Playwright Chromium OSS',
    taskTitle: 'Keep Hermes browser loop alive',
  });
  await writeMinimalChange(project, 'resource-layer-public-model-api', {
    title: 'Resource Layer Public Model API',
    requirementTitle: 'Public model API for the resource layer',
    taskTitle: 'Build public model API for the resource layer',
  });

  const validatedChanges = [];
  const taskStateFor = (changeId, title) => ({
    ok: true,
    action: 'list',
    projectRoot: project,
    changeId,
    changeDir: path.join(project, 'openprd', 'changes', changeId),
    tasks: [{
      id: 'T001.01',
      title,
      taskHandle: `${changeId}:T001.01:${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      relativePath: `openprd/changes/${changeId}/tasks.md`,
      lineNumber: 1,
      checked: false,
      metadata: {
        verify: 'node -e "process.exit(0)"',
      },
    }],
    summary: {
      total: 1,
      completed: 0,
      pending: 1,
      blocked: 0,
      implementation: {
        total: 1,
        completed: 0,
        pending: 1,
      },
    },
    nextTask: {
      id: 'T001.01',
      title,
      taskHandle: `${changeId}:T001.01:${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      relativePath: `openprd/changes/${changeId}/tasks.md`,
      lineNumber: 1,
      metadata: {
        verify: 'node -e "process.exit(0)"',
      },
    },
    blockedTasks: [],
  });

  const run = createRunWorkspace({
    checkStandardsWorkspace: async () => ({ ok: true, errors: [] }),
    listOpenPrdChangesWorkspace: async () => ({
      ok: true,
      activeChange: 'hermes-playwright-chromium-oss',
      changes: [
        {
          id: 'hermes-playwright-chromium-oss',
          active: true,
          changeDir: path.join(project, 'openprd', 'changes', 'hermes-playwright-chromium-oss'),
        },
        {
          id: 'resource-layer-public-model-api',
          active: false,
          changeDir: path.join(project, 'openprd', 'changes', 'resource-layer-public-model-api'),
        },
      ],
    }),
    listOpenSpecTaskWorkspace: async (_projectRoot, options = {}) => (
      options.change === 'resource-layer-public-model-api'
        ? taskStateFor('resource-layer-public-model-api', 'Build public model API for the resource layer')
        : taskStateFor('hermes-playwright-chromium-oss', 'Keep Hermes browser loop alive')
    ),
    nextWorkspace: async () => ({
      workflow: [],
      recommendation: {
        nextAction: 'noop',
        suggestedCommand: 'openprd next .',
        reason: 'stub',
      },
      analysisSnapshot: null,
      prdReviewState: null,
    }),
    resumeOpenSpecDiscoveryWorkspace: async () => null,
    validateOpenSpecChangeWorkspace: async (_projectRoot, options = {}) => {
      validatedChanges.push(options.change);
      return {
        ok: options.change === 'resource-layer-public-model-api',
        errors: options.change === 'resource-layer-public-model-api' ? [] : ['wrong change validated'],
      };
    },
    validateWorkspace: async () => ({
      report: {
        valid: true,
        errors: [],
        warnings: [],
      },
    }),
    verifyOpenSpecDiscoveryWorkspace: async () => ({
      ok: true,
      verification: {
        errors: [],
      },
    }),
    verifyQualityWorkspace: async () => ({
      ok: true,
      errors: [],
      report: {
        readiness: {
          productionReady: true,
          attentionGates: [],
        },
      },
    }),
  });

  const result = await run(project, {
    verify: true,
    message: 'resource-layer-public-model-api 公共模型 API 需求',
  });
  assert.equal(result.ok, true);
  assert.equal(result.context.focus.changeId, 'resource-layer-public-model-api');
  assert.deepEqual(validatedChanges, ['resource-layer-public-model-api']);
});

test('run context and verify ignore reference discovery by default', async () => {
  const project = await makeTempProject();
  await initWorkspace(project, { templatePack: 'consumer' });
  await synthesizeWorkspace(project, {
    title: 'Reference Discovery Boundary',
    owner: 'PM',
    problemStatement: 'Reference discovery should not pollute primary run verification',
    whyNow: 'Verify output needs to stay scoped to the current project',
    primaryUsers: ['Project maintainers'],
    goals: ['Keep primary verify scoped'],
    successMetrics: ['Run context keeps the implementation recommendation'],
    acceptanceGoals: ['Reference discovery stays outside default run verify'],
    inScope: ['Run context', 'Run verify'],
    outOfScope: ['Reference mining workflows'],
    primaryFlows: ['Maintainer reads run context'],
    functional: Array.from({ length: 10 }, (_, index) => `Expose implementation slice ${index + 1}`),
    productType: 'consumer',
  });
  await reviewWorkspace(project, { mark: 'confirmed' });
  await generateOpenSpecChangeWorkspace(project, { change: 'reference-boundary' });

  const tasksPath = path.join(project, 'openprd', 'changes', 'reference-boundary', 'tasks.md');
  const tasksText = await fs.readFile(tasksPath, 'utf8');
  await fs.writeFile(tasksPath, tasksText.replace(/- \[ \]/g, '- [x]'));
  await fs.writeFile(path.join(project, 'package.json'), `${JSON.stringify({
    type: 'module',
    scripts: {
      'test:smoke': 'node --test smoke.test.js',
    },
  }, null, 2)}\n`);
  await fs.mkdir(path.join(project, '.openprd', 'harness', 'test-reports'), { recursive: true });
  await fs.writeFile(path.join(project, '.openprd', 'harness', 'test-reports', 'reference-boundary-smoke.md'), [
    '# EVO reference boundary report',
    '',
    '- smoke: passed scoped verify flow',
    '- feature coverage: tasks done',
    '',
  ].join('\n'));

  const referenceProject = path.join(project, 'research', 'reference-repo');
  await fs.mkdir(path.join(referenceProject, '.git'), { recursive: true });
  await fs.writeFile(path.join(referenceProject, 'ref.js'), 'export const reference = true;\n');
  await openspecDiscoveryWorkspace(project, {
    mode: 'reference',
    reference: 'research/reference-repo',
  });

  const context = await runWorkspace(project, { context: true });
  assert.equal(context.activeChange, 'reference-boundary');
  assert.equal(context.discovery, null);
  assert.equal(context.recommendation.type, 'change-review');

  const verified = await runWorkspace(project, { verify: true });
  assert.equal(verified.context.discovery, null);
  assert.equal(verified.checks.some((check) => check.name === 'discovery'), false);
  assert.equal(verified.errors.some((error) => error.startsWith('discovery:')), false);
});

test('fleet dry-run plans historical updates without auto-claiming agent-only projects', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'openprd-fleet-test-'));
  const openprdHome = path.join(root, '.openprd-home');
  const existing = path.join(root, 'existing-openprd');
  const agentOnly = path.join(root, 'agent-only');
  const plain = path.join(root, 'plain-project');
  await fs.mkdir(existing, { recursive: true });
  await fs.mkdir(path.join(agentOnly, '.codex'), { recursive: true });
  await fs.mkdir(plain, { recursive: true });
  await fs.writeFile(path.join(agentOnly, 'AGENTS.md'), '# Local Agent Notes\n');
  await fs.writeFile(path.join(plain, 'package.json'), '{"name":"plain-project"}\n');

  await initWorkspace(existing, { templatePack: 'agent', openprdHome });
  const synthesized = await synthesizeWorkspace(existing, {
    title: '历史需求',
    owner: 'PM',
    problemStatement: '历史项目缺少稳定需求身份',
    whyNow: '多 Agent 并行后容易串需求',
    primaryUsers: ['维护者'],
    goals: ['历史确认命令可校验'],
    inScope: ['补历史 work unit'],
    outOfScope: ['接管 agent-only 项目'],
    functional: ['历史评审产物带工作单元 ID'],
  });
  const legacyVersionPath = path.join(existing, '.openprd', 'state', 'versions', 'v0001.json');
  const legacySnapshot = JSON.parse(await fs.readFile(legacyVersionPath, 'utf8'));
  delete legacySnapshot.workUnitId;
  delete legacySnapshot.targetRoot;
  await fs.writeFile(legacyVersionPath, `${JSON.stringify(legacySnapshot, null, 2)}\n`);
  await fs.rm(path.join(existing, '.openprd', 'engagements', 'work-units'), { recursive: true, force: true });
  const legacyStatePath = path.join(existing, '.openprd', 'state', 'current.json');
  const legacyState = JSON.parse(await fs.readFile(legacyStatePath, 'utf8'));
  delete legacyState.activeWorkUnitId;
  delete legacyState.targetRoot;
  delete legacyState.reviewStatus.workUnitId;
  delete legacyState.reviewStatus.stableArtifact;
  await fs.writeFile(legacyStatePath, `${JSON.stringify(legacyState, null, 2)}\n`);
  await fs.appendFile(path.join(existing, '.codex', 'skills', 'openprd-harness', 'SKILL.md'), '\nmanual drift\n');
  await fs.writeFile(path.join(existing, '.openprd', 'templates', 'base', 'prd.md'), '# PRD\n\n## 1. Problem\n');
  await fs.writeFile(path.join(existing, '.openprd', 'engagements', 'active', 'intake.md'), '# Intake\n\n## Questions\n\n- What problem are we solving?\n');

  const dryRun = await fleetWorkspace(root, {
    updateOpenprd: true,
    dryRun: true,
    maxDepth: 2,
    openprdHome,
  });
  assert.equal(dryRun.ok, true);
  assert.equal(dryRun.summary.openprd, 1);
  assert.equal(dryRun.summary.agentConfigured, 1);
  assert.equal(dryRun.projects.find((project) => project.relativePath === 'existing-openprd').plannedAction, 'update');
  assert.equal(dryRun.projects.find((project) => project.relativePath === 'agent-only').plannedAction, 'report');
  assert.equal(await fs.stat(path.join(agentOnly, '.openprd')).then(() => true).catch(() => false), false);

  const updated = await fleetWorkspace(root, {
    updateOpenprd: true,
    maxDepth: 2,
    openprdHome,
  });
  assert.equal(updated.summary.updated, 1);
  assert.equal(updated.summary.backfilled, 1);
  assert.equal(updated.summary.setup, 0);
  assert.equal(updated.projects.find((project) => project.relativePath === 'agent-only').status, 'skipped');
  assert.equal(await fs.stat(path.join(agentOnly, '.openprd')).then(() => true).catch(() => false), false);

  const doctor = await doctorWorkspace(existing);
  assert.equal(doctor.ok, true);
  assert.equal(doctor.agentIntegration.drift.ok, true);
  assert.ok((await fs.readFile(path.join(existing, '.openprd', 'templates', 'base', 'prd.md'), 'utf8')).includes('元信息'));
  assert.ok((await fs.readFile(path.join(existing, '.openprd', 'engagements', 'active', 'intake.md'), 'utf8')).includes('我们要解决什么问题？'));
  const backfilledSnapshot = JSON.parse(await fs.readFile(legacyVersionPath, 'utf8'));
  assert.match(backfilledSnapshot.workUnitId, /^wu-legacy-v0001-[a-f0-9]{8}$/);
  assert.equal(backfilledSnapshot.digest, synthesized.snapshot.digest);
  const backfilledHtml = await fs.readFile(path.join(existing, '.openprd', 'reviews', 'v0001.html'), 'utf8');
  assert.ok(backfilledHtml.includes(`--digest &#39;${synthesized.snapshot.digest}&#39;`));
  assert.ok(backfilledHtml.includes(`--work-unit &#39;${backfilledSnapshot.workUnitId}&#39;`));
  assert.equal(
    await fs.stat(path.join(existing, '.openprd', 'engagements', 'work-units', `${backfilledSnapshot.workUnitId}.json`)).then(() => true),
    true
  );

  const cliLogs = [];
  const originalLog = console.log;
  console.log = (...args) => cliLogs.push(args.join(' '));
  try {
    assert.equal(await main(['fleet', root, '--dry-run', '--update-openprd', '--max-depth', '2']), 0);
  } finally {
    console.log = originalLog;
  }
  assert.ok(cliLogs.some((line) => line.includes('OpenPrd fleet: 通过')));
});

test('fleet sync-registry backfills known workspaces and reports registry scope outside the current root', async () => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'openprd-fleet-registry-test-'));
  const openprdHome = path.join(workspaceRoot, '.openprd-home');
  const scopedRoot = path.join(workspaceRoot, 'scoped');
  const otherRoot = path.join(workspaceRoot, 'other');
  const scopedProject = path.join(scopedRoot, 'existing-openprd');
  const otherProject = path.join(otherRoot, 'another-openprd');
  await fs.mkdir(scopedProject, { recursive: true });
  await fs.mkdir(otherProject, { recursive: true });

  await initWorkspace(scopedProject, { templatePack: 'agent', openprdHome });
  await initWorkspace(otherProject, { templatePack: 'agent', openprdHome });
  await fs.rm(path.join(openprdHome, 'registry'), { recursive: true, force: true });

  const synced = await fleetWorkspace(scopedRoot, {
    syncRegistry: true,
    maxDepth: 2,
    openprdHome,
  });
  assert.equal(synced.ok, true);
  assert.equal(synced.summary.synced, 1);
  assert.equal(synced.registry.knownTotal, 1);
  assert.equal(synced.registry.outsideRoot, 0);

  await updateAgentIntegrationWorkspace(otherProject, { openprdHome });

  const scopedDryRun = await fleetWorkspace(scopedRoot, {
    dryRun: true,
    updateOpenprd: true,
    maxDepth: 2,
    openprdHome,
  });
  assert.equal(scopedDryRun.registry.knownTotal, 2);
  assert.equal(scopedDryRun.registry.scopedKnown, 1);
  assert.equal(scopedDryRun.registry.outsideRoot, 1);
});

test('doctor reports registry hygiene warnings for overbroad and nested workspaces', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'openprd-registry-hygiene-test-'));
  const openprdHome = path.join(root, '.openprd-home');
  const parent = path.join(root, 'parent');
  const child = path.join(parent, 'child');
  await fs.mkdir(child, { recursive: true });
  await initWorkspace(parent, { templatePack: 'consumer' });
  await initWorkspace(child, { templatePack: 'consumer' });

  const registryPath = path.join(openprdHome, 'registry', 'workspaces.jsonl');
  await fs.mkdir(path.dirname(registryPath), { recursive: true });
  await fs.writeFile(registryPath, [
    JSON.stringify({ version: 1, workspaceRoot: os.homedir(), realpath: os.homedir(), recordedAt: '2026-06-02 12:00:00' }),
    JSON.stringify({ version: 1, workspaceRoot: parent, realpath: parent, recordedAt: '2026-06-02 12:00:01' }),
    JSON.stringify({ version: 1, workspaceRoot: child, realpath: child, recordedAt: '2026-06-02 12:00:02' }),
    '',
  ].join('\n'));

  const doctor = await doctorWorkspace(parent, { openprdHome });
  assert.equal(doctor.registry.hygiene.ok, false);
  assert.ok(doctor.registry.hygiene.issues.some((issue) => issue.kind === 'overbroad-root'));
  assert.ok(doctor.registry.hygiene.issues.some((issue) => issue.kind === 'ambiguous-nesting'));
  assert.ok(doctor.warnings.some((warning) => warning.includes('过宽')));
  assert.ok(doctor.warnings.some((warning) => warning.includes('父子嵌套')));
});

test('fleet update reports workspace health gaps without blocking generated guidance updates', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'openprd-fleet-health-test-'));
  const openprdHome = path.join(root, '.openprd-home');
  const existing = path.join(root, 'existing-openprd');
  await fs.mkdir(existing, { recursive: true });

  await initWorkspace(existing, { templatePack: 'agent', openprdHome });
  await fs.appendFile(path.join(existing, '.codex', 'skills', 'openprd-harness', 'SKILL.md'), '\nmanual drift\n');
  await fs.writeFile(path.join(existing, 'docs', 'basic', 'backend-structure.md'), '# Backend\n', 'utf8');

  const updated = await fleetWorkspace(root, {
    updateOpenprd: true,
    maxDepth: 1,
    openprdHome,
  });
  const project = updated.projects.find((item) => item.relativePath === 'existing-openprd');
  assert.equal(updated.ok, true);
  assert.equal(updated.summary.updated, 1);
  assert.equal(updated.summary.failed, 0);
  assert.equal(updated.summary.healthAttention, 1);
  assert.equal(updated.errors.length, 0);
  assert.equal(project.status, 'updated');
  assert.equal(project.ok, true);
  assert.equal(project.healthOk, false);
  assert.ok(project.healthErrors.some((error) => error.includes('docs/basic/backend-structure.md')));
  assert.ok((await fs.readFile(path.join(existing, '.codex', 'skills', 'openprd-harness', 'SKILL.md'), 'utf8')).includes('OPENPRD:GENERATED'));

  const cliLogs = [];
  const originalLog = console.log;
  console.log = (...args) => cliLogs.push(args.join(' '));
  try {
    assert.equal(await main(['fleet', root, '--update-openprd', '--max-depth', '1']), 0);
  } finally {
    console.log = originalLog;
  }
  assert.ok(cliLogs.some((line) => line.includes('OpenPrd fleet: 通过')));
  assert.ok(cliLogs.some((line) => line.includes('失败 0')));
  assert.ok(cliLogs.some((line) => line.includes('项目健康: 1 个需关注')));
  assert.ok(cliLogs.some((line) => line.includes('需关注: standards: docs/basic/backend-structure.md')));
});

test('fleet update preserves standards external reference paths', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'openprd-fleet-standards-config-test-'));
  const openprdHome = path.join(root, '.openprd-home');
  const existing = path.join(root, 'existing-openprd');
  await fs.mkdir(existing, { recursive: true });

  await initWorkspace(existing, { templatePack: 'agent', openprdHome });
  await fs.mkdir(path.join(existing, 'research', 'reference-repo'), { recursive: true });
  await fs.mkdir(path.join(existing, 'resources', 'toolkit-sources'), { recursive: true });

  const standardsConfigPath = path.join(existing, '.openprd', 'standards', 'config.json');
  const standardsConfig = JSON.parse(await fs.readFile(standardsConfigPath, 'utf8'));
  standardsConfig.externalReferences = {
    ...(standardsConfig.externalReferences ?? {}),
    paths: ['research', 'resources/toolkit-sources'],
  };
  await fs.writeFile(standardsConfigPath, `${JSON.stringify(standardsConfig, null, 2)}\n`);

  const updated = await fleetWorkspace(root, {
    updateOpenprd: true,
    maxDepth: 1,
    openprdHome,
  });
  assert.equal(updated.summary.updated, 1);

  const nextConfig = JSON.parse(await fs.readFile(standardsConfigPath, 'utf8'));
  assert.deepEqual(nextConfig.externalReferences?.paths, ['research', 'resources/toolkit-sources']);
});

test('freeze writes a snapshot and handoff exports openprd bundle', async () => {
  const project = await makeTempProject();
  await initWorkspace(project, { templatePack: 'b2b' });
  await synthesizeWorkspace(project, {
    title: '企业客户交接',
    owner: 'PM',
    problemStatement: '销售团队在企业客户导入时容易丢失上下文',
    whyNow: '线索量正在增长',
    evidence: ['CRM 备注'],
    primaryUsers: ['销售运营'],
    stakeholders: ['销售团队', '客户成功团队'],
    goals: ['减少客户导入遗漏'],
    successMetrics: ['交接完成率超过 95%'],
    acceptanceGoals: ['团队可以检查每个导入字段'],
    inScope: ['企业客户导入检查清单'],
    outOfScope: ['账单迁移'],
    primaryFlows: ['销售运营检查客户导入信息'],
    edgeCases: ['必填字段缺失'],
    failureModes: ['CRM 导入失败'],
    functional: ['创建导入检查记录'],
    nonFunctional: ['p95 < 2s'],
    businessRules: ['只有客户负责人可以批准'],
    technical: ['复用当前 CRM 同步'],
    compliance: ['SOC2 审计日志'],
    dependencies: ['CRM API'],
    assumptions: ['CRM 客户已存在'],
    risks: ['负责人分配错误'],
    openQuestions: ['是否需要法务批准？'],
    handoffOwner: 'PM',
    nextStep: '冻结并交接',
    targetSystem: 'OpenPrd',
    productType: 'b2b',
    buyer: '销售负责人',
    user: '销售运营',
    admin: '系统管理员',
    operator: '客户成功运营',
    roles: '销售负责人、销售运营、客户成功运营、系统管理员',
    asIs: '销售运营手动检查 CRM 备注后转交客户成功',
    toBe: '系统生成检查清单并要求负责人确认后交接',
    permissionMatrix: '客户负责人可批准，运营可编辑，客户成功可查看',
    approvalFlow: '销售负责人确认后进入客户成功交接',
  });
  await diagramWorkspace(project, { open: false, type: 'architecture', mark: 'confirmed' });
  await reviewWorkspace(project, { mark: 'confirmed' });
  await releaseWorkspace(project, {
    setVersion: '0.1.23',
    notes: '新增企业客户交接版本说明',
  });

  const freezeResult = await freezeWorkspace(project);
  assert.equal(freezeResult.ok, true);
  assert.equal(freezeResult.snapshot.prdVersion, 1);
  assert.ok(freezeResult.snapshot.digest.length > 0);

  const handoffResult = await handoffWorkspace(project, 'openprd');
  assert.equal(handoffResult.ok, true);
  assert.equal(handoffResult.handoff.versionId, 'v0001');
  assert.ok(handoffResult.handoff.digest.length > 0);

  const handoffJsonPath = path.join(project, '.openprd', 'exports', 'openprd', 'handoff.json');
  const handoffJson = JSON.parse(await fs.readFile(handoffJsonPath, 'utf8'));
  const handoffMd = await fs.readFile(path.join(project, '.openprd', 'exports', 'openprd', 'handoff.md'), 'utf8');
  const activeHandoff = await fs.readFile(path.join(project, '.openprd', 'engagements', 'active', 'handoff.md'), 'utf8');
  assert.equal(handoffJson.target, 'openprd');
  assert.equal(handoffJson.templatePack, 'b2b');
  assert.equal(handoffJson.versionId, 'v0001');
  assert.equal(handoffJson.projectVersion, '0.1.23');
  assert.equal(Array.isArray(handoffJson.changeSummary.items), true);
  assert.ok(handoffJson.changeSummary.items.length > 0);
  assert.ok(handoffJson.releaseNotes.every((item) => item.includes('：')));
  assert.ok(handoffJson.releaseNotes.some((item) => item.includes('版本说明')));
  assert.ok(handoffMd.includes('项目版本: 0.1.23'));
  assert.ok(handoffMd.includes('## 变化摘要'));
  assert.ok(activeHandoff.includes('项目版本: 0.1.23'));
  assert.ok(activeHandoff.includes('## 变化摘要'));
});
