/*
 * 核心功能
 * 执行 benchmark verify，包括远程探活、重复检测和 promotion 控制校验。
 *
 * 输入
 * 接收项目根目录和 benchmark workspace 内已存在的 approved/candidate source 数据。
 *
 * 输出
 * 导出 benchmark verify 结果，并在校验通过时回写 lastVerified 等字段。
 *
 * 定位
 * 位于 benchmark 质量门禁层，负责验证与探测，不直接承载 add/observe/approve 入口。
 *
 * 依赖
 * 依赖 node:child_process、fs-utils、time，以及 source/storage 提供的领域逻辑与持久化能力。
 *
 * 维护规则
 * 新增 verify 规则时必须区分 error 与 warning，避免把 advisory 检查升级成破坏性门禁。
 */
import path from 'node:path';
import { spawn } from 'node:child_process';
import { exists, writeYaml } from '../fs-utils.js';
import { timestamp } from '../time.js';
import { benchmarkRecommendations, hasOverbroadTrigger, normalizeCheckedSource, sourceIdentity, validatePromotionControl } from './source.js';
import {
  ensureBenchmarkWorkspace,
  loadApprovedSources,
  loadCandidateSources,
  refreshBenchmarkIndex,
  sourceFilePath,
  writeApprovedSources,
} from './storage.js';

async function fetchWithTimeout(urlString, method, timeoutMs = 4000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(urlString, {
      method,
      redirect: 'follow',
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function isReachableProbeStatus(status) {
  return (status >= 200 && status < 400) || status === 401 || status === 403 || status === 405;
}

async function probeRemoteSourceWithCurl(urlString, timeoutMs = 6000) {
  return await new Promise((resolve) => {
    const timeoutSeconds = Math.max(1, Math.ceil(timeoutMs / 1000));
    const child = spawn(
      'curl',
      [
        '-L',
        '-o',
        '/dev/null',
        '-s',
        '-w',
        '%{http_code}',
        '--max-time',
        String(timeoutSeconds),
        urlString,
      ],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );

    let stdout = '';
    let stderr = '';
    let settled = false;
    const settle = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      settle({ ok: false, reason: 'curl probe timeout' });
    }, timeoutMs + 250);

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', (error) => {
      clearTimeout(timeout);
      settle({ ok: false, reason: error instanceof Error ? error.message : String(error) });
    });
    child.on('close', (code) => {
      clearTimeout(timeout);
      const status = Number.parseInt(stdout.trim(), 10);
      if (Number.isInteger(status) && isReachableProbeStatus(status)) {
        settle({ ok: true, status, via: 'curl' });
        return;
      }
      if (Number.isInteger(status) && status > 0) {
        settle({ ok: false, status, reason: `HTTP ${status}` });
        return;
      }
      const detail = stderr.trim() || `curl exit ${code ?? 'unknown'}`;
      settle({ ok: false, reason: detail });
    });
  });
}

async function probeRemoteSource(urlString) {
  try {
    const headResponse = await fetchWithTimeout(urlString, 'HEAD');
    if (isReachableProbeStatus(headResponse.status)) {
      return { ok: true, status: headResponse.status };
    }
    return { ok: false, status: headResponse.status, reason: `HTTP ${headResponse.status}` };
  } catch {
    try {
      const getResponse = await fetchWithTimeout(urlString, 'GET', 5000);
      if (isReachableProbeStatus(getResponse.status)) {
        return { ok: true, status: getResponse.status };
      }
      return { ok: false, status: getResponse.status, reason: `HTTP ${getResponse.status}` };
    } catch (error) {
      const fallback = await probeRemoteSourceWithCurl(urlString);
      if (fallback.ok) {
        return fallback;
      }
      return { ok: false, reason: fallback.reason ?? (error instanceof Error ? error.message : String(error)) };
    }
  }
}

async function verifyBenchmarkWorkspace(projectRoot) {
  await ensureBenchmarkWorkspace(projectRoot);
  const approved = await loadApprovedSources(projectRoot);
  const candidates = await loadCandidateSources(projectRoot);
  const allSources = [...approved, ...candidates];
  const checks = [];
  const seenIds = new Map();
  const seenLocations = new Map();
  const approvedUpdates = new Map();
  const candidateUpdates = new Map();

  for (const source of allSources) {
    const issues = [];
    if (seenIds.has(source.id)) {
      issues.push({ level: 'error', code: 'duplicate-id', message: `Duplicate benchmark id with ${seenIds.get(source.id)}` });
    } else {
      seenIds.set(source.id, source.id);
    }

    const identity = sourceIdentity(source);
    if (seenLocations.has(identity)) {
      issues.push({ level: 'error', code: 'duplicate-source', message: `Duplicate benchmark source with ${seenLocations.get(identity)}` });
    } else {
      seenLocations.set(identity, source.id);
    }

    if (source.url) {
      try {
        new URL(source.url);
      } catch {
        issues.push({ level: 'error', code: 'invalid-url', message: `Invalid URL: ${source.url}` });
      }
      if (!issues.some((issue) => issue.code === 'invalid-url')) {
        const probe = await probeRemoteSource(source.url);
        if (!probe.ok) {
          issues.push({ level: 'error', code: 'unreachable-source', message: `Unreachable source: ${source.url} (${probe.reason ?? 'unknown'})` });
        }
      }
    }

    if (source.path) {
      const absolutePath = path.resolve(projectRoot, source.path);
      if (!(await exists(absolutePath))) {
        issues.push({ level: 'error', code: 'missing-local-source', message: `Missing local source: ${source.path}` });
      }
    }

    if (!Array.isArray(source.scenarios) || source.scenarios.length === 0) {
      issues.push({ level: 'warning', code: 'missing-scenarios', message: 'Missing benchmark scenarios.' });
    }
    if (hasOverbroadTrigger(source)) {
      issues.push({ level: 'warning', code: 'overbroad-trigger', message: 'Trigger rules are too broad or missing.' });
    }

    issues.push(...validatePromotionControl(source));

    const ok = !issues.some((issue) => issue.level === 'error');
    const nextSource = ok ? normalizeCheckedSource(source) : source;
    if (source.status === 'approved') {
      approvedUpdates.set(source.id, nextSource);
    } else {
      candidateUpdates.set(source.id, nextSource);
    }
    checks.push({
      id: source.id,
      title: source.title,
      status: source.status,
      ok,
      issues,
    });
  }

  const approvedNext = approved.map((source) => approvedUpdates.get(source.id) ?? source);
  const candidateNext = candidates.map((source) => candidateUpdates.get(source.id) ?? source);
  await writeApprovedSources(projectRoot, approvedNext);
  for (const source of candidateNext) {
    await writeYaml(sourceFilePath(projectRoot, source.id), source);
  }
  await refreshBenchmarkIndex(projectRoot);

  const errors = checks.flatMap((check) => check.issues.filter((issue) => issue.level === 'error').map((issue) => `${check.id}: ${issue.message}`));
  const warnings = checks.flatMap((check) => check.issues.filter((issue) => issue.level !== 'error').map((issue) => `${check.id}: ${issue.message}`));

  return {
    ok: errors.length === 0,
    action: 'benchmark-verify',
    projectRoot,
    checkedAt: timestamp(),
    checks,
    errors,
    warnings,
    recommendations: benchmarkRecommendations(candidateNext),
  };
}

export {
  verifyBenchmarkWorkspace,
};
