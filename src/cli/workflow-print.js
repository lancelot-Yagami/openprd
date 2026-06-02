/*
 * 核心功能
 * 渲染 PRD 工作流中 synthesize、review、history、diff、next、freeze、diagram、handoff 等阶段输出。
 *
 * 输入
 * 接收版本快照、评审状态、流程建议和图表 artifact 等结构化结果对象。
 *
 * 输出
 * 向终端输出工作流摘要或 JSON，帮助用户理解当前阶段和下一步动作。
 *
 * 定位
 * 位于 CLI 表现层的工作流输出模块，负责版本化 PRD 生命周期的呈现。
 *
 * 依赖
 * 仅依赖终端输出和工作流 result 契约，不承担写入或规则计算。
 *
 * 维护规则
 * 变更评审或交接相关字段时，必须同步维护普通输出与 JSON 输出的一致性。
 */
function printSynthesizeResult(result, json) {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`已合成 PRD 版本 ${result.snapshot.versionId}`);
  console.log(`标题: ${result.snapshot.title}`);
  console.log(`产品类型: ${result.snapshot.productType ?? '未分类'}`);
  console.log(`摘要指纹: ${result.snapshot.digest}`);
  if (result.workUnitId) {
    console.log(`工作单元: ${result.workUnitId}`);
  }
  if (!result.reviewPresentationRequired && (result.reviewPath ?? result.stableReviewArtifact)) {
    console.log(`评审面板: ${result.reviewPath ?? result.stableReviewArtifact}`);
  }
  if (!result.reviewPresentationRequired && (result.reviewEntryPath ?? result.reviewArtifact)) {
    console.log(`固定入口: ${result.reviewEntryPath ?? result.reviewArtifact}`);
  }
  console.log(`已打开评审面板: ${result.opened ? '是' : '否'}`);
  if (result.reviewPresentationRequired) {
    console.log('评审面板: 尚未生成可确认页面');
    console.log('下一步: 先运行 openprd review-presentation . --template，填写 presentation JSON 后运行 openprd review-presentation . --presentation <json> --write --fail-on-violation。');
    const feedback = result.reviewPresentationGate?.violations ?? [];
    for (const item of feedback.slice(0, 6)) {
      const pathHint = item.jsonPath ? `${item.jsonPath}: ` : '';
      console.log(`- ${pathHint}${item.action}`);
    }
  } else if (result.reviewPath ?? result.stableReviewArtifact) {
    console.log('请让用户先评审版本绑定的评审面板；用户确认后，使用页面复制出的带 version/digest/work-unit 的命令记录确认。');
  }
}

function printReviewResult(result, json) {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (!result.ok) {
    console.log('PRD 评审状态不可用');
    for (const error of result.errors ?? []) {
      console.log(`- ${error}`);
    }
    if (result.requiredCommand) {
      console.log(`下一步: ${result.requiredCommand}`);
    }
    for (const item of (result.presentationFeedback ?? []).slice(0, 6)) {
      const pathHint = item.jsonPath ? `${item.jsonPath}: ` : '';
      console.log(`- ${pathHint}${item.action}`);
    }
    return;
  }

  console.log(`PRD 评审状态: ${result.status}`);
  console.log(`版本: ${result.versionId}`);
  if (result.workUnitId) {
    console.log(`工作单元: ${result.workUnitId}`);
  }
  console.log(`HTML 评审面板: ${result.reviewPath ?? result.stableReviewArtifact ?? result.reviewArtifact}`);
  if (result.marked) {
    console.log(`已从 ${result.previousStatus} 更新为 ${result.status}`);
  }
  if (result.opened) {
    console.log('已打开评审面板');
  }
}

function printHistoryResult(result, json) {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`版本历史: ${result.ws.workspaceRoot}`);
  for (const entry of result.versions) {
    console.log(`- ${entry.versionId} | ${entry.title} | ${entry.productType ?? '未分类'} | ${entry.createdAt}`);
  }
}

function printDiffResult(result, json) {
  if (json) {
    console.log(JSON.stringify(result.diff, null, 2));
    return;
  }

  console.log(`差异 ${result.diff.fromVersionId} -> ${result.diff.toVersionId}`);
  console.log(`变更章节: ${result.diff.changedSections.length > 0 ? result.diff.changedSections.join(', ') : '无'}`);
  for (const change of result.diff.changes) {
    console.log(`- ${change.path}: ${JSON.stringify(change.before)} -> ${JSON.stringify(change.after)}`);
  }
}

function printNextResult(result, json) {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const { recommendation, analysis, workflow, taskGraph } = result;
  console.log(`下一步动作: ${recommendation.nextAction}`);
  if (recommendation.currentGate) {
    console.log(`当前门禁: ${recommendation.currentGate}`);
  }
  if (recommendation.upcomingGate) {
    console.log(`后续门禁: ${recommendation.upcomingGate}`);
  }
  console.log(`原因: ${recommendation.reason}`);
  console.log(`建议命令: ${recommendation.suggestedCommand}`);
  console.log(`完成度: ${analysis.completedRequiredFields}/${analysis.totalRequiredFields}`);
  if (taskGraph?.nextReadyNode) {
    console.log(`下一个就绪节点: ${taskGraph.nextReadyNode}`);
  }
  if (result.diagramState?.needed) {
    console.log(`图表门禁: ${result.diagramState.shouldGateFreeze ? '激活' : '已满足'}`);
    console.log(`建议图表: ${result.diagramState.preferredType}`);
  }
  console.log('工作流:');
  console.log(`  ${workflow.join(' -> ')}`);
  if (recommendation.suggestedQuestions.length > 0) {
    console.log('建议问题:');
    for (const question of recommendation.suggestedQuestions) {
      console.log(`- ${question}`);
    }
  }
}

function printFreezeResult(result, json) {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`已 freeze OpenPrd 工作区: ${result.ws.workspaceRoot}`);
  console.log(`版本: ${result.snapshot.latestVersionId}`);
  console.log(`Digest: ${result.snapshot.digest}`);
  console.log(`状态文件: ${result.ws.paths.freezeState}`);
}

function printDiagramResult(result, json) {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (result.snapshot) {
    console.log(`已为 ${result.snapshot.title} 生成${result.type === 'product-flow' ? '产品流程' : '架构'}图`);
  } else {
    console.log(`已更新${result.type === 'product-flow' ? '产品流程' : '架构'}图`);
  }
  console.log(`HTML: ${result.htmlPath}`);
  console.log(`JSON: ${result.jsonPath}`);
  console.log(`Mermaid: ${result.mermaidPath}`);
  if (result.inputPath) {
    console.log(`输入 contract: ${result.inputPath}`);
  }
  if (result.marked) {
    console.log(`评审状态: ${result.marked}`);
  } else if (result.model?.metadata?.reviewStatus) {
    console.log(`评审状态: ${result.model.metadata.reviewStatus}`);
  }
  console.log(`已打开: ${result.opened ? '是' : '否'}`);
}

function printHandoffResult(result, json) {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`交接包已写入: ${result.exportDir}`);
  console.log(`目标: ${result.handoff.target}`);
  console.log(`版本: ${result.handoff.versionId}`);
  if (result.handoff.projectVersion) {
    console.log(`项目版本: ${result.handoff.projectVersion}`);
  }
  console.log(`Digest: ${result.handoff.digest}`);
}

export {
  printSynthesizeResult,
  printReviewResult,
  printHistoryResult,
  printDiffResult,
  printNextResult,
  printFreezeResult,
  printDiagramResult,
  printHandoffResult,
};
