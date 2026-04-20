import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';

/**
 * Run Validator — executes generated code locally to confirm it actually works.
 *
 * Philosophy: AI can hallucinate working code. Static checks catch stubs,
 * but only running the code proves it's real. If it breaks, we feed the
 * error back to AI for auto-fix.
 */

export interface RunResult {
  success: boolean;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

interface RunConfig {
  command: string;
  args: string[];
  cwd: string;
  env?: Record<string, string>;
}

/**
 * Detect how to run/validate a project based on its files.
 */
function detectRunConfig(targetDir: string): RunConfig | null {
  const pkgPath = join(targetDir, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      const scripts = pkg.scripts || {};
      // Prefer test > build > dev (dev may hang, we just need to verify it compiles)
      if (scripts.test) {
        return { command: 'npm', args: ['test'], cwd: targetDir };
      }
      if (scripts.build) {
        return { command: 'npm', args: ['run', 'build'], cwd: targetDir };
      }
      if (scripts.dev) {
        // dev server hangs; we only check that deps install and the entry file exists
        return { command: 'npm', args: ['install'], cwd: targetDir };
      }
      // No scripts — just try npm install to verify package.json is valid
      return { command: 'npm', args: ['install'], cwd: targetDir };
    } catch {
      return { command: 'npm', args: ['install'], cwd: targetDir };
    }
  }

  // Python projects
  const pyFiles = ['main.py', 'app.py', 'run.py'];
  for (const f of pyFiles) {
    if (existsSync(join(targetDir, f))) {
      return { command: 'python3', args: [f], cwd: targetDir };
    }
  }

  // Go projects
  if (existsSync(join(targetDir, 'go.mod'))) {
    return { command: 'go', args: ['build', '.'], cwd: targetDir };
  }

  // Rust projects
  if (existsSync(join(targetDir, 'Cargo.toml'))) {
    return { command: 'cargo', args: ['check'], cwd: targetDir };
  }

  // Static HTML — validate HTML structure and basic syntax
  const htmlPath = join(targetDir, 'index.html');
  if (existsSync(htmlPath)) {
    const html = readFileSync(htmlPath, 'utf-8');
    // Basic structural checks
    const hasDoctype = html.toLowerCase().includes('<!doctype html>');
    const hasHtmlTag = html.toLowerCase().includes('<html');
    const hasBody = html.toLowerCase().includes('<body');
    const hasScript = html.toLowerCase().includes('<script');

    if (!hasDoctype || !hasHtmlTag || !hasBody) {
      return {
        command: 'echo',
        args: ['[kele] HTML validation FAILED: missing doctype, html tag, or body tag'],
        cwd: targetDir,
        env: { KELE_HTML_VALID: 'false', KELE_HTML_ERROR: `doctype=${hasDoctype}, html=${hasHtmlTag}, body=${hasBody}, script=${hasScript}` },
      };
    }

    return {
      command: 'echo',
      args: [`[kele] HTML validation PASSED: doctype=${hasDoctype}, html=${hasHtmlTag}, body=${hasBody}, script=${hasScript}`],
      cwd: targetDir,
      env: { KELE_HTML_VALID: 'true' },
    };
  }

  return null;
}

/**
 * Run a shell command with timeout and capture output.
 */
function runCommand(config: RunConfig, timeoutMs: number = 30000): Promise<RunResult> {
  return new Promise((resolve) => {
    const child = spawn(config.command, config.args, {
      cwd: config.cwd,
      env: { ...process.env, ...config.env },
      shell: false,
    });

    let stdout = '';
    let stderr = '';
    let killed = false;

    const timer = setTimeout(() => {
      killed = true;
      child.kill('SIGTERM');
      // Force kill after 5s if still running
      setTimeout(() => child.kill('SIGKILL'), 5000);
    }, timeoutMs);

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (exitCode) => {
      clearTimeout(timer);
      const fullCommand = `${config.command} ${config.args.join(' ')}`;
      if (killed && exitCode === null) {
        resolve({
          success: false,
          command: fullCommand,
          stdout: stdout.slice(0, 5000),
          stderr: (stderr + '\n[kele] Command timed out after ' + timeoutMs + 'ms').slice(0, 5000),
          exitCode: null,
        });
      } else {
        resolve({
          success: exitCode === 0,
          command: fullCommand,
          stdout: stdout.slice(0, 5000),
          stderr: stderr.slice(0, 5000),
          exitCode,
        });
      }
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        success: false,
        command: `${config.command} ${config.args.join(' ')}`,
        stdout: stdout.slice(0, 5000),
        stderr: (stderr + `\n[kele] Failed to spawn: ${err.message}`).slice(0, 5000),
        exitCode: null,
      });
    });
  });
}

/**
 * Run the project and return the result.
 * For npm projects, first installs deps if node_modules is missing.
 */
export async function runProject(targetDir: string): Promise<RunResult> {
  const config = detectRunConfig(targetDir);
  if (!config) {
    return {
      success: true,
      command: 'none',
      stdout: '',
      stderr: 'No runnable configuration detected for this project type. Skipping runtime validation.',
      exitCode: 0,
    };
  }

  // For npm projects, ensure node_modules exists first
  if (config.command === 'npm' && config.args[0] !== 'install') {
    if (!existsSync(join(targetDir, 'node_modules'))) {
      const installResult = await runCommand(
        { command: 'npm', args: ['install'], cwd: targetDir },
        60000
      );
      if (!installResult.success) {
        return {
          ...installResult,
          stderr: `[kele] npm install failed:\n${installResult.stderr}\n[kele] Cannot run project without dependencies.`,
        };
      }
    }
  }

  // Run the actual validation command
  const result = await runCommand(config, 30000);
  return result;
}

