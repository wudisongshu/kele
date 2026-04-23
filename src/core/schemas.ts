/**
 * Zod schemas for validating AI JSON responses.
 *
 * Using zod ensures runtime type safety and catches malformed AI output
 * before it propagates through the system.
 */

import { z } from 'zod';

// --- File Writer Schemas ---

export const GeneratedFileSchema = z.object({
  path: z.string().min(1, 'File path cannot be empty'),
  content: z.string(),
});

export const ParsedOutputSchema = z.object({
  files: z.array(GeneratedFileSchema),
  notes: z.string().optional(),
});

// --- Incubator Schemas ---

export const AcceptanceCriterionSchema = z.object({
  description: z.string().min(1),
  type: z.enum(['functional', 'visual', 'performance', 'compatibility', 'security']),
  action: z.enum(['open', 'click', 'check-text', 'check-element', 'play-game', 'load-url', 'verify-file']),
  checkType: z.enum(['file_exists', 'content_contains', 'regex_match']).optional(),
  target: z.string().optional(),
  expected: z.string().min(1),
  regexPattern: z.string().optional(),
  critical: z.boolean(),
});

export const SubProjectTemplateSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, 'ID must be kebab-case'),
  name: z.string().min(1),
  description: z.string().min(1),
  type: z.string().min(1),
  dependencies: z.array(z.string()),
  monetizationRelevance: z.enum(['core', 'supporting', 'optional']).optional(),
  estimatedEffort: z.string().optional(),
  criticalPath: z.boolean().optional(),
  riskLevel: z.enum(['low', 'medium', 'high']).optional(),
  acceptanceCriteria: z.array(AcceptanceCriterionSchema).optional(),
});

export const IncubationResponseSchema = z.object({
  subProjects: z.array(SubProjectTemplateSchema).min(1).max(10),
  riskAssessment: z.object({
    technicalRisks: z.array(z.string()),
    marketRisks: z.array(z.string()),
    timeRisks: z.array(z.string()),
    mitigation: z.string(),
  }).optional(),
  monetizationPath: z.string().optional(),
  reasoning: z.string().optional(),
  selfReviewNotes: z.string().optional(),
});

// --- Task Review Schemas ---

export const TaskReviewSchema = z.object({
  verdict: z.enum(['PASS', 'PARTIAL', 'FAIL']),
  score: z.number().int().min(1).max(10),
  completeness: z.enum(['complete', 'partial', 'missing']),
  meetsRequirements: z.boolean(),
  issues: z.array(z.string()),
  fixInstructions: z.string(),
});

// --- Project Health Review Schemas ---

export const ProjectHealthSchema = z.object({
  healthy: z.boolean(),
  progress: z.enum(['on-track', 'behind', 'ahead']),
  concerns: z.array(z.string()),
  recommendations: z.array(z.string()),
  scopeAdjustment: z.string(),
});

// --- Intent Classification Schema ---

export const IntentSchema = z.object({
  intent: z.enum(['CREATE', 'UPGRADE', 'QUERY', 'RUN', 'CONFIG', 'CHAT']),
  confidence: z.number().min(0).max(1).optional(),
});
