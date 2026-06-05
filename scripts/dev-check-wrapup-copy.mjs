#!/usr/bin/env node

export const DEV_CHECK_WRAPUP_COPY_LIMIT = 20;
const WRAPUP_FIELDS = ['规模信号', '预警原因', '本次处理结果', '后续建议'];
const VALIDATE_USAGE = 'Usage: echo \'{"rows":[{"影响对象":"src/example.js","规模信号":"701 行（> 700 行/文件）","预警原因":"文件偏大，维护成本升","本次处理结果":"本轮小改，未扩职责","后续建议":"继续改前先拆小"}]}\' | node scripts/dev-check-wrapup-copy.mjs --validate';

function countChars(value) {
  return Array.from(String(value ?? ''));
}

function validateCompactRows(rows = [], limit = DEV_CHECK_WRAPUP_COPY_LIMIT) {
  for (const [index, row] of rows.entries()) {
    const rowLabel = row?.影响对象 ? String(row.影响对象) : (row?.影响位置 ? String(row.影响位置) : `第 ${index + 1} 行`);
    for (const field of WRAPUP_FIELDS) {
      const value = row?.[field];
      if (typeof value !== 'string') {
        throw new Error(`后续建议校验失败：${rowLabel} 缺少字段“${field}”。${VALIDATE_USAGE}`);
      }
      const actual = countChars(value).length;
      if (actual > limit) {
        throw new Error(`后续建议校验失败：${rowLabel} 的“${field}”有 ${actual} 个字，超过 ${limit} 字上限。当前内容：“${value}”。请缩短后重试。`);
      }
    }
  }
}

function formatLineCount(value) {
  return value === null || value === undefined ? '未知行数' : `${value} 行`;
}

function thresholdText(file) {
  const thresholds = file.thresholds ?? {};
  const okMax = thresholds.okMax ?? 700;
  const attentionMax = thresholds.attentionMax ?? 1500;
  const lineText = formatLineCount(file.lineCount);
  if (file.status === 'warning') {
    return `${lineText}（> ${attentionMax} 行/文件）`;
  }
  if (file.status === 'attention') {
    return `${lineText}（> ${okMax} 行/文件）`;
  }
  if (file.status === 'error') {
    return `${lineText}（检查失败）`;
  }
  if (file.status === 'ok') {
    return `${lineText}（范围内）`;
  }
  return lineText;
}

function reasonText(file) {
  if (file.status === 'warning') return '文件太大，后续改动风险高';
  if (file.status === 'attention') return '文件偏大，维护成本升';
  if (file.status === 'error') return '检查失败，需先修复';
  if (file.status === 'ok') return '暂无额外预警';
  return '待补充';
}

function currentResultText(file) {
  if (file.status === 'warning') return '这次先完成需求，暂不拆分';
  if (file.status === 'attention') return '本轮小改，未扩职责';
  if (file.status === 'error') return '本轮失败，未收口';
  if (file.status === 'ok') return '本轮已回顾';
  return '待确认';
}

function followUpText(file) {
  if (file.status === 'warning') return '优先拆出独立职责';
  if (file.status === 'attention') return '继续改前先拆小';
  if (file.status === 'error') return '先修复后重跑';
  if (file.status === 'ok') return '无需额外动作';
  return '待确认';
}

export function buildCompactDevCheckWrapUpRows(files = []) {
  return files.map((file) => ({
    规模信号: thresholdText(file),
    预警原因: reasonText(file),
    本次处理结果: currentResultText(file),
    后续建议: followUpText(file),
  }));
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function main() {
  const validateOnly = process.argv.includes('--validate');
  const raw = await readStdin();
  const payload = raw.trim() ? JSON.parse(raw) : {};
  const rows = validateOnly
    ? (Array.isArray(payload.rows) ? payload.rows : [])
    : buildCompactDevCheckWrapUpRows(Array.isArray(payload.files) ? payload.files : []);
  validateCompactRows(rows);
  process.stdout.write(JSON.stringify({
    ok: true,
    limit: DEV_CHECK_WRAPUP_COPY_LIMIT,
    rows,
  }));
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
