import { describe, it, expect } from 'vitest';
import { Command } from 'commander';
import { setupPromoteCommand } from '../src/cli/commands/promote.js';

describe('promote CLI', () => {
  it('should register the promote command', () => {
    const program = new Command();
    setupPromoteCommand(program);
    const commands = program.commands.map((c) => c.name());
    expect(commands).toContain('promote');
  });

  it('should accept project-id argument', () => {
    const program = new Command();
    setupPromoteCommand(program);
    const cmd = program.commands.find((c) => c.name() === 'promote');
    expect(cmd).toBeDefined();
    const args = cmd!.registeredArguments.map((a) => a.name());
    expect(args).toContain('project-id');
  });

  it('should have --channel option', () => {
    const program = new Command();
    setupPromoteCommand(program);
    const cmd = program.commands.find((c) => c.name() === 'promote')!;
    const options = cmd.options.map((o) => o.long);
    expect(options).toContain('--channel');
  });

  it('should have --schedule option', () => {
    const program = new Command();
    setupPromoteCommand(program);
    const cmd = program.commands.find((c) => c.name() === 'promote')!;
    const options = cmd.options.map((o) => o.long);
    expect(options).toContain('--schedule');
  });

  it('should have --output option', () => {
    const program = new Command();
    setupPromoteCommand(program);
    const cmd = program.commands.find((c) => c.name() === 'promote')!;
    const options = cmd.options.map((o) => o.long);
    expect(options).toContain('--output');
  });

  it('should parse --channel option', () => {
    const program = new Command();
    setupPromoteCommand(program);
    const cmd = program.commands.find((c) => c.name() === 'promote')!;
    cmd.parseOptions(['test-id', '--channel', 'twitter']);
    const opts = cmd.opts();
    expect(opts.channel).toBe('twitter');
  });

  it('should parse --schedule flag', () => {
    const program = new Command();
    setupPromoteCommand(program);
    const cmd = program.commands.find((c) => c.name() === 'promote')!;
    cmd.parseOptions(['test-id', '--schedule']);
    const opts = cmd.opts();
    expect(opts.schedule).toBe(true);
  });

  it('should parse --output option', () => {
    const program = new Command();
    setupPromoteCommand(program);
    const cmd = program.commands.find((c) => c.name() === 'promote')!;
    cmd.parseOptions(['test-id', '--output', '/tmp/marketing']);
    const opts = cmd.opts();
    expect(opts.output).toBe('/tmp/marketing');
  });

  it('should default options correctly', () => {
    const program = new Command();
    setupPromoteCommand(program);
    const cmd = program.commands.find((c) => c.name() === 'promote')!;
    const opts = cmd.opts();
    expect(opts.channel).toBeUndefined();
    expect(opts.schedule).toBe(false);
    expect(opts.output).toBeUndefined();
  });

  it('should parse combined options', () => {
    const program = new Command();
    setupPromoteCommand(program);
    const cmd = program.commands.find((c) => c.name() === 'promote')!;
    cmd.parseOptions(['test-id', '--channel', 'twitter', '--schedule', '--output', '/tmp/out']);
    const opts = cmd.opts();
    expect(opts.channel).toBe('twitter');
    expect(opts.schedule).toBe(true);
    expect(opts.output).toBe('/tmp/out');
  });

  it('should have a description', () => {
    const program = new Command();
    setupPromoteCommand(program);
    const cmd = program.commands.find((c) => c.name() === 'promote')!;
    expect(cmd.description()).toBeTruthy();
  });

  it('should accept different channel values', () => {
    const program = new Command();
    setupPromoteCommand(program);
    const cmd = program.commands.find((c) => c.name() === 'promote')!;
    cmd.parseOptions(['test-id', '--channel', 'reddit']);
    const opts = cmd.opts();
    expect(opts.channel).toBe('reddit');
  });
});
