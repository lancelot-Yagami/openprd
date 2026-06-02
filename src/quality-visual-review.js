import fs from 'node:fs/promises';
import path from 'node:path';
import { cjoin, readJson } from './fs-utils.js';

const VISUAL_REVIEW_DIR = cjoin('.openprd', 'harness', 'visual-reviews');
const VISUAL_REVIEW_SCHEMA = 'openprd.visual-review.v1';
const VISUAL_REVIEW_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

function normalizeWorkspacePath(value) {
  return String(value ?? '').split(path.sep).join('/');
}

function inferVisualReviewMode(value) {
  const normalized = normalizeWorkspacePath(value).toLowerCase();
  if (normalized.includes('visual-before-after') || normalized.includes('before-after')) {
    return 'before-after';
  }
  if (normalized.includes('visual-compare') || normalized.includes('reference-actual')) {
    return 'reference-actual';
  }
  return null;
}

async function walkVisualReviewDir(projectRoot, dir, collected) {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const fullPath = cjoin(dir, entry.name);
    if (entry.isDirectory()) {
      await walkVisualReviewDir(projectRoot, fullPath, collected);
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    const ext = path.extname(entry.name).toLowerCase();
    if (!VISUAL_REVIEW_IMAGE_EXTENSIONS.has(ext) && ext !== '.json') {
      continue;
    }
    const relativePath = normalizeWorkspacePath(path.relative(projectRoot, fullPath));
    collected.push({ fullPath, relativePath, ext });
  }
}

export async function listVisualReviewArtifacts(projectRoot) {
  const root = cjoin(projectRoot, VISUAL_REVIEW_DIR);
  const entries = [];
  await walkVisualReviewDir(projectRoot, root, entries);
  const artifactsByKey = new Map();

  for (const entry of entries) {
    if (entry.ext === '.json') {
      const payload = await readJson(entry.fullPath).catch(() => null);
      if (payload?.schema !== VISUAL_REVIEW_SCHEMA) {
        continue;
      }
      const key = normalizeWorkspacePath(String(payload.outputPath ?? entry.relativePath).replace(/\.[^.]+$/u, ''));
      const existing = artifactsByKey.get(key) ?? {};
      const outputPath = normalizeWorkspacePath(payload.outputPath ?? '');
      const inferredMode = payload.mode ?? inferVisualReviewMode(outputPath) ?? inferVisualReviewMode(entry.relativePath);
      if (!inferredMode) {
        continue;
      }
      const stat = await fs.stat(entry.fullPath).catch(() => null);
      artifactsByKey.set(key, {
        ...existing,
        path: outputPath || existing.path || entry.relativePath,
        metadataPath: entry.relativePath,
        mode: inferredMode,
        labels: payload.labels ?? existing.labels ?? null,
        generatedAt: payload.generatedAt ?? existing.generatedAt ?? null,
        mtimeMs: stat?.mtimeMs ?? existing.mtimeMs ?? 0,
      });
      continue;
    }

    const key = entry.relativePath.replace(/\.[^.]+$/u, '');
    const existing = artifactsByKey.get(key) ?? {};
    const inferredMode = inferVisualReviewMode(entry.relativePath);
    if (!inferredMode) {
      continue;
    }
    const stat = await fs.stat(entry.fullPath).catch(() => null);
    artifactsByKey.set(key, {
      ...existing,
      path: entry.relativePath,
      mode: existing.mode ?? inferredMode,
      mtimeMs: stat?.mtimeMs ?? existing.mtimeMs ?? 0,
    });
  }

  return [...artifactsByKey.values()]
    .filter((artifact) => artifact.path && artifact.mode)
    .sort((a, b) => (b.mtimeMs ?? 0) - (a.mtimeMs ?? 0))
    .slice(0, 24);
}

export function detectVisualReview({ policy, activeChangeContext, activeTasks, visualArtifacts, includesAny }) {
  const relevant = policy.requiredGates.includes('visual-review');
  const haystack = [
    activeChangeContext.text,
    activeTasks.tasks.map((task) => [
      task.title,
      ...Object.entries(task.metadata ?? {}).map(([key, value]) => `${key}: ${value}`),
    ].join('\n')).join('\n'),
  ].join('\n');
  const referenceTokens = [
    'reference image',
    'reference design',
    'design reference',
    'effect image',
    'mockup',
    'figma',
    '效果图',
    '设计稿',
    '视觉稿',
    '参考图',
    '用户给图',
    '图片资产',
  ];
  const expectsReferenceCompare = includesAny(haystack, referenceTokens);
  const referenceArtifacts = visualArtifacts.filter((artifact) => artifact.mode === 'reference-actual');
  const beforeAfterArtifacts = visualArtifacts.filter((artifact) => artifact.mode === 'before-after');
  const matchingArtifacts = expectsReferenceCompare
    ? referenceArtifacts
    : [...referenceArtifacts, ...beforeAfterArtifacts];
  const evidenceSources = matchingArtifacts.slice(0, 12).map((artifact) => ({
    path: artifact.path,
    source: artifact.mode === 'reference-actual' ? 'visual-review/reference-actual' : 'visual-review/before-after',
  }));
  const warnings = [];

  if (relevant && matchingArtifacts.length === 0) {
    warnings.push(
      expectsReferenceCompare
        ? '检测到界面视觉改动且已有参考图/设计稿语义，但未看到本次“效果图 / 实现截图”对比证据。'
        : '检测到界面视觉改动，但未看到本次 visual-compare 产出的视觉对比或修改前后自检证据。'
    );
  } else if (relevant && expectsReferenceCompare && referenceArtifacts.length === 0 && beforeAfterArtifacts.length > 0) {
    warnings.push('当前只发现修改前后自检图；如果已有参考图或设计稿，请补一份“效果图 / 实现截图”对比图。');
  }

  const summary = !relevant
    ? '当前场景未要求视觉评审证据'
    : matchingArtifacts.length > 0
      ? (
          expectsReferenceCompare
            ? `已找到 ${matchingArtifacts.length} 份效果图 / 实现截图对比证据`
            : `已找到 ${matchingArtifacts.length} 份视觉对比或修改前后自检证据`
        )
      : (
          expectsReferenceCompare
            ? '未找到本次效果图 / 实现截图对比证据'
            : '未找到本次 visual-compare 视觉证据'
        );

  return {
    status: !relevant || matchingArtifacts.length > 0 ? 'pass' : 'needs-evidence',
    relevant,
    expectsReferenceCompare,
    artifacts: visualArtifacts,
    matchingArtifacts,
    warnings,
    evidence: {
      present: matchingArtifacts.length > 0,
      sources: evidenceSources,
      summary,
    },
  };
}

export {
  VISUAL_REVIEW_DIR,
  VISUAL_REVIEW_SCHEMA,
};
