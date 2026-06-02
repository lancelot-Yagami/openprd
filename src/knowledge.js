import fs from 'node:fs/promises';
import path from 'node:path';
import { cjoin, exists, readJson, writeJson, writeText } from './fs-utils.js';
import { resolveQualityLearningSource } from './quality-learning.js';
import { timestamp } from './time.js';

const KNOWLEDGE_DIR = cjoin('.openprd', 'knowledge');
const KNOWLEDGE_INDEX = cjoin(KNOWLEDGE_DIR, 'index.json');
const KNOWLEDGE_CANDIDATES_DIR = cjoin(KNOWLEDGE_DIR, 'candidates');
const KNOWLEDGE_DRAFTS_DIR = cjoin(KNOWLEDGE_DIR, 'drafts');
const OPENPRD_HARNESS_TURN_STATE = cjoin('.openprd', 'harness', 'turn-state.json');
const PENDING_KNOWLEDGE_CANDIDATE_STATUSES = new Set(['pending-review', 'pending']);
const REVIEWED_KNOWLEDGE_CANDIDATE_STATUSES = new Set([
  'promoted',
  'merged',
  'rejected',
  'archived',
  'reviewed-noise',
  'reviewed-duplicate',
  'reviewed-weak-signal',
]);

const CODE_EXTENSIONS = new Set([
  '.c',
  '.cc',
  '.cjs',
  '.cpp',
  '.cs',
  '.css',
  '.go',
  '.h',
  '.hpp',
  '.html',
  '.java',
  '.js',
  '.json',
  '.jsx',
  '.kt',
  '.md',
  '.mjs',
  '.py',
  '.rb',
  '.rs',
  '.scss',
  '.sh',
  '.swift',
  '.toml',
  '.ts',
  '.tsx',
  '.vue',
  '.yaml',
  '.yml',
]);

function knowledgePath(projectRoot, relativePath) {
  return cjoin(projectRoot, relativePath);
}

function defaultKnowledgeIndex() {
  return {
    version: 1,
    updatedAt: timestamp(),
    incidents: [],
    patterns: [],
    skills: [],
    candidates: [],
    drafts: [],
  };
}

function normalizeStringList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? '').trim())
    .filter(Boolean);
}

function uniq(items) {
  return [...new Set(items.filter(Boolean))];
}

function slugify(value, fallback = 'knowledge') {
  const slug = String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return slug || fallback;
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function toRelativeProjectPath(projectRoot, filePath) {
  if (!filePath) return null;
  const absolutePath = path.isAbsolute(filePath)
    ? path.resolve(filePath)
    : knowledgePath(projectRoot, filePath);
  const relativePath = path.relative(projectRoot, absolutePath).split(path.sep).join('/');
  return relativePath && !relativePath.startsWith('..') ? relativePath : String(filePath).split(path.sep).join('/');
}

function readJsonObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

async function ensureKnowledgeWorkspace(projectRoot) {
  await fs.mkdir(knowledgePath(projectRoot, cjoin(KNOWLEDGE_DIR, 'incidents')), { recursive: true });
  await fs.mkdir(knowledgePath(projectRoot, cjoin(KNOWLEDGE_DIR, 'patterns')), { recursive: true });
  await fs.mkdir(knowledgePath(projectRoot, cjoin(KNOWLEDGE_DIR, 'skills')), { recursive: true });
  await fs.mkdir(knowledgePath(projectRoot, KNOWLEDGE_CANDIDATES_DIR), { recursive: true });
  await fs.mkdir(knowledgePath(projectRoot, KNOWLEDGE_DRAFTS_DIR), { recursive: true });
  const indexPath = knowledgePath(projectRoot, KNOWLEDGE_INDEX);
  if (!(await exists(indexPath))) {
    await writeJson(indexPath, defaultKnowledgeIndex());
  }
}

async function readKnowledgeIndex(projectRoot) {
  await ensureKnowledgeWorkspace(projectRoot);
  const current = await readJson(knowledgePath(projectRoot, KNOWLEDGE_INDEX)).catch(() => defaultKnowledgeIndex());
  return {
    ...defaultKnowledgeIndex(),
    ...current,
    incidents: Array.isArray(current?.incidents) ? current.incidents : [],
    patterns: Array.isArray(current?.patterns) ? current.patterns : [],
    skills: Array.isArray(current?.skills) ? current.skills : [],
    candidates: Array.isArray(current?.candidates) ? current.candidates : [],
    drafts: Array.isArray(current?.drafts) ? current.drafts : [],
  };
}

async function writeKnowledgeIndex(projectRoot, index) {
  await writeJson(knowledgePath(projectRoot, KNOWLEDGE_INDEX), {
    ...defaultKnowledgeIndex(),
    ...index,
    updatedAt: timestamp(),
  });
}

function upsertBy(items, key, value, max = 200) {
  return [value, ...items.filter((item) => item?.[key] !== value[key])].slice(0, max);
}

function normalizeCandidateStatus(status) {
  const normalized = String(status ?? '').trim();
  if (!normalized || normalized === 'pending') return 'pending-review';
  return normalized;
}

function isPendingKnowledgeCandidateStatus(status) {
  return PENDING_KNOWLEDGE_CANDIDATE_STATUSES.has(String(status ?? '').trim() || 'pending-review');
}

function isReviewedKnowledgeCandidateStatus(status) {
  const normalized = normalizeCandidateStatus(status);
  return REVIEWED_KNOWLEDGE_CANDIDATE_STATUSES.has(normalized)
    || !isPendingKnowledgeCandidateStatus(normalized);
}

function candidateStatusGroup(status) {
  const normalized = normalizeCandidateStatus(status);
  if (isPendingKnowledgeCandidateStatus(normalized)) return 'pending';
  if (['promoted', 'merged'].includes(normalized)) return 'promoted';
  if (normalized === 'rejected') return 'rejected';
  if (normalized === 'archived') return 'archived';
  return 'reviewed';
}

function resolveCandidateStatus(candidateStatus, indexStatus) {
  const hasCandidateStatus = candidateStatus !== undefined && candidateStatus !== null && String(candidateStatus).trim();
  const hasIndexStatus = indexStatus !== undefined && indexStatus !== null && String(indexStatus).trim();
  const normalizedCandidate = normalizeCandidateStatus(candidateStatus);
  const normalizedIndex = normalizeCandidateStatus(indexStatus);
  if (
    hasCandidateStatus
    && isPendingKnowledgeCandidateStatus(normalizedCandidate)
    && hasIndexStatus
    && isReviewedKnowledgeCandidateStatus(normalizedIndex)
  ) {
    return normalizedIndex;
  }
  return hasCandidateStatus ? normalizedCandidate : normalizedIndex;
}

function signalSummary(signal) {
  if (!signal) return null;
  const parts = [];
  if (signal.summary) parts.push(signal.summary);
  if (Array.isArray(signal.attentionGates) && signal.attentionGates.length > 0) {
    parts.push(`attention gates: ${signal.attentionGates.join(', ')}`);
  }
  if (Array.isArray(signal.touchedFiles) && signal.touchedFiles.length > 0) {
    parts.push(`touched: ${signal.touchedFiles.slice(0, 6).join(', ')}`);
  }
  return parts.join(' | ') || null;
}

function normalizeReviewSignal(projectRoot, signal = {}) {
  const touchedFiles = uniq(normalizeStringList(signal.touchedFiles).map((file) => toRelativeProjectPath(projectRoot, file)));
  return {
    id: firstString(signal.id, signal.kind, signal.source, signal.title, timestamp()) ?? timestamp(),
    kind: firstString(signal.kind, signal.source, 'signal') ?? 'signal',
    at: signal.at ?? timestamp(),
    ok: typeof signal.ok === 'boolean' ? signal.ok : null,
    productionReady: typeof signal.productionReady === 'boolean' ? signal.productionReady : null,
    attentionGates: normalizeStringList(signal.attentionGates),
    summary: firstString(signal.summary, signal.message, signal.reason),
    touchedFiles,
  };
}

function normalizeTouchedFiles(projectRoot, value) {
  return uniq(normalizeStringList(value).map((file) => toRelativeProjectPath(projectRoot, file))).filter(Boolean);
}

function hasOverlap(left = [], right = []) {
  const rightSet = new Set(right);
  return left.some((item) => rightSet.has(item));
}

function buildReviewContext(projectRoot, raw = {}, options = {}) {
  const rawTouchedFiles = normalizeTouchedFiles(projectRoot, raw.touchedFiles);
  const optionTouchedFiles = normalizeTouchedFiles(projectRoot, options.touchedFiles);
  const optionSignal = options.signal ? normalizeReviewSignal(projectRoot, options.signal) : null;
  const embeddedSignals = Array.isArray(raw.reviewSignals)
    ? raw.reviewSignals.map((signal) => normalizeReviewSignal(projectRoot, signal))
    : [];
  const latestSignalTouchedFiles = embeddedSignals.find((signal) => signal.touchedFiles.length > 0)?.touchedFiles ?? [];
  const touchedFiles = optionTouchedFiles.length > 0
    ? optionTouchedFiles
    : (optionSignal?.touchedFiles?.length ? optionSignal.touchedFiles : (latestSignalTouchedFiles.length > 0 ? latestSignalTouchedFiles : rawTouchedFiles));
  const signalEntries = [];
  if (optionSignal) {
    signalEntries.push(optionSignal);
  }
  for (const signal of embeddedSignals) {
    const isSameSignal = optionSignal && signal.id === optionSignal.id && signal.kind === optionSignal.kind;
    if (isSameSignal) continue;
    if (!optionSignal) {
      signalEntries.push(signal);
      continue;
    }
    if (signal.touchedFiles.length > 0 && hasOverlap(signal.touchedFiles, touchedFiles)) {
      signalEntries.push(signal);
    }
  }
  const reviewSignals = uniq(signalEntries.map((signal) => JSON.stringify(signal))).map((entry) => JSON.parse(entry));
  return {
    touchedFiles,
    reviewSignals,
  };
}

function isSubstantiveTouchedFile(filePath) {
  const normalized = String(filePath ?? '').split(path.sep).join('/');
  if (!normalized) return false;
  if (/^docs\/basic\//.test(normalized)) return true;
  if (/^skills\/.+\/SKILL\.md$/.test(normalized)) return true;
  if (/^AGENTS\.md$/.test(normalized)) return true;
  const extension = path.extname(normalized).toLowerCase();
  if (!CODE_EXTENSIONS.has(extension)) return false;
  if (/README/i.test(path.basename(normalized)) && !/^docs\/basic\//.test(normalized)) {
    return false;
  }
  return true;
}

function buildKnowledgeCategories({ source, touchedFiles, reviewSignals }) {
  const categories = [];
  const signalKinds = reviewSignals.map((signal) => signal.kind);
  const touchesAgentInfra = touchedFiles.some((file) => /(agent|harness|hook|workflow|skill|prompt|quality|run-harness|loop|growth|standards)/i.test(file));
  const hasRuntimePattern = source.rootCauseCandidates.length > 0 || source.eventNames.length > 0 || source.symptoms.length > 1;
  const hasVerifiedOutcome = reviewSignals.some((signal) => (
    signal.ok === true || signal.productionReady === true
  ) && ['quality-verify', 'run-verify', 'loop-finish'].includes(signal.kind));
  const hasAttentionOutcome = reviewSignals.some((signal) => signal.ok === false || signal.productionReady === false || signal.attentionGates.length > 0);

  if (hasRuntimePattern || hasAttentionOutcome) {
    categories.push('hidden-debug-knowledge');
  }
  if (touchesAgentInfra) {
    categories.push('agent-misjudgment');
  }
  if (hasVerifiedOutcome || signalKinds.includes('loop-finish') || signalKinds.includes('run-verify')) {
    categories.push('high-impact-fix');
  }
  return uniq(categories);
}

function categoryReason(category) {
  if (category === 'hidden-debug-knowledge') {
    return '本轮结果里已经出现可复用的症状、排查线索或根因模式，不应该只留在当前对话里。';
  }
  if (category === 'agent-misjudgment') {
    return '这次改动直接影响 Agent / harness / hook / skill 行为，后续很容易再次踩到同类判断问题。';
  }
  if (category === 'high-impact-fix') {
    return '这次修复已经带有验证或收尾证据，适合尽快抽象成项目级研发经验。';
  }
  return '这次实现已经具备沉淀项目经验的价值。';
}

function deriveKnowledgeNames(source) {
  const sourceRef = source?.sourceId ?? source?.title ?? source?.status ?? 'diagnostic';
  const sourceKind = source?.kind === 'quality-report' ? 'quality' : 'diagnostic';
  const incidentId = source?.kind === 'quality-report'
    ? `incident-${sourceRef}`
    : `incident-${slugify(sourceRef, 'diagnostic')}`;
  const patternId = `${sourceKind}-${slugify(sourceRef, sourceKind)}`;
  const skillName = `openprd-experience-${slugify(patternId)}`;
  return { incidentId, patternId, skillName };
}

function buildTurnReviewTitle(raw, source) {
  return firstString(
    raw?.title,
    raw?.summary?.title,
    raw?.promptPreview,
    raw?.prompt,
    source.title,
    source.sourceId,
    '项目经验草案',
  ) ?? '项目经验草案';
}

async function loadRawReviewInput(projectRoot, from) {
  if (!from) return { sourcePath: null, raw: null };
  const resolved = path.isAbsolute(from) ? path.resolve(from) : knowledgePath(projectRoot, from);
  const stat = await fs.stat(resolved).catch(() => null);
  if (!stat) {
    return { sourcePath: resolved, raw: null };
  }
  if (stat.isDirectory()) {
    const diagnosticPath = path.join(resolved, 'diagnostic-report.json');
    const diagnostic = await readJson(diagnosticPath).catch(() => null);
    return { sourcePath: resolved, raw: readJsonObject(diagnostic) };
  }
  const parsed = await readJson(resolved).catch(() => null);
  return { sourcePath: resolved, raw: readJsonObject(parsed) };
}

function renderList(items, fallback) {
  const list = items.filter(Boolean);
  if (list.length === 0) {
    return `- ${fallback}`;
  }
  return list.map((item) => `- ${item}`).join('\n');
}

function renderKnowledgeDraftSkill({ skillName, candidate, source, relativeCandidateDir }) {
  const triggerItems = uniq([
    ...candidate.reasons,
    ...source.symptoms.map((item) => `症状: ${item}`),
    ...candidate.reviewSignals.map((signal) => {
      const summary = signalSummary(signal);
      return summary ? `${signal.kind}: ${summary}` : signal.kind;
    }),
  ]);
  const inspectItems = uniq([
    ...candidate.touchedFiles.map((file) => `\`${file}\``),
    ...source.evidenceSources.map((item) => `\`${item.path}\``),
  ]);
  const verificationItems = uniq([
    ...candidate.reviewSignals.map((signal) => signal.summary).filter(Boolean),
    ...source.verificationSteps,
  ]);
  return `---
name: ${skillName}
description: OpenPrd 在本轮回顾时自动生成的待确认项目经验草案。
---

# ${skillName}

> 状态：draft
> 候选目录：\`${relativeCandidateDir}\`
> Promote：\`openprd quality . --learn --from ${relativeCandidateDir}\`

## 为什么值得沉淀

${renderList(triggerItems, '本轮实现已经出现值得复用的排查或修复模式。')}

## 下次触发时先看什么

${renderList(inspectItems, '先看本轮 touched files 和已有诊断证据。')}

## 可复用模式

${renderList(source.rootCauseCandidates.map((candidateItem) => candidateItem.title), '先按本轮诊断线索复走一次，再补最小必要证据。')}

## 验证方式

${renderList(verificationItems, '修复后重新走一遍本轮验证链路，确认问题不再复现。')}
`;
}

function buildCandidateDiagnosticReport({ candidateId, title, summary, source, touchedFiles, reviewSignals }) {
  return {
    id: candidateId,
    knowledgeCandidateId: candidateId,
    title,
    status: reviewSignals.some((signal) => signal.ok === false || signal.productionReady === false) ? 'needs-attention' : 'pass',
    summary: {
      title,
      status: reviewSignals.some((signal) => signal.ok === false || signal.productionReady === false) ? 'needs-attention' : 'pass',
      message: summary,
    },
    problem: summary,
    message: summary,
    touchedFiles,
    reviewSignals,
    runtimeEvents: reviewSignals.map((signal) => ({
      eventName: signal.kind,
      status: signal.ok === false || signal.productionReady === false ? 'needs-attention' : 'pass',
      message: signal.summary ?? signal.kind,
      touchedFiles: signal.touchedFiles,
      at: signal.at,
    })),
    timeline: reviewSignals.map((signal) => ({
      event: signal.kind,
      message: signal.summary ?? signal.kind,
      status: signal.ok === false || signal.productionReady === false ? 'needs-attention' : 'pass',
      line: null,
      at: signal.at,
    })),
    rootCauseCandidates: source.rootCauseCandidates.length > 0
      ? source.rootCauseCandidates
      : source.symptoms.map((symptom) => ({ title: symptom })),
    verificationSteps: uniq([
      ...reviewSignals.map((signal) => signal.summary).filter(Boolean),
      ...source.verificationSteps,
    ]),
    prevention: uniq([
      '把本轮修复抽象成项目级 skill，而不是只保留一次性聊天上下文。',
      ...source.prevention,
    ]),
  };
}

function buildKnowledgeCandidateMeta({
  projectRoot,
  candidateId,
  candidatePath,
  draftSkillPath,
  candidateDir,
  source,
  title,
  summary,
  categories,
  reasons,
  touchedFiles,
  reviewSignals,
  existingCandidate,
}) {
  return {
    version: 1,
    candidateId,
    status: existingCandidate?.status === 'promoted' ? 'promoted' : 'pending-review',
    createdAt: existingCandidate?.createdAt ?? timestamp(),
    updatedAt: timestamp(),
    sourceKind: source.kind,
    sourceRef: source.sourceId,
    title,
    summary,
    categories,
    reasons,
    touchedFiles,
    reviewSignals,
    files: {
      candidate: candidatePath,
      candidateDir,
      draftSkill: draftSkillPath,
    },
    suggestedLearnCommand: `openprd quality . --learn --from ${path.relative(projectRoot, candidateDir) || '.'}`,
  };
}

export async function recordKnowledgeReviewSignal(projectRoot, signal = {}) {
  const statePath = knowledgePath(projectRoot, OPENPRD_HARNESS_TURN_STATE);
  if (!(await exists(statePath))) {
    return { ok: true, recorded: false, reason: 'turn-state-missing', turnStatePath: statePath };
  }
  const state = await readJson(statePath).catch(() => null);
  const current = readJsonObject(state);
  if (!current) {
    return { ok: true, recorded: false, reason: 'turn-state-invalid', turnStatePath: statePath };
  }
  const normalized = normalizeReviewSignal(projectRoot, signal);
  const existingSignals = Array.isArray(current.reviewSignals) ? current.reviewSignals : [];
  const reviewSignals = [normalized, ...existingSignals.filter((item) => item?.id !== normalized.id)].slice(0, 24);
  const touchedFiles = uniq([
    ...normalizeStringList(current.touchedFiles).map((file) => toRelativeProjectPath(projectRoot, file)),
    ...normalized.touchedFiles,
  ]);
  const runtimeEvents = Array.isArray(current.runtimeEvents) ? current.runtimeEvents : [];
  const timeline = Array.isArray(current.timeline) ? current.timeline : [];
  await writeJson(statePath, {
    ...current,
    touchedFiles,
    reviewSignals,
    runtimeEvents: [
      {
        eventName: normalized.kind,
        status: normalized.ok === false || normalized.productionReady === false ? 'needs-attention' : 'pass',
        message: normalized.summary ?? normalized.kind,
        at: normalized.at,
      },
      ...runtimeEvents,
    ].slice(0, 32),
    timeline: [
      {
        event: normalized.kind,
        message: normalized.summary ?? normalized.kind,
        status: normalized.ok === false || normalized.productionReady === false ? 'needs-attention' : 'pass',
        at: normalized.at,
      },
      ...timeline,
    ].slice(0, 32),
    updatedAt: timestamp(),
  });
  return {
    ok: true,
    recorded: true,
    turnStatePath: statePath,
  };
}

export async function reviewKnowledgeWorkspace(projectRoot, options = {}) {
  await ensureKnowledgeWorkspace(projectRoot);
  const from = options.from ?? ((await exists(knowledgePath(projectRoot, OPENPRD_HARNESS_TURN_STATE))) ? OPENPRD_HARNESS_TURN_STATE : null);
  if (!from) {
    return {
      ok: true,
      action: 'quality-knowledge-review',
      skipped: true,
      reason: 'no-review-source',
    };
  }

  const rawInput = await loadRawReviewInput(projectRoot, from);
  const resolved = await resolveQualityLearningSource(projectRoot, {
    from,
    latestReportPath: options.latestReportPath ?? null,
    requiredCorrelationFields: Array.isArray(options.requiredCorrelationFields) ? options.requiredCorrelationFields : [],
  });
  if (!resolved.ok) {
    return {
      ok: true,
      action: 'quality-knowledge-review',
      skipped: true,
      reason: resolved.error,
    };
  }

  const source = resolved.source;
  const raw = readJsonObject(rawInput.raw) ?? {};
  const reviewContext = buildReviewContext(projectRoot, raw, options);
  const touchedFiles = reviewContext.touchedFiles;
  const substantiveTouchedFiles = touchedFiles.filter(isSubstantiveTouchedFile);
  const reviewSignals = reviewContext.reviewSignals;
  const categories = buildKnowledgeCategories({ source, touchedFiles: substantiveTouchedFiles, reviewSignals });
  const reasons = categories.map(categoryReason);
  const hasStrongSignal = categories.length > 0
    || source.rootCauseCandidates.length > 0
    || source.symptoms.length > 1
    || reviewSignals.some((signal) => signal.ok === true || signal.productionReady === true);

  if (substantiveTouchedFiles.length === 0 || !hasStrongSignal) {
    return {
      ok: true,
      action: 'quality-knowledge-review',
      skipped: true,
      reason: substantiveTouchedFiles.length === 0 ? 'no-substantive-touched-files' : 'no-knowledge-signal',
      sourceKind: source.kind,
      sourcePath: source.sourcePath,
    };
  }

  const title = buildTurnReviewTitle(raw, source);
  const rawCandidateRef = firstString(raw.knowledgeCandidateId, raw.id);
  const candidateId = rawCandidateRef
    ? (rawCandidateRef.startsWith('candidate-') ? rawCandidateRef : `candidate-${slugify(rawCandidateRef, 'knowledge')}`)
    : `candidate-${slugify(source.sourceId ?? title, 'knowledge')}`;
  const promotedSource = { ...source, sourceId: candidateId };
  const names = deriveKnowledgeNames(promotedSource);
  const candidateDir = knowledgePath(projectRoot, cjoin(KNOWLEDGE_CANDIDATES_DIR, candidateId));
  const candidatePath = path.join(candidateDir, 'candidate.json');
  const diagnosticReportPath = path.join(candidateDir, 'diagnostic-report.json');
  const rootCausePath = path.join(candidateDir, 'root-cause-candidates.json');
  const timelinePath = path.join(candidateDir, 'timeline.json');
  const draftSkillPath = knowledgePath(projectRoot, cjoin(KNOWLEDGE_DRAFTS_DIR, names.skillName, 'SKILL.md'));
  const existingCandidate = await readJson(candidatePath).catch(() => null);
  const reviewSummary = [
    `本轮围绕 ${substantiveTouchedFiles.length} 个可沉淀文件生成回顾。`,
    reasons[0] ?? '这次实现已经具备项目级经验抽象价值。',
    reviewSignals.length > 0 ? `已记录 ${reviewSignals.length} 条回顾信号。` : null,
  ].filter(Boolean).join(' ');
  const candidate = buildKnowledgeCandidateMeta({
    projectRoot,
    candidateId,
    candidatePath,
    draftSkillPath,
    candidateDir,
    source: promotedSource,
    title,
    summary: reviewSummary,
    categories,
    reasons,
    touchedFiles: substantiveTouchedFiles,
    reviewSignals,
    existingCandidate: readJsonObject(existingCandidate) ?? null,
  });
  const relativeCandidateDir = path.relative(projectRoot, candidateDir).split(path.sep).join('/');
  await writeJson(candidatePath, candidate);
  await writeJson(diagnosticReportPath, buildCandidateDiagnosticReport({
    candidateId,
    title,
    summary: reviewSummary,
    source,
    touchedFiles: substantiveTouchedFiles,
    reviewSignals,
  }));
  await writeJson(rootCausePath, source.rootCauseCandidates.length > 0 ? source.rootCauseCandidates : substantiveTouchedFiles.map((file) => ({ title: `Inspect ${file}` })));
  await writeJson(timelinePath, reviewSignals.map((signal) => ({
    event: signal.kind,
    message: signal.summary ?? signal.kind,
    status: signal.ok === false || signal.productionReady === false ? 'needs-attention' : 'pass',
    at: signal.at,
  })));
  await writeText(draftSkillPath, renderKnowledgeDraftSkill({
    skillName: names.skillName,
    candidate,
    source,
    relativeCandidateDir,
  }));

  const index = await readKnowledgeIndex(projectRoot);
  await writeKnowledgeIndex(projectRoot, {
    ...index,
    candidates: upsertBy(index.candidates, 'candidateId', {
      candidateId,
      status: candidate.status,
      path: candidatePath,
      sourceKind: promotedSource.kind,
      sourceRef: promotedSource.sourceId,
      title,
      draftSkillPath,
    }),
    drafts: upsertBy(index.drafts, 'skillName', {
      skillName: names.skillName,
      path: draftSkillPath,
      candidateId,
      status: candidate.status,
    }),
  });

  return {
    ok: true,
    action: 'quality-knowledge-review',
    skipped: false,
    projectRoot,
    sourceKind: source.kind,
    sourcePath: source.sourcePath,
    candidateId,
    skillName: names.skillName,
    categories,
    reasons,
    summary: reviewSummary,
    suggestedLearnCommand: candidate.suggestedLearnCommand,
    files: {
      candidate: candidatePath,
      candidateDir,
      diagnosticReport: diagnosticReportPath,
      rootCauseCandidates: rootCausePath,
      timeline: timelinePath,
      draftSkill: draftSkillPath,
      index: knowledgePath(projectRoot, KNOWLEDGE_INDEX),
    },
  };
}

function candidateIdFromSourcePath(projectRoot, sourcePath) {
  if (!sourcePath) return null;
  const relative = toRelativeProjectPath(projectRoot, sourcePath);
  const match = relative.match(/^\.openprd\/knowledge\/candidates\/([^/]+)/);
  return match ? match[1] : null;
}

function candidateIdFromPath(projectRoot, candidatePath) {
  const direct = candidateIdFromSourcePath(projectRoot, candidatePath);
  if (direct) return direct;
  const basename = path.basename(String(candidatePath ?? ''));
  return basename && basename !== 'candidate.json' ? basename : null;
}

async function readCandidateById(projectRoot, candidateId) {
  if (!candidateId) return null;
  const candidatePath = knowledgePath(projectRoot, cjoin(KNOWLEDGE_CANDIDATES_DIR, candidateId, 'candidate.json'));
  const candidate = await readJson(candidatePath).catch(() => null);
  if (!candidate) return null;
  return {
    ...candidate,
    candidateId: candidate.candidateId ?? candidate.id ?? candidateId,
    status: normalizeCandidateStatus(candidate.status),
    files: {
      ...(candidate.files ?? {}),
      candidate: candidate.files?.candidate ?? candidatePath,
      candidateDir: candidate.files?.candidateDir ?? path.dirname(candidatePath),
    },
  };
}

function candidateIndexEntry(projectRoot, candidate, patch = {}) {
  const candidateId = candidate.candidateId ?? candidate.id ?? patch.candidateId;
  const candidatePath = candidate.files?.candidate
    ?? knowledgePath(projectRoot, cjoin(KNOWLEDGE_CANDIDATES_DIR, candidateId, 'candidate.json'));
  return {
    candidateId,
    status: normalizeCandidateStatus(candidate.status),
    path: candidatePath,
    sourceKind: candidate.sourceKind ?? null,
    sourceRef: candidate.sourceRef ?? null,
    title: candidate.title ?? candidateId,
    draftSkillPath: candidate.files?.draftSkill ?? null,
    ...patch,
  };
}

async function syncKnowledgeCandidateIndex(projectRoot, candidate, patch = {}) {
  const index = await readKnowledgeIndex(projectRoot);
  const entry = candidateIndexEntry(projectRoot, candidate, patch);
  await writeKnowledgeIndex(projectRoot, {
    ...index,
    candidates: upsertBy(index.candidates, 'candidateId', entry),
    drafts: entry.draftSkillPath
      ? upsertBy(index.drafts, 'skillName', {
          skillName: path.basename(path.dirname(entry.draftSkillPath)),
          path: entry.draftSkillPath,
          candidateId: entry.candidateId,
          status: entry.status,
        })
      : index.drafts,
  });
  return entry;
}

function mergeCandidateWithIndex(candidate, indexEntry, projectRoot) {
  const candidateId = candidate?.candidateId ?? candidate?.id ?? indexEntry?.candidateId ?? candidateIdFromPath(projectRoot, indexEntry?.path);
  const status = resolveCandidateStatus(candidate?.status, indexEntry?.status);
  const candidatePath = candidate?.files?.candidate
    ?? indexEntry?.path
    ?? (candidateId ? knowledgePath(projectRoot, cjoin(KNOWLEDGE_CANDIDATES_DIR, candidateId, 'candidate.json')) : null);
  const draftSkillPath = candidate?.files?.draftSkill ?? indexEntry?.draftSkillPath ?? null;
  return {
    ...(indexEntry ?? {}),
    ...(candidate ?? {}),
    candidateId,
    status,
    statusGroup: candidateStatusGroup(status),
    pending: isPendingKnowledgeCandidateStatus(status),
    reviewed: isReviewedKnowledgeCandidateStatus(status),
    path: candidatePath,
    draftSkillPath,
    title: candidate?.title ?? indexEntry?.title ?? candidateId,
    sourceKind: candidate?.sourceKind ?? indexEntry?.sourceKind ?? null,
    sourceRef: candidate?.sourceRef ?? indexEntry?.sourceRef ?? null,
    files: {
      ...(candidate?.files ?? {}),
      candidate: candidatePath,
      candidateDir: candidate?.files?.candidateDir ?? (candidatePath ? path.dirname(candidatePath) : null),
      draftSkill: draftSkillPath,
    },
  };
}

function buildCandidateCounts(candidates) {
  const counts = {
    total: candidates.length,
    pending: 0,
    promoted: 0,
    rejected: 0,
    archived: 0,
    reviewed: 0,
    byStatus: {},
  };
  for (const candidate of candidates) {
    counts.byStatus[candidate.status] = (counts.byStatus[candidate.status] ?? 0) + 1;
    counts[candidate.statusGroup] = (counts[candidate.statusGroup] ?? 0) + 1;
  }
  return counts;
}

export async function listKnowledgeCandidates(projectRoot, options = {}) {
  await ensureKnowledgeWorkspace(projectRoot);
  const index = await readKnowledgeIndex(projectRoot);
  const byId = new Map();
  for (const entry of index.candidates) {
    if (!entry?.candidateId) continue;
    byId.set(entry.candidateId, mergeCandidateWithIndex(null, entry, projectRoot));
  }
  const candidateRoot = knowledgePath(projectRoot, KNOWLEDGE_CANDIDATES_DIR);
  const dirs = await fs.readdir(candidateRoot, { withFileTypes: true }).catch(() => []);
  for (const entry of dirs) {
    if (!entry.isDirectory()) continue;
    const candidate = await readCandidateById(projectRoot, entry.name);
    if (!candidate) continue;
    byId.set(candidate.candidateId, mergeCandidateWithIndex(candidate, byId.get(candidate.candidateId), projectRoot));
  }
  const all = [...byId.values()].sort((left, right) => {
    const leftAt = left.updatedAt ?? left.reviewedAt ?? left.createdAt ?? '';
    const rightAt = right.updatedAt ?? right.reviewedAt ?? right.createdAt ?? '';
    return String(rightAt).localeCompare(String(leftAt));
  });
  const status = normalizeCandidateStatus(options.status ?? 'pending-review');
  const filtered = status === 'all'
    ? all
    : all.filter((candidate) => normalizeCandidateStatus(candidate.status) === status);
  const pending = all.filter((candidate) => candidate.pending);
  const reviewed = all.filter((candidate) => !candidate.pending);
  return {
    ok: true,
    action: 'knowledge-candidates',
    projectRoot,
    status: options.status ?? 'pending-review',
    candidates: filtered,
    pending,
    reviewed,
    counts: buildCandidateCounts(all),
    files: {
      knowledgeIndex: knowledgePath(projectRoot, KNOWLEDGE_INDEX),
      candidatesDir: candidateRoot,
    },
  };
}

async function updateKnowledgeCandidateStatus(projectRoot, options = {}) {
  await ensureKnowledgeWorkspace(projectRoot);
  const candidateId = options.id ?? candidateIdFromPath(projectRoot, options.path);
  if (!candidateId) {
    return {
      ok: false,
      action: `knowledge-${options.action ?? 'update'}`,
      projectRoot,
      errors: ['Knowledge candidate id is required.'],
    };
  }
  const candidate = await readCandidateById(projectRoot, candidateId);
  if (!candidate) {
    return {
      ok: false,
      action: `knowledge-${options.action ?? 'update'}`,
      projectRoot,
      candidateId,
      errors: [`Knowledge candidate not found: ${candidateId}`],
    };
  }
  const status = normalizeCandidateStatus(options.status);
  const nowValue = timestamp();
  const reviewReason = firstString(options.reason, options.notes, options.reviewDecision);
  const patch = {
    status,
    updatedAt: nowValue,
    reviewedAt: status === 'pending-review' ? candidate.reviewedAt ?? null : nowValue,
    reviewedBy: status === 'pending-review' ? candidate.reviewedBy ?? null : firstString(options.reviewedBy, 'codex'),
    reviewDecision: firstString(options.reviewDecision, reviewReason, status),
    reviewReason: reviewReason ?? null,
  };
  if (status === 'rejected') {
    patch.rejectedAt = nowValue;
  }
  if (status === 'archived') {
    patch.archivedAt = nowValue;
  }
  if (status === 'pending-review') {
    patch.restoredAt = nowValue;
    patch.reviewDecision = null;
    patch.reviewReason = null;
  }
  const nextCandidate = {
    ...candidate,
    ...patch,
    files: candidate.files,
  };
  const candidatePath = nextCandidate.files.candidate;
  await writeJson(candidatePath, nextCandidate);
  const indexPatch = {
    ...patch,
    reviewedAt: nextCandidate.reviewedAt,
    reviewedBy: nextCandidate.reviewedBy,
    reviewDecision: nextCandidate.reviewDecision,
    reviewReason: nextCandidate.reviewReason,
  };
  const entry = await syncKnowledgeCandidateIndex(projectRoot, nextCandidate, indexPatch);
  return {
    ok: true,
    action: `knowledge-${options.action ?? status}`,
    projectRoot,
    candidateId,
    candidate: mergeCandidateWithIndex(nextCandidate, entry, projectRoot),
    files: {
      candidate: candidatePath,
      knowledgeIndex: knowledgePath(projectRoot, KNOWLEDGE_INDEX),
    },
  };
}

export async function rejectKnowledgeCandidate(projectRoot, options = {}) {
  return updateKnowledgeCandidateStatus(projectRoot, {
    ...options,
    action: 'reject',
    status: 'rejected',
    reviewDecision: firstString(options.reason, options.notes, 'rejected'),
  });
}

export async function archiveKnowledgeCandidate(projectRoot, options = {}) {
  return updateKnowledgeCandidateStatus(projectRoot, {
    ...options,
    action: 'archive',
    status: 'archived',
    reviewDecision: firstString(options.reason, options.notes, 'archived'),
  });
}

export async function restoreKnowledgeCandidate(projectRoot, options = {}) {
  return updateKnowledgeCandidateStatus(projectRoot, {
    ...options,
    action: 'restore',
    status: 'pending-review',
    reviewDecision: null,
  });
}

export async function markKnowledgeCandidatePromoted(projectRoot, options = {}) {
  await ensureKnowledgeWorkspace(projectRoot);
  const candidateId = candidateIdFromSourcePath(projectRoot, options.sourcePath)
    ?? (Array.isArray(options.sourcePaths)
      ? options.sourcePaths.map((entry) => candidateIdFromSourcePath(projectRoot, entry)).find(Boolean)
      : null);
  if (!candidateId) {
    return { ok: true, updated: false };
  }
  const candidatePath = knowledgePath(projectRoot, cjoin(KNOWLEDGE_CANDIDATES_DIR, candidateId, 'candidate.json'));
  const candidate = await readJson(candidatePath).catch(() => null);
  if (!candidate) {
    return { ok: true, updated: false };
  }
  const nextCandidate = {
    ...candidate,
    candidateId: candidate.candidateId ?? candidate.id ?? candidateId,
    status: 'promoted',
    promotedAt: timestamp(),
    promotedSkillPath: options.skillPath ?? null,
    promotedIncidentPath: options.incidentPath ?? null,
    promotedPatternPath: options.patternPath ?? null,
    updatedAt: timestamp(),
    files: {
      ...(candidate.files ?? {}),
      candidate: candidate.files?.candidate ?? candidatePath,
      candidateDir: candidate.files?.candidateDir ?? path.dirname(candidatePath),
    },
  };
  await writeJson(candidatePath, nextCandidate);
  await syncKnowledgeCandidateIndex(projectRoot, nextCandidate, {
    status: 'promoted',
    promotedAt: nextCandidate.promotedAt,
    promotedSkillPath: nextCandidate.promotedSkillPath,
  });
  return {
    ok: true,
    updated: true,
    candidateId,
    candidatePath,
  };
}

export {
  deriveKnowledgeNames,
  ensureKnowledgeWorkspace,
  isPendingKnowledgeCandidateStatus,
  isReviewedKnowledgeCandidateStatus,
  KNOWLEDGE_CANDIDATES_DIR,
  KNOWLEDGE_DRAFTS_DIR,
  KNOWLEDGE_INDEX,
  normalizeCandidateStatus,
  OPENPRD_HARNESS_TURN_STATE,
};
