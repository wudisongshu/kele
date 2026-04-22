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
function getDevTaskTemplates(ideaType: string, ideaRawText: string, complexity: Complexity = 'medium'): TaskTemplate[] {
  if (ideaType === 'game') {
    // Dynamic split based on complexity to avoid AI truncation
    if (complexity === 'simple') {
      return [
        {
          title: 'Implement complete playable game',
          description:
            `Implement the FULL game based on the user's idea: "${ideaRawText}".\n\n` +
            'This is a SIMPLE game — keep it to a single HTML file with inline JS/CSS. ' +
            'Implement rendering, input handling, game logic, scoring, and game over/restart.',
          baseComplexity: 'medium',
        },
      ];
    }
    if (complexity === 'medium') {
      return [
        {
          title: 'Implement core gameplay',
          description:
            `Implement the CORE game mechanics for: "${ideaRawText}".\n\n` +
            'Focus on: rendering, player input, core game loop, and basic scoring. ' +
            'Return the COMPLETE code for these mechanics.',
          baseComplexity: 'medium',
        },
        {
          title: 'Add UI, menus, and polish',
          description:
            'Add start screen, game over screen, restart functionality, sound effects (if applicable), ' +
            'and visual polish. Build ON TOP of the existing code from the previous task. ' +
            'Preserve all existing game logic and only add/enhance.',
          baseComplexity: 'medium',
        },
      ];
    }
    // complex
    return [
      {
        title: 'Implement core gameplay engine',
        description:
          `Implement the CORE game engine for: "${ideaRawText}".\n\n` +
          'Focus on: rendering system, player input, core game loop, and collision/detection logic. ' +
          'Return the COMPLETE foundational code.',
        baseComplexity: 'complex',
      },
      {
        title: 'Add game systems and progression',
        description:
          'Add scoring, levels/progression, power-ups, enemies, and advanced mechanics. ' +
          'Build ON TOP of the existing code. Preserve all existing logic.',
        baseComplexity: 'complex',
      },
      {
        title: 'Add UI, menus, audio, and polish',
        description:
          'Add start screen, pause menu, game over screen, settings, sound effects, music, ' +
          'and visual polish. Build ON TOP of existing code. Preserve all existing logic.',
        baseComplexity: 'medium',
      },
    ];
  }

  if (ideaType === 'bot') {
    return [
      {
        title: 'Implement bot core logic',
        description:
          `Implement the FULL bot based on the user's idea: "${ideaRawText}".\n\n` +
          'You MUST implement ALL core bot functionality: ' +
          'command handling, message parsing, response generation, and error handling. ' +
          'The bot MUST be fully functional when this task completes.',
        baseComplexity: 'medium',
      },
      {
        title: 'Add bot commands and interactions',
        description:
          'Implement all slash commands, button interactions, and user flows. ' +
          'Each command MUST have complete logic with no stubs.',
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
function getTaskTemplates(subProjectType: string, ideaType: string, subProjectName: string, subProjectDesc: string, complexity: Complexity = 'medium'): TaskTemplate[] {
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
      return getDevTaskTemplates(ideaType || 'unknown', subProjectDesc, complexity);

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
          title: 'Run acceptance tests',
          description:
            'Execute the acceptance criteria that the incubator generated for this sub-project. ' +
            'The incubator defined specific verifiable requirements (e.g. "canvas renders 8x8 grid", ' +
            '"clicking a gem selects it", "3+ matches trigger elimination"). ' +
            'kele runs these criteria automatically against the built game. ' +
            'If any criterion fails, fix the game code until all critical criteria pass.',
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
            'For web deployment, ALSO generate PWA files: manifest.json and sw.js (Service Worker). ' +
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
            'NOTE: The development task already attempted to embed basic monetization code. Your job is to VERIFY, COMPLETE, and OPTIMIZE it. ' +
            'CRITICAL: The ad code MUST be embedded directly into the existing game/product files, not just placed in a separate file. ' +
            'For H5/Web games: modify the game\'s index.html to include ad containers (banner at bottom, interstitial between levels). Use the actual AdSense script tags. ' +
            'For WeChat Mini Games: add 微信广告 SDK initialization and ad unit calls to the game code (激励视频、插屏广告、Banner广告). ' +
            'For Douyin Mini Games: add 穿山甲广告 SDK to the game code. ' +
            'For Google Play: add AdMob SDK to the Android project. ' +
            'For App Store: add AdMob SDK to the iOS project. ' +
            'Also generate deployment config files (CI/CD workflows, platform configs) and a MONETIZE.md with revenue estimates and account setup instructions. ' +
            'If ad credentials are not configured, use placeholder IDs and clearly mark them as TODO items for the user to replace. ' +
            'If the development task already included ad code, enhance it (add more ad placements, improve timing, add fallback handling).',
          baseComplexity: 'medium',
        },
      ];

    case 'analytics':
      return [
        {
          title: 'Add analytics and tracking',
          description:
            'Integrate analytics tracking into the project. ' +
            'For web: add Google Analytics 4 (gtag.js) or Plausible Analytics script. ' +
            'Track page views, user sessions, and key events (game start, level complete, ad impression). ' +
            'Generate a privacy-friendly analytics setup that respects user consent. ' +
            'Include a PRIVACY.md explaining what data is collected and how it is used.',
          baseComplexity: 'simple',
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
    const templates = getTaskTemplates(subProject.type, idea.type, subProject.name, subProject.description, idea.complexity);
    const now = new Date().toISOString();

    const tasks: Task[] = templates.map((tpl) => ({
      id: randomUUID(),
      subProjectId: subProject.id,
      title: tpl.title,
      description: idea.type === 'game'
        ? `${tpl.description}\n\nUSER'S ORIGINAL IDEA (this is what they want): "${idea.rawText}"`
        : tpl.description,
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
