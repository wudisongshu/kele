/**
 * Monetization Readiness Check
 *
 * Verifies that a generated project is not just "runnable" but "monetizable".
 * This is the final validation step after all tasks complete.
 *
 * Checks per platform:
 * - web: ads.txt, AdSense code, manifest.json, sw.js, deploy.yml, ad containers, triggers, frequency
 * - wechat-miniprogram: game.json, ad SDK init, ad containers, triggers, frequency
 * - douyin: game.json, ad SDK init, ad containers, triggers, frequency
 * - discord-bot/telegram-bot: premium command structure
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export interface ReadinessResult {
  monetizable: boolean;
  score: number; // 0-100
  checks: ReadinessCheck[];
}

export interface ReadinessCheck {
  name: string;
  passed: boolean;
  required: boolean;
  message: string;
}

export function checkMonetizationReadiness(targetDir: string, platform: string): ReadinessResult {
  const checks: ReadinessCheck[] = [];

  switch (platform) {
    case 'web':
      checks.push(checkFileExists(targetDir, 'ads.txt', true, 'AdSense domain authorization file'));
      checks.push(checkFileExists(targetDir, 'adsense.html', false, 'AdSense test/integration page'));
      checks.push(checkFileExists(targetDir, 'manifest.json', true, 'PWA manifest for installability'));
      checks.push(checkFileExists(targetDir, 'sw.js', true, 'Service Worker for offline play'));
      checks.push(checkFileExists(targetDir, '.github/workflows/deploy.yml', false, 'CI/CD deployment workflow'));
      checks.push(checkHtmlHasManifest(targetDir));
      checks.push(checkHtmlHasAdContainer(targetDir));
      checks.push(checkHtmlHasAdContainers(targetDir));
      checks.push(checkAdTriggerFunctions(targetDir));
      checks.push(checkAdFrequencyCap(targetDir));
      break;

    case 'wechat-miniprogram':
    case 'douyin':
      checks.push(checkFileExists(targetDir, 'game.json', true, 'Mini-program manifest'));
      checks.push(checkFileExists(targetDir, 'project.config.json', true, 'Developer tool project config'));
      checks.push(checkJsHasAdSdk(targetDir));
      checks.push(checkAdTriggerFunctions(targetDir));
      checks.push(checkAdFrequencyCap(targetDir));
      break;

    case 'discord-bot':
      checks.push(checkFileExists(targetDir, 'package.json', true, 'Node.js project manifest'));
      checks.push(checkFileExists(targetDir, '.env.example', false, 'Environment variable template'));
      checks.push(checkJsHasPremiumCommand(targetDir));
      break;

    case 'telegram-bot':
      checks.push(checkFileExists(targetDir, 'package.json', true, 'Node.js project manifest'));
      checks.push(checkFileExists(targetDir, '.env.example', false, 'Environment variable template'));
      checks.push(checkJsHasPremiumCommand(targetDir));
      break;

    case 'app-store':
    case 'google-play':
      checks.push(checkFileExists(targetDir, 'package.json', true, 'Project manifest'));
      checks.push(checkFileExists(targetDir, 'index.html', true, 'Game entry point'));
      checks.push(checkHtmlHasAdContainer(targetDir));
      break;

    case 'steam':
      checks.push(checkFileExists(targetDir, 'package.json', true, 'Electron project manifest'));
      checks.push(checkFileExists(targetDir, 'main.js', true, 'Electron main process'));
      checks.push(checkFileExists(targetDir, 'index.html', true, 'Game entry point'));
      break;

    case 'itchio':
      checks.push(checkFileExists(targetDir, 'index.html', true, 'Game entry point'));
      checks.push(checkFileExists(targetDir, 'package.json', false, 'Project manifest'));
      break;

    case 'github-sponsors':
      checks.push(checkFileExists(targetDir, 'README.md', true, 'Project README with sponsorship info'));
      checks.push(checkFileExists(targetDir, '.github/FUNDING.yml', false, 'GitHub Sponsors config'));
      break;

    default:
      checks.push({
        name: 'platform_support',
        passed: true,
        required: false,
        message: `No specific monetization checks for platform: ${platform}`,
      });
  }

  const requiredChecks = checks.filter((c) => c.required);
  const passedRequired = requiredChecks.filter((c) => c.passed).length;
  const totalRequired = requiredChecks.length;
  const passedAll = totalRequired === 0 || passedRequired === totalRequired;

  const score = totalRequired > 0 ? Math.round((passedRequired / totalRequired) * 100) : 100;

  return {
    monetizable: passedAll,
    score,
    checks,
  };
}

function checkFileExists(
  targetDir: string,
  filePath: string,
  required: boolean,
  description: string
): ReadinessCheck {
  const fullPath = join(targetDir, filePath);
  const passed = existsSync(fullPath);
  return {
    name: filePath,
    passed,
    required,
    message: passed ? `${description} found` : `${description} missing: ${filePath}`,
  };
}

function checkHtmlHasManifest(targetDir: string): ReadinessCheck {
  const htmlPath = join(targetDir, 'index.html');
  if (!existsSync(htmlPath)) {
    return { name: 'html_manifest_link', passed: false, required: true, message: 'index.html not found' };
  }
  const content = readFileSync(htmlPath, 'utf-8');
  const passed = content.includes('rel="manifest"') || content.includes("rel='manifest'");
  return {
    name: 'html_manifest_link',
    passed,
    required: true,
    message: passed ? 'Manifest link found in HTML' : 'Missing <link rel="manifest"> in index.html',
  };
}

function checkHtmlHasAdContainer(targetDir: string): ReadinessCheck {
  const htmlPath = join(targetDir, 'index.html');
  if (!existsSync(htmlPath)) {
    return { name: 'html_ad_container', passed: false, required: false, message: 'index.html not found' };
  }
  const content = readFileSync(htmlPath, 'utf-8');
  const passed = content.includes('adsbygoogle') || content.includes('googleads');
  return {
    name: 'html_ad_container',
    passed,
    required: false,
    message: passed ? 'Ad container found in HTML' : 'No ad container in index.html (optional for initial deploy)',
  };
}

function checkJsHasAdSdk(targetDir: string): ReadinessCheck {
  const entryFiles = ['index.js', 'game.js', 'main.js'];
  let hasSdk = false;
  for (const f of entryFiles) {
    const fpath = join(targetDir, f);
    if (existsSync(fpath)) {
      const content = readFileSync(fpath, 'utf-8');
      if (content.includes('createRewardedVideoAd') || content.includes('createInterstitialAd') || content.includes('createBannerAd')) {
        hasSdk = true;
        break;
      }
    }
  }
  return {
    name: 'ad_sdk_init',
    passed: hasSdk,
    required: false,
    message: hasSdk ? 'Ad SDK initialization found' : 'No ad SDK initialization (optional for initial deploy)',
  };
}

function checkJsHasPremiumCommand(targetDir: string): ReadinessCheck {
  const indexPath = join(targetDir, 'index.js');
  if (!existsSync(indexPath)) {
    return { name: 'premium_command', passed: false, required: false, message: 'index.js not found' };
  }
  const content = readFileSync(indexPath, 'utf-8');
  const passed = /premium|subscribe|donate|upgrade/i.test(content);
  return {
    name: 'premium_command',
    passed,
    required: false,
    message: passed ? 'Premium/subscribe command found' : 'No premium/subscribe command (optional)',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Ad Revenue Optimizer — deep checks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check for specific ad container DOM elements with IDs that the prompt requires.
 */
function checkHtmlHasAdContainers(targetDir: string): ReadinessCheck {
  const htmlPath = join(targetDir, 'index.html');
  const jsFiles = ['index.js', 'game.js', 'main.js'];

  let hasBanner = false;
  let hasInterstitial = false;

  // Check HTML for container divs
  if (existsSync(htmlPath)) {
    const html = readFileSync(htmlPath, 'utf-8');
    hasBanner = html.includes('id="ad-banner-bottom"') || html.includes("id='ad-banner-bottom'");
    hasInterstitial = html.includes('id="ad-interstitial"') || html.includes("id='ad-interstitial'");
  }

  // Check JS for mini-program banner ad creation
  for (const f of jsFiles) {
    const fpath = join(targetDir, f);
    if (existsSync(fpath)) {
      const content = readFileSync(fpath, 'utf-8');
      if (!hasBanner && /createBannerAd\s*\(/.test(content)) {
        hasBanner = true;
      }
      if (!hasInterstitial && /createInterstitialAd\s*\(/.test(content)) {
        hasInterstitial = true;
      }
    }
  }

  const passed = hasBanner || hasInterstitial;
  return {
    name: 'ad_containers',
    passed,
    required: false,
    message: passed
      ? `Ad containers found (banner: ${hasBanner}, interstitial: ${hasInterstitial})`
      : 'Missing ad container elements (ad-banner-bottom / ad-interstitial) or createBannerAd/createInterstitialAd calls',
  };
}

/**
 * Check for ad trigger function definitions or calls.
 */
function checkAdTriggerFunctions(targetDir: string): ReadinessCheck {
  const filesToCheck = ['index.html', 'index.js', 'game.js', 'main.js'];
  const triggers = ['showBannerAd', 'showInterstitialAd', 'showRewardedAd'];
  const found: string[] = [];

  for (const f of filesToCheck) {
    const fpath = join(targetDir, f);
    if (!existsSync(fpath)) continue;
    const content = readFileSync(fpath, 'utf-8');
    for (const trigger of triggers) {
      if (content.includes(trigger) && !found.includes(trigger)) {
        found.push(trigger);
      }
    }
  }

  const passed = found.length >= 2;
  return {
    name: 'ad_trigger_functions',
    passed,
    required: false,
    message: passed
      ? `Ad trigger functions found: ${found.join(', ')}`
      : `Only ${found.length}/3 ad trigger functions found (need showBannerAd, showInterstitialAd, showRewardedAd)`,
  };
}

/**
 * Check for ad frequency cap implementation (minimum 30s between interstitials).
 */
function checkAdFrequencyCap(targetDir: string): ReadinessCheck {
  const filesToCheck = ['index.html', 'index.js', 'game.js', 'main.js'];
  let hasFrequencyControl = false;

  for (const f of filesToCheck) {
    const fpath = join(targetDir, f);
    if (!existsSync(fpath)) continue;
    const content = readFileSync(fpath, 'utf-8');

    // Look for patterns that indicate frequency control
    const patterns = [
      /lastAdTime/i,
      /adCooldown/i,
      /minAdInterval/i,
      /adFrequency/i,
      /Date\.now\(\)\s*-\s*.*[Aa]d.*[Tt]ime.*>=?\s*30000/,
      /setTimeout\s*\(\s*.*[Ss]how[Aa]d/,
      /30000.*[Aa]d/,
      /[Aa]d.*30000/,
    ];

    for (const pattern of patterns) {
      if (pattern.test(content)) {
        hasFrequencyControl = true;
        break;
      }
    }
    if (hasFrequencyControl) break;
  }

  return {
    name: 'ad_frequency_cap',
    passed: hasFrequencyControl,
    required: false,
    message: hasFrequencyControl
      ? 'Ad frequency cap detected (≥30s between ads)'
      : 'No ad frequency cap detected — consider adding lastAdTime or 30s cooldown to avoid ad fatigue',
  };
}
