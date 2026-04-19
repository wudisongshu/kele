import { randomUUID } from 'crypto';
import type { Idea, SubProject, Task, PlanResult, Complexity } from '../types/index.js';

/**
 * TaskPlanner — breaks a SubProject into executable Tasks.
 *
 * Each task has a clear title, description, and complexity rating
 * that determines which AI provider will execute it.
 */

interface TaskTemplate {
  title: string;
  description: string;
  baseComplexity: Complexity;
}

/**
 * Adjust complexity based on the overall idea complexity.
 * A "simple" idea downgrades tasks; a "complex" idea upgrades them.
 */
function adjustComplexity(base: Complexity, ideaComplexity: Complexity): Complexity {
  const levels: Complexity[] = ['simple', 'medium', 'complex'];
  const baseIndex = levels.indexOf(base);
  const ideaIndex = levels.indexOf(ideaComplexity);

  // Shift by the difference between idea complexity and medium (1)
  const shift = ideaIndex - 1;
  const adjusted = Math.max(0, Math.min(2, baseIndex + shift));
  return levels[adjusted];
}

/**
 * Get task templates for a given sub-project type.
 */
function getTaskTemplates(subProjectType: string): TaskTemplate[] {
  switch (subProjectType) {
    case 'setup':
      return [
        {
          title: 'Initialize project structure',
          description: 'Create directory layout, initialize package manager, set up build tools',
          baseComplexity: 'simple',
        },
        {
          title: 'Configure development environment',
          description: 'Set up linter, formatter, TypeScript config, and dev scripts',
          baseComplexity: 'simple',
        },
      ];

    case 'development':
      return [
        {
          title: 'Technical architecture design',
          description: 'Choose tech stack, design data models, define API contracts',
          baseComplexity: 'medium',
        },
        {
          title: 'Core feature implementation',
          description: 'Implement the primary functionality based on requirements',
          baseComplexity: 'medium',
        },
        {
          title: 'UI/UX implementation',
          description: 'Build user interface, layout, interactions, and visual polish',
          baseComplexity: 'medium',
        },
        {
          title: 'Integration and wiring',
          description: 'Connect frontend to backend, integrate third-party services',
          baseComplexity: 'medium',
        },
      ];

    case 'production':
      return [
        {
          title: 'Creative concept and planning',
          description: 'Define creative direction, style, and production roadmap',
          baseComplexity: 'medium',
        },
        {
          title: 'Asset creation',
          description: 'Create core assets (audio, visuals, copy) for the product',
          baseComplexity: 'medium',
        },
        {
          title: 'Production and refinement',
          description: 'Produce final deliverables, mix, master, or polish',
          baseComplexity: 'complex',
        },
      ];

    case 'creation':
      return [
        {
          title: 'Content planning',
          description: 'Outline topics, structure, and content calendar',
          baseComplexity: 'simple',
        },
        {
          title: 'Content production',
          description: 'Create the actual content (write, record, edit)',
          baseComplexity: 'medium',
        },
        {
          title: 'Content optimization',
          description: 'SEO, thumbnail, title optimization for distribution',
          baseComplexity: 'simple',
        },
      ];

    case 'testing':
      return [
        {
          title: 'Write test cases',
          description: 'Design unit tests, integration tests, and edge case coverage',
          baseComplexity: 'medium',
        },
        {
          title: 'Execute tests and fix bugs',
          description: 'Run test suite, identify failures, fix issues, re-run',
          baseComplexity: 'medium',
        },
        {
          title: 'Performance and usability review',
          description: 'Check performance metrics, usability, and accessibility',
          baseComplexity: 'simple',
        },
      ];

    case 'platform-config':
      return [
        {
          title: 'Register platform account',
          description: 'Create developer account, configure billing and legal info',
          baseComplexity: 'simple',
        },
        {
          title: 'Configure platform settings',
          description: 'Set up app manifest, permissions, icons, and metadata',
          baseComplexity: 'medium',
        },
      ];

    case 'build':
      return [
        {
          title: 'Configure build pipeline',
          description: 'Set up build scripts, environment variables, and signing',
          baseComplexity: 'medium',
        },
        {
          title: 'Execute production build',
          description: 'Run production build, verify output, check bundle size',
          baseComplexity: 'medium',
        },
      ];

    case 'deployment':
      return [
        {
          title: 'Prepare deployment artifacts',
          description: 'Bundle assets, optimize images, generate manifest',
          baseComplexity: 'simple',
        },
        {
          title: 'Deploy to platform',
          description: 'Upload build, configure domain/URL, verify deployment',
          baseComplexity: 'medium',
        },
        {
          title: 'Post-deployment verification',
          description: 'Smoke test in production environment, check logs',
          baseComplexity: 'simple',
        },
      ];

    case 'store-submit':
      return [
        {
          title: 'Prepare store listing',
          description: 'Write description, prepare screenshots, set pricing',
          baseComplexity: 'medium',
        },
        {
          title: 'Submit for review',
          description: 'Upload to store, fill compliance forms, submit review request',
          baseComplexity: 'simple',
        },
        {
          title: 'Handle review feedback',
          description: 'Address rejection reasons, re-submit if needed',
          baseComplexity: 'medium',
        },
      ];

    case 'monetization':
      return [
        {
          title: 'Set up revenue channel',
          description: 'Configure ads, subscriptions, or payment processor',
          baseComplexity: 'medium',
        },
        {
          title: 'Implement monetization features',
          description: 'Add paywall, ad slots, or in-app purchase flows',
          baseComplexity: 'medium',
        },
      ];

    default:
      return [
        {
          title: `Execute ${subProjectType}`,
          description: 'Complete the required work for this sub-project',
          baseComplexity: 'medium',
        },
      ];
  }
}

/**
 * Plan tasks for a single SubProject.
 */
export function planTasks(subProject: SubProject, idea: Idea): PlanResult {
  try {
    const templates = getTaskTemplates(subProject.type);
    const now = new Date().toISOString();

    const tasks: Task[] = templates.map((tpl) => ({
      id: randomUUID(),
      subProjectId: subProject.id,
      title: tpl.title,
      description: tpl.description,
      complexity: adjustComplexity(tpl.baseComplexity, idea.complexity),
      status: 'pending',
      createdAt: now,
    }));

    return { success: true, tasks };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown planning error',
    };
  }
}
