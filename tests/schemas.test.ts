import { describe, it, expect } from 'vitest';
import {
  GeneratedFileSchema,
  ParsedOutputSchema,
  AcceptanceCriterionSchema,
  SubProjectTemplateSchema,
  IncubationResponseSchema,
  TaskReviewSchema,
  ProjectHealthSchema,
  IntentSchema,
} from '../src/core/schemas.js';

describe('schemas', () => {
  describe('GeneratedFileSchema', () => {
    it('accepts valid file object', () => {
      const result = GeneratedFileSchema.safeParse({ path: 'test.js', content: 'console.log(1)' });
      expect(result.success).toBe(true);
    });

    it('rejects empty path', () => {
      const result = GeneratedFileSchema.safeParse({ path: '', content: 'code' });
      expect(result.success).toBe(false);
    });

    it('accepts empty content', () => {
      const result = GeneratedFileSchema.safeParse({ path: 'empty.txt', content: '' });
      expect(result.success).toBe(true);
    });
  });

  describe('ParsedOutputSchema', () => {
    it('accepts valid output with files', () => {
      const result = ParsedOutputSchema.safeParse({
        files: [{ path: 'a.js', content: '1' }, { path: 'b.js', content: '2' }],
        notes: 'test',
      });
      expect(result.success).toBe(true);
    });

    it('accepts output without notes', () => {
      const result = ParsedOutputSchema.safeParse({ files: [{ path: 'a.js', content: '1' }] });
      expect(result.success).toBe(true);
    });

    it('rejects missing files array', () => {
      const result = ParsedOutputSchema.safeParse({ notes: 'test' });
      expect(result.success).toBe(false);
    });
  });

  describe('AcceptanceCriterionSchema', () => {
    it('accepts valid criterion', () => {
      const result = AcceptanceCriterionSchema.safeParse({
        description: 'Game loads',
        type: 'functional',
        action: 'open',
        target: 'index.html',
        expected: 'Page renders',
        critical: true,
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid type', () => {
      const result = AcceptanceCriterionSchema.safeParse({
        description: 'Test',
        type: 'invalid-type',
        action: 'open',
        expected: 'OK',
        critical: false,
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid action', () => {
      const result = AcceptanceCriterionSchema.safeParse({
        description: 'Test',
        type: 'functional',
        action: 'invalid-action',
        expected: 'OK',
        critical: false,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('SubProjectTemplateSchema', () => {
    it('accepts valid sub-project', () => {
      const result = SubProjectTemplateSchema.safeParse({
        id: 'core-game',
        name: 'Core Game',
        description: 'Main game logic',
        type: 'development',
        dependencies: ['setup'],
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid ID format', () => {
      const result = SubProjectTemplateSchema.safeParse({
        id: 'Invalid ID With Spaces',
        name: 'Test',
        description: 'Test',
        type: 'dev',
        dependencies: [],
      });
      expect(result.success).toBe(false);
    });

    it('accepts optional fields', () => {
      const result = SubProjectTemplateSchema.safeParse({
        id: 'sp-1',
        name: 'Test',
        description: 'Test',
        type: 'dev',
        dependencies: [],
        monetizationRelevance: 'core',
        riskLevel: 'high',
        criticalPath: true,
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid monetizationRelevance', () => {
      const result = SubProjectTemplateSchema.safeParse({
        id: 'sp-1',
        name: 'Test',
        description: 'Test',
        type: 'dev',
        dependencies: [],
        monetizationRelevance: 'invalid',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('IncubationResponseSchema', () => {
    it('accepts valid incubation response', () => {
      const result = IncubationResponseSchema.safeParse({
        subProjects: [{
          id: 'sp-1',
          name: 'Setup',
          description: 'Initialize',
          type: 'setup',
          dependencies: [],
        }],
        riskAssessment: {
          technicalRisks: ['API instability'],
          marketRisks: ['Competition'],
          timeRisks: ['Delays'],
          mitigation: 'Have backup plan',
        },
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty subProjects', () => {
      const result = IncubationResponseSchema.safeParse({ subProjects: [] });
      expect(result.success).toBe(false);
    });

    it('rejects more than 10 sub-projects', () => {
      const subProjects = Array.from({ length: 11 }, (_, i) => ({
        id: `sp-${i}`,
        name: `SP ${i}`,
        description: 'Test',
        type: 'dev',
        dependencies: [],
      }));
      const result = IncubationResponseSchema.safeParse({ subProjects });
      expect(result.success).toBe(false);
    });
  });

  describe('TaskReviewSchema', () => {
    it('accepts valid review', () => {
      const result = TaskReviewSchema.safeParse({
        verdict: 'PASS',
        score: 9,
        completeness: 'complete',
        meetsRequirements: true,
        issues: [],
        fixInstructions: '',
      });
      expect(result.success).toBe(true);
    });

    it('rejects score below 1', () => {
      const result = TaskReviewSchema.safeParse({
        verdict: 'FAIL',
        score: 0,
        completeness: 'missing',
        meetsRequirements: false,
        issues: ['Bad'],
        fixInstructions: 'Fix it',
      });
      expect(result.success).toBe(false);
    });

    it('rejects score above 10', () => {
      const result = TaskReviewSchema.safeParse({
        verdict: 'PASS',
        score: 11,
        completeness: 'complete',
        meetsRequirements: true,
        issues: [],
        fixInstructions: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('ProjectHealthSchema', () => {
    it('accepts valid health result', () => {
      const result = ProjectHealthSchema.safeParse({
        healthy: true,
        progress: 'on-track',
        concerns: [],
        recommendations: ['Keep going'],
        scopeAdjustment: 'None needed',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid progress value', () => {
      const result = ProjectHealthSchema.safeParse({
        healthy: true,
        progress: 'stuck',
        concerns: [],
        recommendations: [],
        scopeAdjustment: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('IntentSchema', () => {
    it('accepts valid intent', () => {
      const result = IntentSchema.safeParse({ intent: 'CREATE', confidence: 0.95 });
      expect(result.success).toBe(true);
    });

    it('accepts intent without confidence', () => {
      const result = IntentSchema.safeParse({ intent: 'UPGRADE' });
      expect(result.success).toBe(true);
    });

    it('rejects invalid intent', () => {
      const result = IntentSchema.safeParse({ intent: 'UNKNOWN' });
      expect(result.success).toBe(false);
    });

    it('rejects confidence above 1', () => {
      const result = IntentSchema.safeParse({ intent: 'CREATE', confidence: 1.5 });
      expect(result.success).toBe(false);
    });
  });
});
