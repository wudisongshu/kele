import type { Idea, SubProject, IncubateResult, CreativeType, MonetizationChannel } from '../types/index.js';

/**
 * Incubator — turns a structured Idea into a list of SubProjects.
 *
 * Each SubProject is a discrete deliverable with clear dependencies.
 * The output can be executed sequentially or in parallel based on the dependency graph.
 */

interface SubProjectTemplate {
  id: string;
  name: string;
  description: string;
  type: string;
  dependencies: string[];
}

/**
 * Determine which sub-projects are needed based on creative type.
 */
function getTypeSubProjects(type: CreativeType): SubProjectTemplate[] {
  switch (type) {
    case 'game':
      return [
        {
          id: 'game-dev',
          name: 'Game Development',
          description: 'Develop core gameplay, assets, and mechanics',
          type: 'development',
          dependencies: ['project-setup'],
        },
        {
          id: 'game-test',
          name: 'Game Testing',
          description: 'Test gameplay, fix bugs, optimize performance',
          type: 'testing',
          dependencies: ['game-dev'],
        },
      ];
    case 'music':
      return [
        {
          id: 'music-production',
          name: 'Music Production',
          description: 'Compose, arrange, mix and master the track',
          type: 'production',
          dependencies: ['project-setup'],
        },
      ];
    case 'content':
      return [
        {
          id: 'content-creation',
          name: 'Content Creation',
          description: 'Create articles, videos, or other media content',
          type: 'creation',
          dependencies: ['project-setup'],
        },
      ];
    case 'tool':
      return [
        {
          id: 'tool-dev',
          name: 'Tool Development',
          description: 'Develop the tool functionality and user interface',
          type: 'development',
          dependencies: ['project-setup'],
        },
        {
          id: 'tool-test',
          name: 'Tool Testing',
          description: 'Test functionality, edge cases, and usability',
          type: 'testing',
          dependencies: ['tool-dev'],
        },
      ];
    default:
      return [
        {
          id: 'core-dev',
          name: 'Core Development',
          description: 'Develop the core product based on idea',
          type: 'development',
          dependencies: ['project-setup'],
        },
      ];
  }
}

/**
 * Determine platform-specific sub-projects based on monetization channel.
 */
function getMonetizationSubProjects(channel: MonetizationChannel): SubProjectTemplate[] {
  switch (channel) {
    case 'wechat-miniprogram':
      return [
        {
          id: 'wechat-config',
          name: 'WeChat Mini Program Config',
          description: 'Configure app.json, pages, and WeChat-specific settings',
          type: 'platform-config',
          dependencies: [],
        },
        {
          id: 'wechat-deploy',
          name: 'WeChat Deploy',
          description: 'Build and deploy to WeChat Developer Tools',
          type: 'deployment',
          dependencies: ['wechat-config'],
        },
        {
          id: 'wechat-submit',
          name: 'WeChat Store Submit',
          description: 'Submit for WeChat mini-program review and go live',
          type: 'store-submit',
          dependencies: ['wechat-deploy'],
        },
      ];
    case 'douyin':
      return [
        {
          id: 'douyin-config',
          name: 'Douyin Mini Game Config',
          description: 'Configure Douyin-specific SDK and manifest',
          type: 'platform-config',
          dependencies: [],
        },
        {
          id: 'douyin-deploy',
          name: 'Douyin Deploy',
          description: 'Build and deploy to Douyin Creator Platform',
          type: 'deployment',
          dependencies: ['douyin-config'],
        },
        {
          id: 'douyin-submit',
          name: 'Douyin Store Submit',
          description: 'Submit for Douyin review and publish',
          type: 'store-submit',
          dependencies: ['douyin-deploy'],
        },
      ];
    case 'steam':
      return [
        {
          id: 'steam-build',
          name: 'Steam Build',
          description: 'Build executable and prepare Steam depot',
          type: 'build',
          dependencies: [],
        },
        {
          id: 'steam-config',
          name: 'Steam Store Config',
          description: 'Set up Steamworks app, store page, and pricing',
          type: 'platform-config',
          dependencies: ['steam-build'],
        },
        {
          id: 'steam-submit',
          name: 'Steam Review Submit',
          description: 'Submit build for Steam review and release',
          type: 'store-submit',
          dependencies: ['steam-config'],
        },
      ];
    case 'web':
      return [
        {
          id: 'web-deploy',
          name: 'Web Deployment',
          description: 'Deploy to hosting platform (Vercel/Netlify/Cloudflare)',
          type: 'deployment',
          dependencies: [],
        },
        {
          id: 'web-monetize',
          name: 'Web Monetization',
          description: 'Set up ads, subscriptions, or payment integration',
          type: 'monetization',
          dependencies: ['web-deploy'],
        },
      ];
    case 'app-store':
      return [
        {
          id: 'ios-build',
          name: 'iOS Build',
          description: 'Build iOS app archive and prepare for App Store',
          type: 'build',
          dependencies: [],
        },
        {
          id: 'app-store-config',
          name: 'App Store Config',
          description: 'Set up App Store Connect, screenshots, and metadata',
          type: 'platform-config',
          dependencies: ['ios-build'],
        },
        {
          id: 'app-store-submit',
          name: 'App Store Submit',
          description: 'Submit for App Store review and release',
          type: 'store-submit',
          dependencies: ['app-store-config'],
        },
      ];
    case 'google-play':
      return [
        {
          id: 'android-build',
          name: 'Android Build',
          description: 'Build APK/AAB and prepare for Google Play',
          type: 'build',
          dependencies: [],
        },
        {
          id: 'google-play-config',
          name: 'Google Play Config',
          description: 'Set up Play Console, store listing, and pricing',
          type: 'platform-config',
          dependencies: ['android-build'],
        },
        {
          id: 'google-play-submit',
          name: 'Google Play Submit',
          description: 'Submit for Google Play review and publish',
          type: 'store-submit',
          dependencies: ['google-play-config'],
        },
      ];
    default:
      return [
        {
          id: 'generic-deploy',
          name: 'Generic Deployment',
          description: 'Deploy the product to a suitable platform',
          type: 'deployment',
          dependencies: [],
        },
      ];
  }
}

/**
 * Incubate an Idea into a list of SubProjects.
 */
export function incubate(idea: Idea, rootDir: string): IncubateResult {
  try {
    const now = new Date().toISOString();

    // Always start with project setup
    const setup: SubProjectTemplate = {
      id: 'project-setup',
      name: 'Project Setup',
      description: 'Initialize project structure, dependencies, and tooling',
      type: 'setup',
      dependencies: [],
    };

    const typeProjects = getTypeSubProjects(idea.type);
    const monetizationProjects = getMonetizationSubProjects(idea.monetization);

    // Merge all templates
    const templates = [setup, ...typeProjects, ...monetizationProjects];

    // Assign target directories and convert to SubProject objects
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
