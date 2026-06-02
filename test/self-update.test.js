import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createSelfUpdateWorkspace } from '../src/self-update.js';

// 核心功能: 验证 OpenPrd CLI 自更新与 upgrade 编排，不触发真实安装。
// 输入: 注入的 package 信息、子进程 runner、PATH 解析结果和临时项目路径。
// 输出: 对 self-update / upgrade 阶段结果、命令参数和失败短路行为的断言。
// 定位: 覆盖 src/self-update.js 的纯 orchestration 逻辑。
// 依赖: node:test、临时目录和 createSelfUpdateWorkspace 的依赖注入接口。
// 维护规则: 不允许执行真实 npm install -g；新增场景必须继续用假 runner。

function fakePackageInfo() {
  return {
    name: '@openprd/cli',
    version: '0.1.0',
    packageRoot: '/tmp/openprd-package',
    packageJsonPath: '/tmp/openprd-package/package.json',
  };
}

function createWorkspaceWithCalls(options = {}) {
  const calls = [];
  const workspace = createSelfUpdateWorkspace({
    readPackageInfo: async () => fakePackageInfo(),
    isLocalSourceCheckout: async () => Boolean(options.localCheckout),
    resolveOpenPrdExecutable: async () => ({ ok: true, executable: '/tmp/bin/openprd', error: null }),
    runCommand: async (command, args) => {
      calls.push({ command, args });
      const ok = options.failInstall ? calls.length > 1 : !options.failAll;
      return {
        ok,
        command,
        args,
        exitCode: ok ? 0 : 1,
        stdout: '',
        stderr: ok ? '' : 'install failed',
      };
    },
  });
  return { calls, workspace };
}

async function makeTempProject() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'openprd-self-update-test-'));
  const project = path.join(dir, 'project');
  await fs.mkdir(project, { recursive: true });
  return project;
}

test('self-update dry-run plans the public npm install without running it', async () => {
  const { calls, workspace } = createWorkspaceWithCalls();

  const result = await workspace.selfUpdateWorkspace({ dryRun: true });

  assert.equal(result.ok, true);
  assert.equal(result.skipped, true);
  assert.equal(result.skipReason, 'dry-run');
  assert.equal(result.installCommand.command, 'npm');
  assert.deepEqual(result.installCommand.args, ['install', '-g', '@openprd/cli@latest']);
  assert.equal(calls.length, 0);
});

test('upgrade runs self-update before refreshing a single project with the resolved CLI', async () => {
  const project = await makeTempProject();
  const { calls, workspace } = createWorkspaceWithCalls();

  const result = await workspace.upgradeWorkspace(project, {
    tools: 'codex',
    hookProfile: 'guarded',
    force: true,
    json: true,
  });

  assert.equal(result.ok, true);
  assert.deepEqual(calls, [
    { command: 'npm', args: ['install', '-g', '@openprd/cli@latest'] },
    { command: '/tmp/bin/openprd', args: ['update', project, '--tools', 'codex', '--hook-profile', 'guarded', '--force', '--json'] },
  ]);
  assert.deepEqual(result.stages, { selfUpdateOk: true, projectRefreshOk: true });
});

test('upgrade fleet mode refreshes historical OpenPrd projects through fleet update', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'openprd-upgrade-fleet-test-'));
  const { calls, workspace } = createWorkspaceWithCalls();

  const result = await workspace.upgradeWorkspace(root, {
    fleet: true,
    tools: 'all',
    maxDepth: 2,
    include: 'client-*',
    exclude: 'archive',
    report: 'fleet-report.json',
  });

  assert.equal(result.ok, true);
  assert.deepEqual(calls[1], {
    command: '/tmp/bin/openprd',
    args: ['fleet', root, '--update-openprd', '--max-depth', '2', '--include', 'client-*', '--exclude', 'archive', '--report', 'fleet-report.json', '--tools', 'all'],
  });
});

test('upgrade does not refresh projects when self-update fails', async () => {
  const project = await makeTempProject();
  const { calls, workspace } = createWorkspaceWithCalls({ failAll: true });

  const result = await workspace.upgradeWorkspace(project);

  assert.equal(result.ok, false);
  assert.deepEqual(result.stages, { selfUpdateOk: false, projectRefreshOk: false });
  assert.equal(result.projectRefresh.skipped, true);
  assert.equal(calls.length, 1);
});
