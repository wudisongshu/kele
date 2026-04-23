import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { checkExemption, validateCriteriaAgainstWhitelist } from '../src/core/incubator-validator.js';
import { loadIncubatorConfig } from '../src/core/incubator-config.js';
import type { AcceptanceCriterion } from '../src/types/index.js';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

function makeCriterion(overrides: Partial<AcceptanceCriterion> = {}): AcceptanceCriterion {
  return {
    description: 'Test criterion',
    type: 'functional',
    action: 'verify-file',
    target: 'index.html',
    expected: 'file exists',
    critical: true,
    ...overrides,
  };
}

describe('checkExemption', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `kele-exemption-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('allows file with // kele-allow marker in first 5 lines', async () => {
    writeFileSync(join(testDir, 'shared.ts'), '// kele-allow: shared config\nexport const x = 1;', 'utf-8');
    const result = await checkExemption('shared.ts', testDir, []);
    expect(result.allowed).toBe(true);
    expect(result.source).toBe('file-marker');
    expect(result.reason).toContain('shared config');
  });

  it('allows file with /* kele-allow: ... */ marker in first 5 lines', async () => {
    writeFileSync(join(testDir, 'config.ts'), '/* kele-allow: shared/config */\nexport const x = 1;', 'utf-8');
    const result = await checkExemption('config.ts', testDir, []);
    expect(result.allowed).toBe(true);
    expect(result.source).toBe('file-marker');
    expect(result.reason).toContain('shared/config');
  });

  it('allows file matching config override glob', async () => {
    writeFileSync(join(testDir, 'main.ts'), 'export const x = 1;', 'utf-8');
    const result = await checkExemption('main.ts', testDir, ['*.ts']);
    expect(result.allowed).toBe(true);
    expect(result.source).toBe('config-override');
    expect(result.reason).toContain('*.ts');
  });

  it('allows file matching ** glob in config overrides', async () => {
    mkdirSync(join(testDir, 'deep'), { recursive: true });
    writeFileSync(join(testDir, 'deep', 'nested.ts'), 'export const x = 1;', 'utf-8');
    const result = await checkExemption('deep/nested.ts', testDir, ['deep/**/*.ts']);
    expect(result.allowed).toBe(true);
    expect(result.source).toBe('config-override');
  });

  it('denies file not in whitelist and no exemption', async () => {
    writeFileSync(join(testDir, 'unauthorized.ts'), 'export const x = 1;', 'utf-8');
    const result = await checkExemption('unauthorized.ts', testDir, []);
    expect(result.allowed).toBe(false);
    expect(result.source).toBe('none');
  });

  it('denies when file does not exist and no config override matches', async () => {
    const result = await checkExemption('missing.ts', testDir, []);
    expect(result.allowed).toBe(false);
    expect(result.source).toBe('none');
  });

  it('denies when marker is beyond first 5 lines', async () => {
    const lines = Array(6).fill('// line').join('\n') + '\n// kele-allow: late\n';
    writeFileSync(join(testDir, 'late.ts'), lines, 'utf-8');
    const result = await checkExemption('late.ts', testDir, []);
    expect(result.allowed).toBe(false);
    expect(result.source).toBe('none');
  });

  it('file-marker takes precedence over config-override', async () => {
    writeFileSync(join(testDir, 'both.ts'), '// kele-allow: marker\nexport const x = 1;', 'utf-8');
    const result = await checkExemption('both.ts', testDir, ['*.ts']);
    expect(result.allowed).toBe(true);
    expect(result.source).toBe('file-marker');
  });
});

describe('validateCriteriaAgainstWhitelist', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `kele-whitelist-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('passes criteria whose target is in the whitelist', async () => {
    const criteria = [makeCriterion({ target: 'index.html' })];
    const result = await validateCriteriaAgainstWhitelist(criteria, 'setup', testDir, []);
    expect(result.valid).toBe(true);
    expect(result.filtered).toHaveLength(1);
    expect(result.violations).toHaveLength(0);
  });

  it('exempts criteria via file marker', async () => {
    writeFileSync(join(testDir, 'game.js'), '// kele-allow: shared game logic\nconsole.log(1);', 'utf-8');
    const criteria = [makeCriterion({ target: 'game.js' })];
    const result = await validateCriteriaAgainstWhitelist(criteria, 'setup', testDir, []);
    expect(result.valid).toBe(true);
    expect(result.filtered).toHaveLength(1);
    expect(result.warnings.some(w => w.includes('EXEMPTION'))).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('exempts criteria via config override', async () => {
    writeFileSync(join(testDir, 'custom.js'), 'console.log(1);', 'utf-8');
    const criteria = [makeCriterion({ target: 'custom.js' })];
    const result = await validateCriteriaAgainstWhitelist(criteria, 'setup', testDir, ['*.js']);
    expect(result.valid).toBe(true);
    expect(result.filtered).toHaveLength(1);
    expect(result.warnings.some(w => w.includes('EXEMPTION'))).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('flags violations for non-whitelist targets without exemption', async () => {
    const criteria = [makeCriterion({ target: 'blocked.js' })];
    const result = await validateCriteriaAgainstWhitelist(criteria, 'setup', testDir, []);
    expect(result.valid).toBe(false);
    expect(result.filtered).toHaveLength(0);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toContain('blocked.js');
  });

  it('allows criteria without a target (e.g. play-game)', async () => {
    const criteria = [makeCriterion({ target: undefined, action: 'play-game' })];
    const result = await validateCriteriaAgainstWhitelist(criteria, 'development', testDir, []);
    expect(result.valid).toBe(true);
    expect(result.filtered).toHaveLength(1);
    expect(result.violations).toHaveLength(0);
  });

  it('handles mixed criteria (whitelist + exempt + violation)', async () => {
    writeFileSync(join(testDir, 'exempt.js'), '// kele-allow: shared\n', 'utf-8');
    const criteria = [
      makeCriterion({ target: 'index.html', description: 'A' }),
      makeCriterion({ target: 'exempt.js', description: 'B' }),
      makeCriterion({ target: 'bad.py', description: 'C' }),
    ];
    const result = await validateCriteriaAgainstWhitelist(criteria, 'setup', testDir, []);
    expect(result.filtered).toHaveLength(2); // A + B
    expect(result.violations).toHaveLength(1); // C
    expect(result.violations[0]).toContain('bad.py');
  });

  it('returns all criteria for unknown subproject type', async () => {
    const criteria = [makeCriterion({ target: 'anything.xyz' })];
    const result = await validateCriteriaAgainstWhitelist(criteria, 'unknown-type', testDir, []);
    expect(result.valid).toBe(true);
    expect(result.filtered).toHaveLength(1);
    expect(result.violations).toHaveLength(0);
  });
});

describe('loadIncubatorConfig', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `kele-config-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('returns defaults when config file does not exist', () => {
    const config = loadIncubatorConfig(testDir);
    expect(config.whitelistOverrides).toEqual([]);
  });

  it('reads valid config file', () => {
    const keleDir = join(testDir, '.kele');
    mkdirSync(keleDir, { recursive: true });
    writeFileSync(join(keleDir, 'incubator-config.json'), JSON.stringify({ whitelistOverrides: ['shared/**/*.ts'] }), 'utf-8');
    const config = loadIncubatorConfig(testDir);
    expect(config.whitelistOverrides).toEqual(['shared/**/*.ts']);
  });

  it('throws readable error on invalid JSON', () => {
    const keleDir = join(testDir, '.kele');
    mkdirSync(keleDir, { recursive: true });
    writeFileSync(join(keleDir, 'incubator-config.json'), 'not-json', 'utf-8');
    expect(() => loadIncubatorConfig(testDir)).toThrow('Failed to load incubator config');
  });

  it('throws readable error when whitelistOverrides is not string array', () => {
    const keleDir = join(testDir, '.kele');
    mkdirSync(keleDir, { recursive: true });
    writeFileSync(join(keleDir, 'incubator-config.json'), JSON.stringify({ whitelistOverrides: [123] }), 'utf-8');
    expect(() => loadIncubatorConfig(testDir)).toThrow('whitelistOverrides must be an array of strings');
  });
});
