#!/usr/bin/env node

const LIMIT = 20;
const FIELDS = ['规模信号', '预警原因', '本次处理结果', '后续建议'];

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

function countChars(value) {
  return Array.from(String(value ?? '')).length;
}

function scaleSignal(file) {
  const lineCount = Number(file?.lineCount ?? 0);
  const thresholds = file?.thresholds ?? {};
  const okMax = Number(thresholds.okMax ?? 700);
  const attentionMax = Number(thresholds.attentionMax ?? 1500);
  if (lineCount > attentionMax) {
    return `${lineCount} 行（> ${attentionMax} 行/文件）`;
  }
  if (lineCount > okMax) {
    return `${lineCount} 行（> ${okMax} 行/文件）`;
  }
  return `${lineCount} 行`;
}

function rowForFile(file) {
  if (file?.status === 'warning' || Number(file?.lineCount ?? 0) > Number(file?.thresholds?.attentionMax ?? 1500)) {
    return {
      规模信号: scaleSignal(file),
      预警原因: '文件太大，后续改动风险高',
      本次处理结果: '这次先完成需求，暂不拆分',
      后续建议: '优先拆出独立职责',
    };
  }
  if (file?.status === 'error') {
    return {
      规模信号: scaleSignal(file),
      预警原因: '检查失败，需先修复',
      本次处理结果: '已停止就绪判断',
      后续建议: '修复后重新检查',
    };
  }
  return {
    规模信号: scaleSignal(file),
    预警原因: '文件偏大，维护成本升',
    本次处理结果: '本轮小改，未扩职责',
    后续建议: '继续改前先拆小',
  };
}

function validateRows(rows) {
  const errors = [];
  rows.forEach((row, index) => {
    const target = row?.影响对象 ?? `row ${index + 1}`;
    for (const field of FIELDS) {
      const length = countChars(row?.[field]);
      if (length > LIMIT) {
        errors.push(`${target} ${field} 超过 ${LIMIT} 字上限，请缩短后重试。`);
      }
    }
  });
  return errors;
}

const input = JSON.parse((await readStdin()) || '{}');

if (process.argv.includes('--validate')) {
  const rows = Array.isArray(input.rows) ? input.rows : [];
  const errors = validateRows(rows);
  if (errors.length > 0) {
    process.stderr.write(`${errors.join('\n')}\n`);
    process.exit(1);
  }
  process.stdout.write(`${JSON.stringify({ ok: true, limit: LIMIT })}\n`);
  process.exit(0);
}

const files = Array.isArray(input.files) ? input.files : [];
const rows = files.map(rowForFile);
const errors = validateRows(rows);
if (errors.length > 0) {
  process.stderr.write(`${errors.join('\n')}\n`);
  process.exit(1);
}
process.stdout.write(`${JSON.stringify({ limit: LIMIT, rows }, null, 2)}\n`);
