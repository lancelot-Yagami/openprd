import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const DEFAULT_SELF_UPDATE_SOURCE = '@openprd/cli@latest';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PACKAGE_ROOT = path.resolve(MODULE_DIR, '..');

function shellQuote(value) {
  const text = String(value);
  if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(text)) {
    return text;
  }
  return `'${text.replace(/'/g, `'\\''`)}'`;
}

export function formatCommand(command, args = []) {
  return [command, ...args].map(shellQuote).join(' ');
}

async function readPackageInfo(packageRoot = DEFAULT_PACKAGE_ROOT) {
  const packageJsonPath = path.join(packageRoot, 'package.json');
  const raw = await fs.readFile(packageJsonPath, 'utf8');
  const packageJson = JSON.parse(raw);
  return {
    name: packageJson.name ?? null,
    version: packageJson.version ?? null,
    packageRoot,
    packageJsonPath,
  };
}

async function isLocalSourceCheckout(packageRoot = DEFAULT_PACKAGE_ROOT) {
  const gitDir = path.join(packageRoot, '.git');
  return fs.stat(gitDir).then((stat) => stat.isDirectory() || stat.isFile(), () => false);
}

function runProcess(command, args = [], options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? process.cwd(),
      env: options.env ?? process.env,
      shell: Boolean(options.shell),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout = `${stdout}${chunk}`.slice(-64000);
    });
    child.stderr.on('data', (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-64000);
    });
    child.on('error', (error) => {
      resolve({
        ok: false,
        command,
        args,
        display: formatCommand(command, args),
        exitCode: null,
        stdout,
        stderr: `${stderr}${error.message}`,
      });
    });
    child.on('close', (exitCode) => {
      resolve({
        ok: exitCode === 0,
        command,
        args,
        display: formatCommand(command, args),
        exitCode,
        stdout,
        stderr,
      });
    });
  });
}

async function resolveOpenPrdExecutable(deps = {}) {
  if (typeof deps.resolveOpenPrdExecutable === 'function') {
    return deps.resolveOpenPrdExecutable();
  }
  const command = process.platform === 'win32' ? 'where openprd' : 'command -v openprd';
  const result = await runProcess(command, [], { shell: true });
  const executable = result.stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? null;
  if (!result.ok || !executable) {
    return {
      ok: false,
      executable: null,
      command,
      error: result.stderr.trim() || 'Unable to resolve openprd executable from PATH.',
    };
  }
  return {
    ok: true,
    executable,
    command,
    error: null,
  };
}

function buildSelfUpdatePlan(options = {}) {
  const source = options.source ?? DEFAULT_SELF_UPDATE_SOURCE;
  const command = options.packageManager ?? 'npm';
  const args = ['install', '-g', source];
  return {
    source,
    install: {
      command,
      args,
      display: formatCommand(command, args),
    },
  };
}

function buildProjectRefreshPlan(targetPath, options = {}) {
  const executable = options.executable ?? 'openprd';
  const args = options.fleet
    ? ['fleet', targetPath, '--update-openprd']
    : ['update', targetPath];

  if (options.fleet && options.maxDepth) {
    args.push('--max-depth', String(options.maxDepth));
  }
  if (options.fleet && options.include) {
    args.push('--include', String(options.include));
  }
  if (options.fleet && options.exclude) {
    args.push('--exclude', String(options.exclude));
  }
  if (options.fleet && options.report) {
    args.push('--report');
    if (typeof options.report === 'string') {
      args.push(options.report);
    }
  }
  if (options.tools) {
    args.push('--tools', options.tools);
  }
  if (options.hookProfile) {
    args.push('--hook-profile', options.hookProfile);
  }
  if (options.force && !options.fleet) {
    args.push('--force');
  }
  if (options.childJson) {
    args.push('--json');
  }

  return {
    mode: options.fleet ? 'fleet' : 'project',
    targetPath,
    refresh: {
      command: executable,
      args,
      display: formatCommand(executable, args),
    },
  };
}

export function createSelfUpdateWorkspace(deps = {}) {
  const runCommand = deps.runCommand ?? runProcess;
  const packageRoot = deps.packageRoot ?? DEFAULT_PACKAGE_ROOT;

  async function selfUpdateWorkspace(options = {}) {
    const packageInfo = await (deps.readPackageInfo ?? readPackageInfo)(packageRoot);
    const localCheckout = await (deps.isLocalSourceCheckout ?? isLocalSourceCheckout)(packageRoot);
    const plan = buildSelfUpdatePlan(options);
    const base = {
      ok: true,
      action: 'self-update',
      dryRun: Boolean(options.dryRun),
      source: plan.source,
      package: packageInfo,
      localCheckout,
      installCommand: plan.install,
      result: null,
      resolvedExecutable: null,
      errors: [],
      nextActions: [],
    };

    if (options.dryRun) {
      return {
        ...base,
        skipped: true,
        skipReason: 'dry-run',
        nextActions: ['Run without --dry-run to update the OpenPrd CLI.'],
      };
    }

    if (localCheckout && !options.allowLocalCheckout) {
      return {
        ...base,
        ok: false,
        skipped: true,
        skipReason: 'local-source-checkout',
        errors: [
          'This openprd command is running from a local source checkout. Reinstall the global CLI with npm, or use your local development workflow.',
        ],
        nextActions: [
          `Run ${plan.install.display} from outside the source checkout, or update this checkout manually.`,
        ],
      };
    }

    const installResult = await runCommand(plan.install.command, plan.install.args, {
      cwd: options.cwd ?? packageInfo.packageRoot,
      env: options.env ?? process.env,
    });
    const resolvedExecutable = installResult.ok
      ? await resolveOpenPrdExecutable(deps)
      : null;

    return {
      ...base,
      ok: installResult.ok && (resolvedExecutable?.ok ?? false),
      result: installResult,
      resolvedExecutable,
      errors: [
        ...(installResult.ok ? [] : [installResult.stderr.trim() || `Self-update command failed with exit code ${installResult.exitCode}.`]),
        ...(installResult.ok && !resolvedExecutable?.ok ? [resolvedExecutable?.error ?? 'Unable to resolve updated openprd executable.'] : []),
      ],
      nextActions: installResult.ok && !resolvedExecutable?.ok
        ? ['Check that the global npm bin directory is on PATH, then run openprd update <project>.']
        : [],
    };
  }

  async function upgradeWorkspace(targetPath, options = {}) {
    const resolvedTarget = path.resolve(targetPath ?? process.cwd());
    const selfUpdate = await selfUpdateWorkspace(options);
    const dryRun = Boolean(options.dryRun);
    const executable = selfUpdate.resolvedExecutable?.executable ?? 'openprd';
    const refreshPlan = buildProjectRefreshPlan(resolvedTarget, {
      ...options,
      executable,
      childJson: Boolean(options.json),
    });
    const base = {
      ok: true,
      action: 'upgrade',
      dryRun,
      mode: refreshPlan.mode,
      targetPath: resolvedTarget,
      selfUpdate,
      projectRefresh: {
        ok: true,
        skipped: false,
        command: refreshPlan.refresh,
        result: null,
        errors: [],
      },
      stages: {
        selfUpdateOk: selfUpdate.ok,
        projectRefreshOk: true,
      },
      errors: [],
    };

    if (dryRun) {
      return {
        ...base,
        projectRefresh: {
          ...base.projectRefresh,
          skipped: true,
          skipReason: 'dry-run',
        },
      };
    }

    if (!selfUpdate.ok) {
      return {
        ...base,
        ok: false,
        projectRefresh: {
          ...base.projectRefresh,
          ok: false,
          skipped: true,
          skipReason: 'self-update-failed',
          errors: ['Project refresh was not run because self-update did not complete.'],
        },
        stages: {
          selfUpdateOk: false,
          projectRefreshOk: false,
        },
        errors: selfUpdate.errors,
      };
    }

    const refreshResult = await runCommand(refreshPlan.refresh.command, refreshPlan.refresh.args, {
      cwd: options.cwd ?? resolvedTarget,
      env: options.env ?? process.env,
    });
    const projectRefresh = {
      ok: refreshResult.ok,
      skipped: false,
      command: refreshPlan.refresh,
      result: refreshResult,
      errors: refreshResult.ok ? [] : [refreshResult.stderr.trim() || `Project refresh failed with exit code ${refreshResult.exitCode}.`],
    };

    return {
      ...base,
      ok: selfUpdate.ok && projectRefresh.ok,
      projectRefresh,
      stages: {
        selfUpdateOk: selfUpdate.ok,
        projectRefreshOk: projectRefresh.ok,
      },
      errors: [
        ...selfUpdate.errors,
        ...projectRefresh.errors,
      ],
    };
  }

  return {
    selfUpdateWorkspace,
    upgradeWorkspace,
  };
}

const defaultWorkspace = createSelfUpdateWorkspace();

export const selfUpdateWorkspace = defaultWorkspace.selfUpdateWorkspace;
export const upgradeWorkspace = defaultWorkspace.upgradeWorkspace;
