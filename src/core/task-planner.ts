import { randomUUID } from 'crypto';
import type { Idea, SubProject, Task, PlanResult, Complexity } from '../types/index.js';

/**
 * TaskPlanner — breaks a SubProject into executable Tasks.
 *
 * Optimized for MVP speed: fewer tasks per sub-project means faster
 * AI execution (critical for slow providers like Kimi Code).
 */

interface TaskTemplate {
  title: string;
  description: string;
  baseComplexity: Complexity;
}

/**
 * Get development task templates based on project type.
 * Games are split into smaller, verifiable tasks to prevent AI from generating skeletons.
 */
function getDevTaskTemplates(ideaType: string): TaskTemplate[] {
  if (ideaType === 'game') {
    return [
      {
        title: 'Render game board and basic visuals',
        description:
          'Create the game board/grid, render tiles/elements with colors or images, ' +
          'and set up the canvas or DOM structure. The board MUST be visible and populated ' +
          'with actual content when this task completes. NO empty canvases or placeholder grids.',
        baseComplexity: 'medium',
      },
      {
        title: 'Implement user interaction',
        description:
          'Add click/touch handling for selecting and swapping tiles, drag support if needed, ' +
          'and visual feedback (highlight selected tiles). Interactions MUST work and be testable.',
        baseComplexity: 'medium',
      },
      {
        title: 'Implement core game logic',
        description:
          'Implement match detection (3+ in a row), elimination, gravity (tiles fall down), ' +
          'new tile generation, scoring system, and game-over conditions. ' +
          'The game MUST be fully playable after this task — matches eliminate, score updates, ' +
          'and the game loop runs correctly. NO stub logic or TODO comments.',
        baseComplexity: 'complex',
      },
      {
        title: 'Polish with animations and effects',
        description:
          'Add match animations, particle effects, sound cues, combo bonuses, and visual polish. ' +
          'This is the final integration step ensuring all components work together smoothly.',
        baseComplexity: 'medium',
      },
    ];
  }

  // Default for non-game projects
  return [
    {
      title: 'Implement core features and architecture',
      description:
        'Choose tech stack, design data models, implement primary functionality, ' +
        'and build the core user interface. All features MUST be complete and working.',
      baseComplexity: 'medium',
    },
    {
      title: 'Polish and integrate',
      description:
        'Connect all components, add interactions, visual polish, ' +
        'and integrate third-party services if needed.',
      baseComplexity: 'medium',
    },
  ];
}

/**
 * Adjust complexity based on the overall idea complexity.
 */
function adjustComplexity(base: Complexity, ideaComplexity: Complexity): Complexity {
  const levels: Complexity[] = ['simple', 'medium', 'complex'];
  const baseIndex = levels.indexOf(base);
  const ideaIndex = levels.indexOf(ideaComplexity);
  const shift = ideaIndex - 1;
  const adjusted = Math.max(0, Math.min(2, baseIndex + shift));
  return levels[adjusted];
}

/**
 * Get task templates for a given sub-project type.
 * Intentionally minimal — each sub-project gets 1-2 tasks max.
 */
function getTaskTemplates(subProjectType: string, ideaType: string): TaskTemplate[] {
  switch (subProjectType) {
    case 'setup':
      return [
        {
          title: 'Initialize project with full configuration',
          description:
            'Create directory layout, initialize package manager, set up build tools, ' +
            'linter, formatter, TypeScript config, and all dev scripts in one go.',
          baseComplexity: 'simple',
        },
      ];

    case 'development':
      return getDevTaskTemplates(ideaType || 'unknown');

    case 'production':
      return [
        {
          title: 'Create and produce assets',
          description: 'Define creative direction and produce final deliverables',
          baseComplexity: 'medium',
        },
        {
          title: 'Polish and finalize',
          description: 'Mix, master, refine, and prepare for release',
          baseComplexity: 'medium',
        },
      ];

    case 'creation':
      return [
        {
          title: 'Plan and produce content',
          description: 'Outline structure and create the actual content',
          baseComplexity: 'medium',
        },
        {
          title: 'Optimize for distribution',
          description: 'SEO, thumbnails, titles, and formatting',
          baseComplexity: 'simple',
        },
      ];

    case 'testing':
      return [
        {
          title: 'Write and run tests',
          description: 'Design tests, execute, fix bugs, verify coverage',
          baseComplexity: 'medium',
        },
      ];

    case 'platform-config':
      return [
        {
          title: 'Configure platform settings',
          description: 'Set up app manifest, permissions, icons, and metadata',
          baseComplexity: 'medium',
        },
      ];

    case 'build':
      return [
        {
          title: 'Build production artifacts',
          description: 'Configure pipeline, run build, verify output',
          baseComplexity: 'medium',
        },
      ];

    case 'deployment':
      return [
        {
          title: 'Deploy to platform',
          description: 'Bundle assets, upload, configure domain, verify',
          baseComplexity: 'medium',
        },
      ];

    case 'store-submit':
      return [
        {
          title: 'Submit to store',
          description: 'Prepare listing, upload, fill forms, submit review',
          baseComplexity: 'medium',
        },
      ];

    case 'monetization':
      return [
        {
          title: 'Set up monetization',
          description: 'Configure ads, subscriptions, or payment flows',
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
    const templates = getTaskTemplates(subProject.type, idea.type);
    const now = new Date().toISOString();

    const tasks: Task[] = templates.map((tpl) => ({
      id: randomUUID(),
      subProjectId: subProject.id,
      title: tpl.title,
      description: tpl.description,
      complexity: adjustComplexity(tpl.baseComplexity, idea.complexity),
      status: 'pending',
      version: 1,
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
