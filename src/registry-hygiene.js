import os from 'node:os';
import path from 'node:path';

function pathWithin(parentPath, childPath) {
  const relativePath = path.relative(parentPath, childPath);
  return relativePath !== '' && !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
}

function analyzeWorkspaceRegistryHygiene(entries = [], options = {}) {
  const homeDir = path.resolve(options.homeDir ?? os.homedir());
  const issues = [];
  const normalized = entries
    .filter((entry) => entry?.workspaceRoot)
    .map((entry) => ({
      workspaceRoot: path.resolve(entry.workspaceRoot),
      realpath: path.resolve(entry.realpath ?? entry.workspaceRoot),
    }))
    .sort((left, right) => left.workspaceRoot.localeCompare(right.workspaceRoot));

  for (const entry of normalized) {
    if (entry.workspaceRoot === homeDir || entry.realpath === homeDir) {
      issues.push({
        kind: 'overbroad-root',
        severity: 'warning',
        workspaceRoot: entry.workspaceRoot,
        message: `Workspace root ${entry.workspaceRoot} 过宽，容易把多个不相关项目混进同一 registry 视野。`,
      });
    }
  }

  for (let index = 0; index < normalized.length; index += 1) {
    for (let nextIndex = index + 1; nextIndex < normalized.length; nextIndex += 1) {
      const current = normalized[index];
      const next = normalized[nextIndex];
      if (!pathWithin(current.realpath, next.realpath) && !pathWithin(current.workspaceRoot, next.workspaceRoot)) {
        continue;
      }
      issues.push({
        kind: 'ambiguous-nesting',
        severity: 'warning',
        workspaceRoot: current.workspaceRoot,
        relatedWorkspaceRoot: next.workspaceRoot,
        message: `Workspace root ${current.workspaceRoot} 与 ${next.workspaceRoot} 存在父子嵌套，恢复会话时需要额外消歧。`,
      });
    }
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}

export { analyzeWorkspaceRegistryHygiene };
