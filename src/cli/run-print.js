/*
 * 核心功能
 * 渲染 run / loop 相关命令的人类可读输出或 JSON 输出。
 *
 * 输入
 * 接收 run context、run verify、loop prompt/run/finish 和执行确认清单等结构化结果对象。
 *
 * 输出
 * 向终端输出当前执行流、任务状态、Loop 运行信息和知识回顾摘要。
 *
 * 定位
 * 位于 CLI 表现层的执行路径输出模块，专门承接 run/loop 相关的密集终端信息。
 *
 * 依赖
 * 依赖 shared-print 与 doctor-print 提供的复用 helper，不承担实际执行。
 *
 * 维护规则
 * run/loop 输出字段变更时要保持任务态、验证态和确认清单的展示顺序稳定，避免遗漏执行门槛。
 */
import { labelExecutionMode } from '../execution-strategy.js';
import { printCodexRuntimeResult } from './doctor-print.js';
import { printKnowledgeReview } from './shared-print.js';

function printExecutionConfirmationChecklist(checklist) {
  if (!checklist?.required) {
    return;
  }
  console.log(`${checklist.title ?? '执行确认清单'}:`);
  if (checklist.objective) {
    console.log(`- 本轮目标: ${checklist.objective}`);
  }
  if (checklist.scope?.length > 0) {
    console.log(`- 执行范围: ${checklist.scope.join('；')}`);
  }
  if (checklist.implementationItems?.length > 0) {
    console.log(`- 将执行: ${checklist.implementationItems.join('；')}`);
  }
  if (checklist.outOfScope?.length > 0) {
    console.log(`- 不做: ${checklist.outOfScope.join('；')}`);
  }
  if (checklist.verification?.length > 0) {
    console.log(`- 验证: ${checklist.verification.join('；')}`);
  }
  if (checklist.risks?.length > 0) {
    console.log(`- 风险: ${checklist.risks.join('；')}`);
  }
  if (checklist.confirmationPrompt) {
    console.log(`- 确认方式: ${checklist.confirmationPrompt}`);
  }
}

function printRunResult(result, json) {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (result.action === 'run-record-hook') {
    console.log(`OpenPrd run hook 已记录: ${result.event.eventName} -> ${result.event.outcome}`);
    console.log(`迭代记录: ${result.files.iterations}`);
    return;
  }

  if (result.action === 'run-verify') {
    const taskReady = result.readiness?.taskReady !== false;
    const workspaceReady = result.readiness?.workspaceReady !== false;
    const status = taskReady
      ? (workspaceReady ? '通过' : '当前任务通过，工作区待关注')
      : '当前任务失败';
    console.log(`OpenPrd run verify: ${status}`);
    if (result.readiness) {
      console.log(`任务就绪: ${taskReady ? '是' : '否'}`);
      console.log(`工作区就绪: ${workspaceReady ? '是' : '否'}`);
      if (result.readiness.qualityProductionReady !== null) {
        console.log(`质量门禁: ${result.readiness.qualityProductionReady ? 'production-ready' : '待补证据'}`);
      }
    }
    for (const check of result.checks) {
      const scope = check.scope === 'workspace' ? '工作区' : '任务';
      const detail = check.name === 'quality' && check.productionReady === false
        ? ' (production-ready=false)'
        : '';
      console.log(`- ${check.ok ? '通过' : '失败'}: ${check.name} [${scope}]${detail}`);
    }
    printKnowledgeReview(result.knowledgeReview);
    if (result.warnings.length > 0) {
      console.log('工作区待关注:');
      for (const warning of result.warnings) {
        console.log(`- ${warning}`);
      }
    }
    if (result.errors.length > 0) {
      console.log('错误:');
      for (const error of result.errors) {
        console.log(`- ${error}`);
      }
    }
    return;
  }

  console.log('OpenPrd 运行上下文');
  console.log(`项目: ${result.projectRoot}`);
  console.log(`验证: ${result.validation.valid ? '通过' : '失败'}`);
  if (result.lane?.summary) {
    console.log(`执行流: ${result.lane.summary}`);
  }
  if (result.activeChange) {
    const label = result.recommendation?.type === 'requirement-intake' ? '历史激活变更' : '激活变更';
    console.log(`${label}: ${result.activeChange}`);
  }
  if (result.focus?.changeId && result.focus.changeId !== result.activeChange) {
    console.log(`当前目标变更: ${result.focus.changeId}`);
  }
  if (result.activeRequirementGate) {
    console.log(`当前需求入口: ${result.activeRequirementGate.status ?? 'active'}`);
  }
  if (result.taskSummary) {
    console.log(`任务: ${result.taskSummary.completed}/${result.taskSummary.total} 完成，${result.taskSummary.pending} 待处理，${result.taskSummary.blocked} 阻塞`);
    if (result.taskSummary.implementation) {
      console.log(`实质实现任务: ${result.taskSummary.implementation.completed}/${result.taskSummary.implementation.total} 完成，${result.taskSummary.implementation.pending} 待处理`);
    }
  }
  if (result.discovery) {
    console.log(`持续发现: ${result.discovery.runId} 已覆盖 ${result.discovery.summary.covered}/${result.discovery.summary.total}，待处理 ${result.discovery.summary.pending}`);
  }
  console.log(`下一步类型: ${result.recommendation.type}`);
  console.log(`下一步: ${result.recommendation.title}`);
  if (result.recommendation.executionMode) {
    console.log(`执行模式: ${labelExecutionMode(result.recommendation.executionMode)}`);
  }
  if (result.recommendation.parallelPlan?.eligible) {
    console.log(`并行计划: ${result.recommendation.parallelPlan.summary}`);
    console.log(`并行分片: ${result.recommendation.parallelPlan.shardBasis}`);
    console.log(`推荐 Worker 数: ${result.recommendation.parallelPlan.suggestedWorkers}`);
    if (result.recommendation.parallelPlan.groups?.length > 0) {
      console.log(`并行分组: ${result.recommendation.parallelPlan.groups.join(', ')}`);
    }
  }
  console.log(`原因: ${result.recommendation.reason}`);
  console.log(`建议只读命令: ${result.recommendation.command}`);
  if (result.recommendation.preparationCommand || result.recommendation.executionCommand || result.recommendation.commitCommand) {
    console.log('执行门槛: 仅当用户当前明确要求开发、实现、继续任务、深度调研、深度对标、复刻落地或提交时使用；如果还需要执行授权，先展示执行确认清单，规划、梳理、分析、审查类请求保持只读。');
  }
  printExecutionConfirmationChecklist(result.recommendation.executionConfirmationChecklist);
  if (result.recommendation.preparationCommand) {
    console.log(`准备命令: ${result.recommendation.preparationCommand}`);
  }
  if (result.recommendation.executionCommand) {
    console.log(`执行命令: ${result.recommendation.executionCommand}`);
  }
  if (result.recommendation.commitCommand) {
    console.log(`提交命令: ${result.recommendation.commitCommand}`);
  }
  if (result.recommendation.loop?.worktreeRecommended) {
    console.log('工作区建议: 使用独立 worktree 或等价隔离环境承接单任务 Loop。');
  }
  console.log(`验证命令: ${result.recommendation.verifyCommand}`);
  console.log(`状态文件: ${result.files.runState}`);
}

function printLoopResult(result, json) {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (result.action === 'loop-prompt') {
    console.log(`OpenPrd loop 提示词: ${result.ok ? '就绪' : '阻塞'}`);
    if (result.task) {
      console.log(`任务: ${result.task.id} ${result.task.title}`);
      if (result.task.taskHandle) console.log(`任务句柄: ${result.task.taskHandle}`);
    }
    if (result.promptPath) {
      console.log(`提示词: ${result.promptPath}`);
    }
    if (result.invocation?.display) {
      console.log(`执行: ${result.invocation.display}`);
    }
    if (result.errors?.length) {
      for (const error of result.errors) console.log(`- ${error}`);
    }
    return;
  }

  if (result.action === 'loop-run') {
    console.log(`OpenPrd loop 运行: ${result.ok ? '通过' : '失败'}${result.dryRun ? ' (dry-run)' : ''}`);
    if (result.task) console.log(`任务: ${result.task.id} ${result.task.title}`);
    if (result.task?.taskHandle) console.log(`任务句柄: ${result.task.taskHandle}`);
    if (result.promptPath) console.log(`提示词: ${result.promptPath}`);
    if (result.invocation?.display) console.log(`执行: ${result.invocation.display}`);
    if (result.codexRuntime || result.preflight) {
      printCodexRuntimeResult(result.codexRuntime ?? {
        ok: result.preflight.ok,
        preflight: result.preflight,
        repair: result.repair,
        repairAttempted: Boolean(result.repairAttempted),
      });
    }
    if (result.finish?.commit) {
      console.log(`提交: ${result.finish.commit.skipped ? '跳过' : result.finish.commit.sha}`);
    }
    if (result.finish?.projectRelease?.version) {
      console.log(`项目版本: ${result.finish.projectRelease.version}`);
      if (result.finish.projectRelease.tag?.tagName) {
        const localSha = result.finish.projectRelease.tag.localSha ? ` -> ${result.finish.projectRelease.tag.localSha}` : '';
        console.log(`版本 tag: ${result.finish.projectRelease.tag.tagName}${localSha}`);
      }
    }
    if (result.finish?.testReport) {
      console.log(`测试报告: ${result.finish.testReport}`);
    }
    if (result.errors?.length) {
      for (const error of result.errors) console.log(`- ${error}`);
    }
    return;
  }

  if (result.action === 'loop-finish') {
    console.log(`OpenPrd loop finish: ${result.ok ? '通过' : '失败'}`);
    if (result.task) console.log(`任务: ${result.task.id} ${result.task.title}`);
    if (result.task?.taskHandle) console.log(`任务句柄: ${result.task.taskHandle}`);
    if (result.commit) console.log(`提交: ${result.commit.skipped ? '跳过' : result.commit.sha}`);
    if (result.projectRelease?.version) {
      console.log(`项目版本: ${result.projectRelease.version}`);
      if (result.projectRelease.tag?.tagName) {
        const localSha = result.projectRelease.tag.localSha ? ` -> ${result.projectRelease.tag.localSha}` : '';
        console.log(`版本 tag: ${result.projectRelease.tag.tagName}${localSha}`);
      }
    }
    if (result.testReport) console.log(`测试报告: ${result.testReport}`);
    if (result.learningReview) {
      if (result.learningReview.skipped) {
        console.log(`复盘学习包: 已跳过 (${result.learningReview.reason})`);
      } else if (result.learningReview.ok === false) {
        console.log(`复盘学习包: 生成失败 (${result.learningReview.errors?.[0] ?? 'unknown'})`);
      } else {
        console.log(`复盘学习包: ${result.learningReview.packageId}`);
        console.log(`HTML: ${result.learningReview.packagePaths?.readerHtml ?? '无'}`);
        console.log(`题材: ${result.learningReview.genre?.label ?? '未知'}`);
        if (result.learningReview.packageMeta?.styleLabel) console.log(`子风格: ${result.learningReview.packageMeta.styleLabel}`);
        if (result.learningReview.packageMeta?.authoringStatus) console.log(`写作状态: ${result.learningReview.packageMeta.authoringStatus}`);
        if (result.learningReview.packagePaths?.agentPrompt) console.log(`Agent 写作提示: ${result.learningReview.packagePaths.agentPrompt}`);
        console.log(`已打开: ${result.learningReview.opened ? '是' : '否'}`);
      }
    }
    printKnowledgeReview(result.knowledgeReview);
    if (result.next) {
      console.log(`下一任务: ${result.next.id} ${result.next.title}`);
      if (result.next.taskHandle) console.log(`下一任务句柄: ${result.next.taskHandle}`);
    }
    if (result.projectRelease?.warnings?.length) {
      for (const warning of result.projectRelease.warnings) {
        console.log(`- ${warning}`);
      }
    }
    if (result.errors?.length) {
      for (const error of result.errors) console.log(`- ${error}`);
    }
    return;
  }

  console.log(`OpenPrd loop: ${result.action} ${result.ok ? '通过' : '失败'}`);
  if (result.changeId) console.log(`变更: ${result.changeId}`);
  if (result.summary) {
    console.log(`任务: ${result.summary.done}/${result.summary.total} 完成，${result.summary.pending} 待处理，${result.summary.failed} 失败，${result.summary.blocked} 阻塞`);
  }
  if (result.next) {
    console.log(`下一任务: ${result.next.id} ${result.next.title}`);
    if (result.next.taskHandle) console.log(`下一任务句柄: ${result.next.taskHandle}`);
  }
  if (result.files) {
    console.log(`任务清单: ${result.files.featureList}`);
  }
  if (result.errors?.length) {
    for (const error of result.errors) console.log(`- ${error}`);
  }
}

export {
  printExecutionConfirmationChecklist,
  printRunResult,
  printLoopResult,
};
