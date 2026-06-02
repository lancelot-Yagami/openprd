/*
 * 核心功能
 * 渲染 discovery、change、spec、task 和 accepted specs 等 OpenPrd 变更编排输出。
 *
 * 输入
 * 接收 discovery 运行、change 校验/生成、任务推进和 change lifecycle 的结构化结果对象。
 *
 * 输出
 * 向终端输出变更状态、验证结果、任务进度和已接受 specs 摘要，或在 `--json` 模式下直出 JSON。
 *
 * 定位
 * 位于 CLI 表现层的 change 输出模块，负责 OpenSpec/OpenPrd 变更生命周期的终端呈现。
 *
 * 依赖
 * 仅依赖终端输出和 change/task result 字段契约。
 *
 * 维护规则
 * change/task 输出要优先保留 changeId、验证结果和下一任务信息，避免把执行线索散落在多个模块里。
 */
function printOpenSpecDiscoveryResult(result, json) {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`OpenPrd discovery 运行: ${result.runId}`);
  if (result.advanced) {
    console.log(`已推进条目: ${result.advancedItem.id}`);
    console.log(`条目状态: ${result.advancedItem.status}`);
    if (result.claim) {
      console.log(`Claim: ${result.claim.id}`);
    }
  }
  if (result.verified) {
    console.log(`验证: ${result.verification.valid ? '通过' : '失败'}`);
    console.log(`完成: ${result.verification.complete ? '是' : '否'}`);
    for (const check of result.verification.checks) {
      console.log(`- ${check}`);
    }
    if (result.verification.errors.length > 0) {
      console.log('错误:');
      for (const error of result.verification.errors) {
        console.log(`- ${error}`);
      }
    }
    if (result.verification.warnings.length > 0) {
      console.log('警告:');
      for (const warning of result.verification.warnings) {
        console.log(`- ${warning}`);
      }
    }
  }
  console.log(`是否恢复: ${result.resumed ? '是' : '否'}`);
  console.log(`运行目录: ${result.runDir}`);
  console.log(`模式: ${result.control.mode}`);
  console.log(`状态: ${result.control.status}`);
  console.log(`已索引来源文件: ${result.inventory.summary.files}`);
  console.log(`覆盖待处理: ${result.coverageMatrix.summary.pending}/${result.coverageMatrix.summary.total}`);
  console.log(`下一步动作: ${result.control.nextAction}`);
}

function printOpenSpecChangeValidationResult(result, json) {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`OpenPrd change 验证: ${result.valid ? '通过' : '失败'}`);
  console.log(`Change: ${result.changeId}`);
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
}

function printOpenSpecGenerateResult(result, json) {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`已生成 OpenPrd change: ${result.changeId}`);
  console.log(`Capability: ${result.capability}`);
  console.log(`任务数: ${result.taskCount}`);
  console.log(`验证: ${result.validation.valid ? '通过' : '失败'}`);
  console.log('文件:');
  for (const file of result.files) {
    console.log(`- ${file}`);
  }
  if (result.validation.errors.length > 0) {
    console.log('错误:');
    for (const error of result.validation.errors) {
      console.log(`- ${error}`);
    }
  }
}

function printOpenSpecTaskResult(result, json) {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`OpenPrd 任务: ${result.changeId}`);
  if (result.action === 'list') {
    console.log(`进度: ${result.summary.completed}/${result.summary.total} 已完成，${result.summary.pending} 待处理，${result.summary.blocked} 阻塞`);
    if (result.summary.implementation) {
      console.log(`实质实现任务: ${result.summary.implementation.completed}/${result.summary.implementation.total} 已完成，${result.summary.implementation.pending} 待处理`);
    }
    if (result.nextTask) {
      console.log(`下一任务: ${result.nextTask.id} ${result.nextTask.title}`);
      console.log(`验证命令: ${result.nextTask.metadata.verify}`);
    } else {
      console.log('下一任务: 无');
    }
    if (result.blockedTasks.length > 0) {
      console.log('阻塞任务:');
      for (const task of result.blockedTasks.slice(0, 10)) {
        console.log(`- ${task.id}: ${[...task.missing, ...task.incomplete].join(', ')}`);
      }
    }
    return;
  }

  console.log(`任务: ${result.task.id} ${result.task.title}`);
  if (result.verification) {
    console.log(`验证: ${result.verification.ok ? '通过' : '失败'} (${result.verification.command})`);
    if (!result.verification.ok && result.verification.stderr) {
      console.log(result.verification.stderr.trim());
    }
  }
  if (result.action === 'advance') {
    console.log(`已推进: ${result.advanced ? '是' : '否'}`);
    if (result.summary) {
      console.log(`进度: ${result.summary.completed}/${result.summary.total} 已完成`);
    }
    if (result.nextTask) {
      console.log(`下一任务: ${result.nextTask.id} ${result.nextTask.title}`);
    }
  }
}

function printOpenPrdChangesResult(result, json) {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`OpenPrd changes: ${result.changes.length}`);
  console.log(`当前激活 change: ${result.activeChange ?? '无'}`);
  for (const change of result.changes) {
    const marker = change.active ? '*' : '-';
    console.log(`${marker} ${change.id} | ${change.status} | ${change.source} | 任务 ${change.taskTotal - change.taskIncomplete}/${change.taskTotal}`);
  }
}

function printOpenPrdChangeActionResult(result, json) {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`OpenPrd change ${result.action}: ${result.changeId}`);
  if (result.action === 'apply') {
    console.log(`已应用: ${result.ok ? '是' : '否'}`);
    if (result.appliedSpecs?.length > 0) {
      console.log('已接受 specs:');
      for (const spec of result.appliedSpecs) {
        console.log(`- ${spec.capability}: ${spec.specPath}`);
      }
    }
    if (result.errors?.length > 0) {
      console.log('错误:');
      for (const error of result.errors) {
        console.log(`- ${error}`);
      }
    }
  }
  if (result.action === 'archive') {
    console.log(`归档目录: ${result.archiveDir}`);
    console.log(`已移除来源: ${result.removedSource ? '是' : '否'}`);
  }
  if (result.action === 'activate') {
    console.log(`当前激活 change: ${result.changeId}`);
  }
}

function printAcceptedSpecsResult(result, json) {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`已接受 specs: ${result.specs.length}`);
  for (const spec of result.specs) {
    const source = spec.metadata?.sourceChange ? ` 来自 ${spec.metadata.sourceChange}` : '';
    console.log(`- ${spec.capability}${source}: ${spec.specPath}`);
  }
  console.log(`已应用 changes: ${result.appliedChanges.length}`);
}

export {
  printOpenSpecDiscoveryResult,
  printOpenSpecChangeValidationResult,
  printOpenSpecGenerateResult,
  printOpenSpecTaskResult,
  printOpenPrdChangesResult,
  printOpenPrdChangeActionResult,
  printAcceptedSpecsResult,
};
