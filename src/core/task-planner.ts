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
        title: 'Implement complete playable game',
        description:
          'Implement the FULL game in one task: game board/grid rendering, click/touch input, ' +
          'tile swap logic, match detection (3+ in a row), elimination, gravity/falling, ' +
          'new tile generation, scoring system, and game loop. ' +
          'The game MUST be fully playable and enjoyable when this task completes. ' +
          'NO stub logic, NO TODO comments, NO placeholder functions.\n\n' +
          'ACCEPTANCE CRITERIA (kele will verify by playing):\n' +
          '1. Opening index.html shows an 8x8 grid of colored tiles with distinct colors/images\n' +
          '2. Clicking a tile selects it; clicking an adjacent tile swaps them\n' +
          '3. Swapping to create 3+ matching tiles triggers elimination\n' +
          '4. Eliminated tiles disappear and tiles above fall down to fill gaps\n' +
          '5. New tiles spawn from the top; the board always stays full\n' +
          '6. Score counter increases when matches are made\n' +
          '7. Invalid swaps (no match) automatically swap back\n' +
          '8. The game board is responsive and fills the visible area',
        baseComplexity: 'complex',
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
function getTaskTemplates(subProjectType: string, ideaType: string, subProjectName: string, subProjectDesc: string): TaskTemplate[] {
  switch (subProjectType) {
    case 'setup': {
      // If this is NOT the first setup (project-setup), generate different tasks
      const isFirstSetup = subProjectName.toLowerCase().includes('project') || subProjectName.toLowerCase().includes('setup');
      if (!isFirstSetup) {
        return [
          {
            title: `Complete ${subProjectName}`,
            description: `${subProjectDesc}\n\nGenerate the required files and configurations. ` +
              'Output actual files, not just guides. NO TODO comments, NO placeholder functions.',
            baseComplexity: 'medium',
          },
        ];
      }
      return [
        {
          title: 'Initialize project with minimal configuration',
          description:
            'Create ONLY the essential project files: package.json with dev scripts, ' +
            'vite.config.ts (or equivalent build tool), .gitignore, and a basic index.html. ' +
            'DO NOT generate empty TypeScript classes, stub files, or boilerplate code. ' +
            'The project must be runnable after this step with `npm install && npm run dev`. ' +
            'NO TODO comments, NO placeholder functions.',
          baseComplexity: 'simple',
        },
      ];
    }

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
          title: 'Generate deployment configuration',
          description:
            'Generate ALL configuration files needed for deployment to the target platform. ' +
            'This includes: CI/CD workflow files (.github/workflows/deploy.yml), ' +
            'platform config files (project.config.json, game.json), ' +
            'deployment scripts (deploy.sh), and ad integration code (adsense.html). ' +
            'The user should be able to deploy with minimal manual steps — ideally just ' +
            'running a single command or pushing to git. ' +
            'If credentials exist, embed them in the config files. ' +
            'If credentials are missing, generate placeholder configs and include a SETUP.md ' +
            'explaining what credentials are needed and how to obtain them.',
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
          title: 'Integrate monetization',
          description:
            'Generate and integrate monetization code for the target platform. ' +
            'For H5/Web: embed Google AdSense or 百度联盟广告代码 into the HTML. ' +
            'For WeChat: integrate 微信广告 SDK (激励视频、插屏广告). ' +
            'For Douyin: integrate 穿山甲广告 SDK. ' +
            'For Google Play: integrate AdMob SDK. ' +
            'Generate the actual code files (not just guides) that can be copy-pasted into the project. ' +
            'Also output a MONETIZE.md with revenue estimates and account setup instructions.',
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
    const templates = getTaskTemplates(subProject.type, idea.type, subProject.name, subProject.description);
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
