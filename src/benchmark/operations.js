/*
 * 核心功能
 * 实现 benchmark add/observe/list/approve 等 workspace 级命令动作。
 *
 * 输入
 * 接收项目根目录和 CLI/options 透传的 source、notes、threshold、id 等参数。
 *
 * 输出
 * 导出结构化 benchmark 操作结果，并在需要时写入 candidate、approved、evidence 和 index 文件。
 *
 * 定位
 * 位于 benchmark 应用层，负责编排 source 逻辑与 storage 落盘，不承担 verify 探测职责。
 *
 * 依赖
 * 依赖 render、source、storage 和 fs-utils；由 benchmark.js 作为对外入口复用。
 *
 * 维护规则
 * 修改返回 payload 时必须保持 CLI 与测试依赖的 action/source/files/counts 契约稳定。
 */
import fs from 'node:fs/promises';
import { writeText, writeYaml } from '../fs-utils.js';
import { timestamp } from '../time.js';
import {
  BENCHMARK_INDEX_FILE,
  BENCHMARK_SOURCES_FILE,
  benchmarkPath,
} from './constants.js';
import { renderEvidence } from './render.js';
import {
  benchmarkRecommendations,
  buildObservationEvidence,
  buildSourceValue,
  duplicateSource,
  normalizeAdoptionEvidence,
  normalizeAdoptionThreshold,
  normalizeSourceRecord,
  resolveSourceInput,
  withPromotion,
} from './source.js';
import {
  ensureBenchmarkWorkspace,
  evidenceFilePath,
  loadApprovedSources,
  loadCandidateSources,
  readCandidateById,
  refreshBenchmarkIndex,
  sourceFilePath,
  writeApprovedSources,
} from './storage.js';

async function addBenchmarkWorkspace(projectRoot, options = {}) {
  await ensureBenchmarkWorkspace(projectRoot);
  const sourceValue = await resolveSourceInput(projectRoot, options.source ?? options.target ?? options.reference ?? null);
  const source = buildSourceValue(sourceValue, options.notes ?? null);
  const approved = await loadApprovedSources(projectRoot);
  const candidates = await loadCandidateSources(projectRoot);
  const duplicate = duplicateSource([...approved, ...candidates], source);
  if (duplicate) {
    return {
      ok: false,
      action: 'benchmark-add',
      projectRoot,
      error: `Benchmark source already exists: ${duplicate.id}`,
      duplicate,
    };
  }

  const candidatePath = sourceFilePath(projectRoot, source.id);
  const evidencePath = evidenceFilePath(projectRoot, source.id);
  await writeYaml(candidatePath, source);
  await writeText(evidencePath, `${renderEvidence(source)}\n`);
  const refreshed = await refreshBenchmarkIndex(projectRoot);

  return {
    ok: true,
    action: 'benchmark-add',
    projectRoot,
    source,
    files: {
      candidate: candidatePath,
      evidence: evidencePath,
      index: benchmarkPath(projectRoot, BENCHMARK_INDEX_FILE),
      sources: benchmarkPath(projectRoot, BENCHMARK_SOURCES_FILE),
    },
    summary: {
      approved: refreshed.approved.length,
      candidates: refreshed.candidates.length,
    },
  };
}

async function observeBenchmarkSourceWorkspace(projectRoot, options = {}) {
  await ensureBenchmarkWorkspace(projectRoot);
  const threshold = normalizeAdoptionThreshold(options.threshold);
  const sourceValue = await resolveSourceInput(projectRoot, options.source ?? options.target ?? options.reference ?? null);
  const observed = buildSourceValue(sourceValue, options.notes ?? null);
  const approved = await loadApprovedSources(projectRoot);
  const candidates = await loadCandidateSources(projectRoot);
  const duplicate = duplicateSource([...approved, ...candidates], observed);
  const baseSource = duplicate ?? observed;
  const evidence = buildObservationEvidence(baseSource, options);
  const adoptedCount = Math.max(0, Number(baseSource.adoptedCount ?? 0)) + 1;
  const nextSource = withPromotion({
    ...baseSource,
    id: baseSource.id,
    status: baseSource.status ?? 'candidate',
    note: baseSource.note ?? observed.note,
    value: baseSource.value ?? observed.value,
    adoptedCount,
    lastUsedAt: evidence.observedAt,
    evidence: [
      ...normalizeAdoptionEvidence(baseSource.evidence),
      evidence,
    ],
  }, threshold, baseSource.promotion?.windowDays);

  if (nextSource.status === 'approved') {
    const nextApproved = approved.filter((source) => source.id !== nextSource.id);
    nextApproved.push(nextSource);
    await writeApprovedSources(projectRoot, nextApproved);
  } else {
    await writeYaml(sourceFilePath(projectRoot, nextSource.id), nextSource);
  }
  await writeText(evidenceFilePath(projectRoot, nextSource.id), `${renderEvidence(nextSource)}\n`);
  const refreshed = await refreshBenchmarkIndex(projectRoot);

  return {
    ok: true,
    action: 'benchmark-observe',
    projectRoot,
    source: nextSource,
    created: !duplicate,
    evidence,
    recommended: Boolean(nextSource.promotion?.recommended),
    recommendation: nextSource.promotion?.recommended
      ? {
          id: nextSource.id,
          title: nextSource.title,
          adoptedCount: nextSource.recentAdoptedCount,
          totalAdoptedCount: nextSource.adoptedCount,
          threshold: nextSource.promotion.threshold,
          windowDays: nextSource.promotion.windowDays,
          approveCommand: nextSource.promotion.approveCommand,
        }
      : null,
    files: {
      candidate: nextSource.status === 'candidate' ? sourceFilePath(projectRoot, nextSource.id) : null,
      evidence: evidenceFilePath(projectRoot, nextSource.id),
      index: benchmarkPath(projectRoot, BENCHMARK_INDEX_FILE),
      sources: benchmarkPath(projectRoot, BENCHMARK_SOURCES_FILE),
    },
    summary: {
      approved: refreshed.approved.length,
      candidates: refreshed.candidates.length,
    },
  };
}

async function listBenchmarkWorkspace(projectRoot) {
  await ensureBenchmarkWorkspace(projectRoot);
  const approved = await loadApprovedSources(projectRoot);
  const candidates = await loadCandidateSources(projectRoot);
  return {
    ok: true,
    action: 'benchmark-list',
    projectRoot,
    approved,
    candidates,
    counts: {
      approved: approved.length,
      candidates: candidates.length,
    },
    recommendations: benchmarkRecommendations(candidates),
  };
}

async function listBenchmarkRecommendationsWorkspace(projectRoot) {
  await ensureBenchmarkWorkspace(projectRoot);
  const candidates = await loadCandidateSources(projectRoot);
  return benchmarkRecommendations(candidates);
}

async function approveBenchmarkWorkspace(projectRoot, options = {}) {
  await ensureBenchmarkWorkspace(projectRoot);
  const id = String(options.id ?? '').trim();
  if (!id) {
    throw new Error('Benchmark id is required for approve.');
  }
  const candidate = await readCandidateById(projectRoot, id);
  if (!candidate) {
    throw new Error(`Benchmark candidate not found: ${id}`);
  }

  const approved = await loadApprovedSources(projectRoot);
  const approvedSource = normalizeSourceRecord({
    ...candidate,
    status: 'approved',
    approvedAt: timestamp(),
    promotion: {
      ...(candidate.promotion ?? {}),
      recommended: false,
      recommendedAt: null,
      approveCommand: null,
    },
  });
  const nextApproved = approved.filter((source) => source.id !== id);
  nextApproved.push(approvedSource);
  await writeApprovedSources(projectRoot, nextApproved);
  await fs.rm(sourceFilePath(projectRoot, id), { force: true });
  await writeText(evidenceFilePath(projectRoot, id), `${renderEvidence(approvedSource)}\n`);
  const refreshed = await refreshBenchmarkIndex(projectRoot);

  return {
    ok: true,
    action: 'benchmark-approve',
    projectRoot,
    source: approvedSource,
    counts: {
      approved: refreshed.approved.length,
      candidates: refreshed.candidates.length,
    },
    files: {
      sources: benchmarkPath(projectRoot, BENCHMARK_SOURCES_FILE),
      index: benchmarkPath(projectRoot, BENCHMARK_INDEX_FILE),
    },
  };
}

export {
  addBenchmarkWorkspace,
  approveBenchmarkWorkspace,
  listBenchmarkRecommendationsWorkspace,
  listBenchmarkWorkspace,
  observeBenchmarkSourceWorkspace,
};
