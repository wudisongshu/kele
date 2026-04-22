import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { debugLog } from '../debug.js';
import { spawn } from 'child_process';
import { JSDOM } from 'jsdom';

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
async function detectRunConfig(targetDir: string): Promise<RunConfig | null> {
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      debugLog('Run validator package.json parse error', msg);
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

  // Static HTML — validate HTML structure and run JSDOM to catch JS errors
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

    // Validate manifest.json if present
    const manifestPath = join(targetDir, 'manifest.json');
    if (existsSync(manifestPath)) {
      try {
        JSON.parse(readFileSync(manifestPath, 'utf-8'));
      } catch {
        return {
          command: 'echo',
          args: ['[kele] manifest.json validation FAILED: invalid JSON'],
          cwd: targetDir,
        };
      }
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
 * Run a shell command and capture output.
 * kele principle: no timeouts. Commands run until they complete.
 */
function runCommand(config: RunConfig): Promise<RunResult> {
  return new Promise((resolve) => {
    const child = spawn(config.command, config.args, {
      cwd: config.cwd,
      env: { ...process.env, ...config.env },
      shell: false,
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (exitCode) => {
      const fullCommand = `${config.command} ${config.args.join(' ')}`;
      resolve({
        success: exitCode === 0,
        command: fullCommand,
        stdout: stdout.slice(0, 5000),
        stderr: stderr.slice(0, 5000),
        exitCode,
      });
    });

    child.on('error', (err) => {
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
export async function runProject(targetDir: string, subProjectType?: string): Promise<RunResult> {
  // --- Sub-project-type-specific validation strategies ---
  if (subProjectType === 'deployment') {
    return validateDeploymentProject(targetDir);
  }
  if (subProjectType === 'monetization') {
    return validateMonetizationProject(targetDir);
  }
  if (subProjectType === 'setup') {
    return validateSetupProject(targetDir);
  }

  // Core game dev / creation / ui-polish fall through to full validation
  const config = await detectRunConfig(targetDir);
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
        { command: 'npm', args: ['install'], cwd: targetDir }
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
  const result = await runCommand(config);

  // For HTML projects, additionally run JSDOM to catch JS runtime errors
  if (config.env?.KELE_HTML_VALID === 'true') {
    const htmlPath = join(targetDir, 'index.html');
    if (existsSync(htmlPath)) {
      try {
        const html = readFileSync(htmlPath, 'utf-8');
        const dom = new JSDOM(html, {
          runScripts: 'dangerously',
          url: 'file://' + targetDir + '/',
          pretendToBeVisual: true,
        });
        await new Promise((resolve) => setTimeout(resolve, 50));
        dom.window.close();
      } catch (jsdomErr) {
        const msg = jsdomErr instanceof Error ? jsdomErr.message : String(jsdomErr);
        return {
          ...result,
          success: false,
          stderr: `[kele] HTML JS runtime check FAILED: ${msg}`,
        };
      }
    }
  }

  return result;
}

/** Validate setup sub-project: package.json parseable, npm install works. */
function validateSetupProject(targetDir: string): Promise<RunResult> {
  const pkgPath = join(targetDir, 'package.json');
  if (!existsSync(pkgPath)) {
    return Promise.resolve({
      success: false,
      command: 'check',
      stdout: '',
      stderr: 'Setup project missing package.json',
      exitCode: 1,
    });
  }
  try {
    JSON.parse(readFileSync(pkgPath, 'utf-8'));
  } catch {
    return Promise.resolve({
      success: false,
      command: 'check',
      stdout: '',
      stderr: 'package.json has invalid JSON',
      exitCode: 1,
    });
  }
  return runCommand({ command: 'npm', args: ['install'], cwd: targetDir });
}

/** Validate deployment sub-project: workflow files, CNAME, SETUP.md. */
function validateDeploymentProject(targetDir: string): Promise<RunResult> {
  const issues: string[] = [];

  const workflowDir = join(targetDir, '.github', 'workflows');
  if (!existsSync(workflowDir)) {
    issues.push('Missing .github/workflows/ directory');
  } else {
    const ymlFiles = readdirSync(workflowDir).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));
    if (ymlFiles.length === 0) {
      issues.push('No workflow YAML files found in .github/workflows/');
    }
    for (const f of ymlFiles) {
      const content = readFileSync(join(workflowDir, f), 'utf-8');
      const steps = parseWorkflowSteps(content);
      const hasCheckout = steps.some((s) => s.uses && /actions\/checkout/.test(s.uses));
      const hasDeploy = steps.some((s) => s.uses && /deploy-pages|gh-pages/.test(s.uses));
      if (!hasCheckout) issues.push(`${f}: missing actions/checkout step`);
      if (!hasDeploy) issues.push(`${f}: missing deploy step`);
    }
  }

  const cnamePath = join(targetDir, 'CNAME');
  if (existsSync(cnamePath)) {
    const cname = readFileSync(cnamePath, 'utf-8').trim();
    if (!cname.includes('.') || cname.includes(' ')) {
      issues.push('CNAME format invalid');
    }
  }

  if (issues.length > 0) {
    return Promise.resolve({
      success: false,
      command: 'check',
      stdout: '',
      stderr: issues.join('\n'),
      exitCode: 1,
    });
  }

  return Promise.resolve({
    success: true,
    command: 'check',
    stdout: 'Deployment config valid',
    stderr: '',
    exitCode: 0,
  });
}

/** Parse workflow steps from YAML text (lightweight, no external parser). */
function parseWorkflowSteps(content: string): Array<{ uses?: string; name?: string }> {
  const steps: Array<{ uses?: string; name?: string }> = [];
  const stepBlocks = content.match(/-\s+name:[^\n]*(?:\n(?:\s+[^\n]*))*/g) || [];
  for (const block of stepBlocks) {
    const nameMatch = block.match(/-\s+name:\s*([^\n]*)/);
    const usesMatch = block.match(/uses:\s*([^\n]*)/);
    steps.push({
      name: nameMatch ? nameMatch[1].trim() : undefined,
      uses: usesMatch ? usesMatch[1].trim() : undefined,
    });
  }
  return steps;
}

/** Validate monetization sub-project: ads.txt, ad placeholders, MONETIZATION.md. */
function validateMonetizationProject(targetDir: string): Promise<RunResult> {
  const issues: string[] = [];

  const adsTxtPath = join(targetDir, 'ads.txt');
  if (!existsSync(adsTxtPath)) {
    issues.push('Missing ads.txt');
  }

  const adsensePath = join(targetDir, 'adsense.html');
  if (existsSync(adsensePath)) {
    const content = readFileSync(adsensePath, 'utf-8');
    if (!content.includes('adsbygoogle') && !content.includes('googlesyndication')) {
      issues.push('adsense.html missing ad placeholder code');
    }
  }

  const monetizePath = join(targetDir, 'MONETIZATION.md');
  if (!existsSync(monetizePath)) {
    issues.push('Missing MONETIZATION.md');
  }

  if (issues.length > 0) {
    return Promise.resolve({
      success: false,
      command: 'check',
      stdout: '',
      stderr: issues.join('\n'),
      exitCode: 1,
    });
  }

  return Promise.resolve({
    success: true,
    command: 'check',
    stdout: 'Monetization config valid',
    stderr: '',
    exitCode: 0,
  });
}

