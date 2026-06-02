/*
 * 核心功能
 * 渲染 standards、dev-check、quality、knowledge 和 visual compare 等质量相关命令输出。
 *
 * 输入
 * 接收标准校验、研发期行数检查、质量报告、知识候选和视觉对比等结构化结果对象。
 *
 * 输出
 * 向终端输出质量门禁、证据状态、知识候选和视觉对比摘要，或在 `--json` 模式下直出 JSON。
 *
 * 定位
 * 位于 CLI 表现层的质量输出模块，负责 standards/quality 这一类高频质量反馈。
 *
 * 依赖
 * 依赖 shared-print 中的知识回顾 helper，不承担实际检测逻辑。
 *
 * 维护规则
 * 质量类输出要优先保留 production-ready、门禁范围和证据状态，避免把关键风险埋进长文本里。
 */
import { printKnowledgeReview } from './shared-print.js';

function printStandardsResult(result, json) {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (result.action === 'init') {
    console.log(`已初始化 OpenPrd standards: ${result.docsRoot}`);
    for (const item of result.changed) {
      console.log(`- ${item.status}: ${item.path}`);
    }
    return;
  }
  if (result.action === 'classify-external-reference') {
    console.log(`已归类外部参考源码: ${result.path}`);
    console.log(`配置: ${result.configPath}`);
    console.log(`状态: ${result.alreadyPresent ? '已存在' : '已写入'}`);
    return;
  }

  console.log(`OpenPrd standards: ${result.ok ? '通过' : '失败'}`);
  console.log(`Docs root: ${result.docsRoot}`);
  for (const check of result.checks) {
    console.log(`- ${check}`);
  }
  if (result.errors.length > 0) {
    console.log('错误:');
    for (const error of result.errors) {
      console.log(`- ${error}`);
    }
  }
  if (result.warnings.length > 0) {
    console.log('警告:');
    for (const warning of result.warnings) {
      console.log(`- ${warning}`);
    }
  }
  const candidates = result.manualReport?.externalReferenceCandidates ?? [];
  if (candidates.length > 0) {
    console.log('外部参考源码候选:');
    console.log('请先询问用户这些目录是否只作为外部参考；用户确认后再运行归类命令。');
    for (const candidate of candidates) {
      console.log(`- ${candidate.path}: ${candidate.missingFiles} 个文件、${candidate.missingFolders} 个文件夹缺说明书；原因: ${candidate.reason}；建议确认后运行 ${candidate.suggestedCommand}`);
    }
  }
}

function printDevelopmentStandardsResult(result, json) {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`OpenPrd 后续建议: ${result.ok ? '完成' : '失败'}`);
  const attentionFiles = result.files.filter((file) => ['attention', 'warning', 'error'].includes(file.status));
  if (attentionFiles.length > 0) {
    console.log(`关注程度: 🟡 低风险｜建议留意，🟠 中风险｜建议优先关注，🔴 高风险｜需要先处理。`);
  } else {
    console.log(`本轮已回顾 ${result.files.length} 个改动文件，暂未发现需要额外说明的影响对象。`);
  }
  for (const file of attentionFiles) {
    const lineText = file.lineCount === null || file.lineCount === undefined ? '未知行数' : `${file.lineCount} 行`;
    console.log(`- ${file.statusLabel ?? file.status}: ${file.path} (${lineText})`);
    console.log(`  ${file.nextAction}`);
  }
  if (result.wrapUp?.required && result.wrapUp.markdownTable) {
    console.log(result.wrapUp.markdownBlock ?? result.wrapUp.markdownTable);
  }
  printKnowledgeReview(result.knowledgeReview);
  for (const error of result.errors ?? []) {
    console.log(`- ${error}`);
  }
}

function printQualityResult(result, json) {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (result.action === 'quality-init') {
    console.log(`OpenPrd quality: 已初始化 (${result.changed})`);
    console.log(`配置: ${result.files.config}`);
    console.log(`报告目录: ${result.files.reportsDir}`);
    console.log(`知识库索引: ${result.files.knowledgeIndex}`);
    return;
  }

  if (result.action === 'quality-learn') {
    console.log(`OpenPrd quality learn: ${result.ok ? '已沉淀' : '失败'}`);
    if (result.ok) {
      console.log(`来源类型: ${result.sourceKind}`);
      console.log(`来源: ${result.sourcePath}`);
      if (Array.isArray(result.sourcePaths) && result.sourcePaths.length > 1) {
        console.log(`证据数: ${result.sourcePaths.length}`);
      }
      console.log(`事故: ${result.files.incident}`);
      console.log(`模式: ${result.files.pattern}`);
      console.log(`经验 Skill: ${result.files.skill}`);
      return;
    }
    for (const error of result.errors ?? []) {
      console.log(`- ${error}`);
    }
    return;
  }

  if (result.action === 'quality-knowledge-review') {
    console.log('OpenPrd quality review: 已完成');
    printKnowledgeReview(result);
    return;
  }

  console.log(`OpenPrd quality: ${result.ok ? '完成' : '失败'}`);
  if (result.report) {
    console.log(`质量状态: ${result.report.summary.status}`);
    console.log(`生产就绪: ${result.report.readiness.productionReady ? '是' : '否'}`);
    console.log(`执行模式: ${result.report.readiness.enforcement}`);
    if (result.report.qualityPolicy) {
      console.log(`场景标签: ${result.report.qualityPolicy.scenarioTags.join(', ')}`);
      console.log(`必需门禁: ${result.report.qualityPolicy.requiredGates.join(', ') || '无'}`);
    }
    if (result.report.readiness.attentionGates.length > 0) {
      console.log(`需关注门禁: ${result.report.readiness.attentionGates.join(', ')}`);
    }
    console.log('门禁:');
    for (const gate of result.report.gates) {
      const scope = gate.required ? '必需' : '可选';
      const evidence = gate.evidence?.present ? `证据 ${gate.evidence.sources.length}` : '缺证据';
      console.log(`- ${gate.status}: ${gate.label} (${scope}, ${evidence})`);
    }
  }
  if (result.reportPath) {
    console.log(`JSON: ${result.reportPath}`);
  }
  if (result.htmlPath) {
    console.log(`HTML: ${result.htmlPath}`);
  }
  printKnowledgeReview(result.knowledgeReview);
  for (const error of result.errors ?? []) {
    console.log(`- ${error}`);
  }
}

function printKnowledgeResult(result, json) {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (!result.ok) {
    console.log(`OpenPrd knowledge: 失败 (${result.action ?? 'unknown'})`);
    for (const error of result.errors ?? []) {
      console.log(`- ${error}`);
    }
    return;
  }

  if (result.action === 'knowledge-candidates') {
    const counts = result.counts ?? {};
    console.log(`OpenPrd knowledge candidates: ${result.candidates.length} 个 (${result.status})`);
    console.log(`统计: pending ${counts.pending ?? 0}, promoted ${counts.promoted ?? 0}, rejected ${counts.rejected ?? 0}, archived ${counts.archived ?? 0}, reviewed ${counts.reviewed ?? 0}, total ${counts.total ?? 0}`);
    for (const candidate of result.candidates) {
      console.log(`- ${candidate.candidateId}: ${candidate.title ?? candidate.candidateId}`);
      console.log(`  状态: ${candidate.status}`);
      console.log(`  候选: ${candidate.path ?? candidate.files?.candidate}`);
      if (candidate.draftSkillPath ?? candidate.files?.draftSkill) {
        console.log(`  草案 Skill: ${candidate.draftSkillPath ?? candidate.files?.draftSkill}`);
      }
      if (candidate.pending) {
        console.log(`  拒绝: openprd knowledge reject --id ${candidate.candidateId} --reason <原因>`);
        console.log(`  归档: openprd knowledge archive --id ${candidate.candidateId} --reason <原因>`);
      }
    }
    if (result.candidates.length === 0) {
      console.log('没有匹配的 knowledge candidate。');
    }
    return;
  }

  console.log(`OpenPrd knowledge ${result.action?.replace(/^knowledge-/, '') ?? 'update'}: ${result.candidateId}`);
  if (result.candidate) {
    console.log(`状态: ${result.candidate.status}`);
    if (result.candidate.reviewDecision) {
      console.log(`决定: ${result.candidate.reviewDecision}`);
    }
    if (result.candidate.reviewReason) {
      console.log(`原因: ${result.candidate.reviewReason}`);
    }
  }
  if (result.files?.candidate) {
    console.log(`候选: ${result.files.candidate}`);
  }
  if (result.files?.knowledgeIndex) {
    console.log(`索引: ${result.files.knowledgeIndex}`);
  }
}

function printVisualCompareResult(result, json) {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log('OpenPrd visual compare: 已生成');
  console.log(`输出图片: ${result.outputPath}`);
  console.log(`模式: ${result.mode === 'before-after' ? '修改前后自检' : '效果图对比'}`);
  console.log(`格式: ${result.format}${result.quality ? `, quality=${result.quality}` : ''}`);
  console.log(`画布: ${result.canvas.width}x${result.canvas.height}`);
  console.log(`左侧: ${result.labels.reference} (${result.reference.rendered.width}x${result.reference.rendered.height})`);
  console.log(`右侧: ${result.labels.actual} (${result.actual.rendered.width}x${result.actual.rendered.height})`);
  for (const action of result.nextActions ?? []) {
    console.log(`- 下一步: ${action}`);
  }
}

export {
  printStandardsResult,
  printDevelopmentStandardsResult,
  printQualityResult,
  printKnowledgeResult,
  printVisualCompareResult,
};
