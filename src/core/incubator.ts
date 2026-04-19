import type { Idea, SubProject, IncubateResult, CreativeType } from '../types/index.js';

/**
 * Incubator — turns a structured Idea into a list of SubProjects.
 *
 * MVP-first but scalable:
 * - Simple ideas: setup + core dev (fast, ~3-6 min)
 * - Medium ideas:  + testing (quality assurance)
 * - Complex ideas: + deployment + monetization (ship-ready)
 */

interface SubProjectTemplate {
  id: string;
  name: string;
  description: string;
  type: string;
  dependencies: string[];
}

function getCoreDevProject(type: CreativeType): SubProjectTemplate {
  switch (type) {
    case 'game':
      return {
        id: 'game-dev',
        name: 'Game Development',
        description: 'Develop core gameplay, assets, and mechanics',
        type: 'development',
        dependencies: ['project-setup'],
      };
    case 'music':
      return {
        id: 'music-production',
        name: 'Music Production',
        description: 'Compose, arrange, mix and master the track',
        type: 'production',
        dependencies: ['project-setup'],
      };
    case 'content':
      return {
        id: 'content-creation',
        name: 'Content Creation',
        description: 'Create articles, videos, or other media content',
        type: 'creation',
        dependencies: ['project-setup'],
      };
    case 'tool':
      return {
        id: 'tool-dev',
        name: 'Tool Development',
        description: 'Develop the tool functionality and user interface',
        type: 'development',
        dependencies: ['project-setup'],
      };
    default:
      return {
        id: 'core-dev',
        name: 'Core Development',
        description: 'Develop the core product based on idea',
        type: 'development',
        dependencies: ['project-setup'],
      };
  }
}

function getTestingProject(type: CreativeType): SubProjectTemplate {
  switch (type) {
    case 'game':
      return {
        id: 'game-test',
        name: 'Game Testing',
        description: 'Test gameplay, fix bugs, optimize performance',
        type: 'testing',
        dependencies: ['game-dev'],
      };
    case 'tool':
      return {
        id: 'tool-test',
        name: 'Tool Testing',
        description: 'Test functionality, edge cases, and usability',
        type: 'testing',
        dependencies: ['tool-dev'],
      };
    default:
      return {
        id: 'testing',
        name: 'Testing',
        description: 'Test functionality, edge cases, and quality assurance',
        type: 'testing',
        dependencies: ['core-dev'],
      };
  }
}

function getDeploymentProject(): SubProjectTemplate {
  return {
    id: 'deployment',
    name: 'Deployment',
    description: 'Deploy to hosting platform and verify production readiness',
    type: 'deployment',
    dependencies: [],
  };
}

function getMonetizationProject(): SubProjectTemplate {
  return {
    id: 'monetization',
    name: 'Monetization',
    description: 'Set up ads, subscriptions, or payment integration',
    type: 'monetization',
    dependencies: ['deployment'],
  };
}

/**
 * Incubate an Idea into a list of SubProjects.
 *
 * Scales with complexity:
 * - simple:  setup + dev
 * - medium:  setup + dev + test
 * - complex: setup + dev + test + deploy + monetize
 */
export function incubate(idea: Idea, rootDir: string): IncubateResult {
  try {
    const now = new Date().toISOString();

    const setup: SubProjectTemplate = {
      id: 'project-setup',
      name: 'Project Setup',
      description: 'Initialize project structure, dependencies, and tooling',
      type: 'setup',
      dependencies: [],
    };

    const coreDev = getCoreDevProject(idea.type);
    const templates: SubProjectTemplate[] = [setup, coreDev];

    // Medium+: add testing
    if (idea.complexity === 'medium' || idea.complexity === 'complex') {
      templates.push(getTestingProject(idea.type));
    }

    // Complex: add deployment and monetization
    if (idea.complexity === 'complex') {
      templates.push(getDeploymentProject());
      templates.push(getMonetizationProject());
    }

    const subProjects: SubProject[] = templates.map((tpl) => ({
      id: tpl.id,
      name: tpl.name,
      description: tpl.description,
      type: tpl.type,
      targetDir: `${rootDir}/${tpl.id}`,
      dependencies: tpl.dependencies,
      status: 'pending',
      createdAt: now,
    }));

    return { success: true, subProjects };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown incubation error',
    };
  }
}
