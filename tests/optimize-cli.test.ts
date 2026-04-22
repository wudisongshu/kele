import { describe, it, expect } from 'vitest';
import { Command } from 'commander';
import { setupOptimizeCommand } from '../src/cli/commands/optimize.js';

describe('optimize CLI', () => {
  it('should register the optimize command', () => {
    const program = new Command();
    setupOptimizeCommand(program);
    const commands = program.commands.map((c) => c.name());
    expect(commands).toContain('optimize');
  });

  it('should accept project-id argument', () => {
    const program = new Command();
    setupOptimizeCommand(program);
    const optimizeCmd = program.commands.find((c) => c.name() === 'optimize');
    expect(optimizeCmd).toBeDefined();
    const args = optimizeCmd!.registeredArguments.map((a) => a.name());
    expect(args).toContain('project-id');
  });

  it('should have --mock option', () => {
    const program = new Command();
    setupOptimizeCommand(program);
    const optimizeCmd = program.commands.find((c) => c.name() === 'optimize')!;
    const options = optimizeCmd.options.map((o) => o.long);
    expect(options).toContain('--mock');
  });

  it('should have --auto option', () => {
    const program = new Command();
    setupOptimizeCommand(program);
    const optimizeCmd = program.commands.find((c) => c.name() === 'optimize')!;
    const options = optimizeCmd.options.map((o) => o.long);
    expect(options).toContain('--auto');
  });

  it('should have --report option', () => {
    const program = new Command();
    setupOptimizeCommand(program);
    const optimizeCmd = program.commands.find((c) => c.name() === 'optimize')!;
    const options = optimizeCmd.options.map((o) => o.long);
    expect(options).toContain('--report');
  });

  it('should have --dry-run option', () => {
    const program = new Command();
    setupOptimizeCommand(program);
    const optimizeCmd = program.commands.find((c) => c.name() === 'optimize')!;
    const options = optimizeCmd.options.map((o) => o.long);
    expect(options).toContain('--dry-run');
  });

  it('should parse all boolean options as false by default', () => {
    const program = new Command();
    setupOptimizeCommand(program);
    const optimizeCmd = program.commands.find((c) => c.name() === 'optimize')!;
    const opts = optimizeCmd.opts();
    expect(opts.mock).toBe(false);
    expect(opts.auto).toBe(false);
    expect(opts.report).toBe(false);
    expect(opts.dryRun).toBe(false);
  });

  it('should parse --mock flag to true', () => {
    const program = new Command();
    setupOptimizeCommand(program);
    const optimizeCmd = program.commands.find((c) => c.name() === 'optimize')!;
    // Use parseOptions to avoid invoking the action handler
    optimizeCmd.parseOptions(['test-id', '--mock']);
    const opts = optimizeCmd.opts();
    expect(opts.mock).toBe(true);
  });

  it('should parse --auto flag to true', () => {
    const program = new Command();
    setupOptimizeCommand(program);
    const optimizeCmd = program.commands.find((c) => c.name() === 'optimize')!;
    optimizeCmd.parseOptions(['test-id', '--auto']);
    const opts = optimizeCmd.opts();
    expect(opts.auto).toBe(true);
  });

  it('should parse --report flag to true', () => {
    const program = new Command();
    setupOptimizeCommand(program);
    const optimizeCmd = program.commands.find((c) => c.name() === 'optimize')!;
    optimizeCmd.parseOptions(['test-id', '--report']);
    const opts = optimizeCmd.opts();
    expect(opts.report).toBe(true);
  });

  it('should parse --dry-run flag to true', () => {
    const program = new Command();
    setupOptimizeCommand(program);
    const optimizeCmd = program.commands.find((c) => c.name() === 'optimize')!;
    optimizeCmd.parseOptions(['test-id', '--dry-run']);
    const opts = optimizeCmd.opts();
    expect(opts.dryRun).toBe(true);
  });

  it('should parse combined flags', () => {
    const program = new Command();
    setupOptimizeCommand(program);
    const optimizeCmd = program.commands.find((c) => c.name() === 'optimize')!;
    optimizeCmd.parseOptions(['test-id', '--mock', '--auto', '--dry-run']);
    const opts = optimizeCmd.opts();
    expect(opts.mock).toBe(true);
    expect(opts.auto).toBe(true);
    expect(opts.dryRun).toBe(true);
    expect(opts.report).toBe(false);
  });
});
