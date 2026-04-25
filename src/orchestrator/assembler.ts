/**
 * Assembler — combine multiple single-file pages into a cohesive product.
 */

import { join } from 'path';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import type { GeneratedPage } from './types.js';

export function assembleProduct(
  projectPath: string,
  pages: GeneratedPage[],
  productName: string,
): void {
  mkdirSync(projectPath, { recursive: true });

  // 1. Generate main entry index.html
  const mainHtml = buildMainPage(productName, pages);
  writeFileSync(join(projectPath, 'index.html'), mainHtml, 'utf-8');

  // 2. Fix navigation links in each sub-page to match actual file names
  fixPageNavigation(projectPath, pages);

  // 3. Inject navigation into each sub-page if missing
  for (const page of pages) {
    const pagePath = join(projectPath, page.fileName);
    if (!existsSync(pagePath)) continue;

    let html = readFileSync(pagePath, 'utf-8');
    if (!html.includes('返回首页') && !html.includes('href="./index.html"')) {
      html = injectNavigation(html, page.name);
      writeFileSync(pagePath, html, 'utf-8');
    }
  }

  // 4. Generate shared data bridge
  const bridgePath = join(projectPath, 'data-bridge.js');
  writeFileSync(bridgePath, buildDataBridge(), 'utf-8');

  // 5. Inject data-bridge into each page (including index.html)
  for (const file of ['index.html', ...pages.map((p) => p.fileName)]) {
    const filePath = join(projectPath, file);
    if (!existsSync(filePath)) continue;
    let html = readFileSync(filePath, 'utf-8');
    if (!html.includes('data-bridge.js')) {
      html = injectDataBridge(html);
      writeFileSync(filePath, html, 'utf-8');
    }
  }
}

function buildMainPage(productName: string, pages: GeneratedPage[]): string {
  const cards = pages
    .map(
      (p) => `      <a href="./${p.fileName}" class="page-card">
        <div class="page-icon">${p.icon || '📄'}</div>
        <div class="page-name">${p.name}</div>
        <div class="page-desc">${escapeHtml(p.description) || ''}</div>
      </a>`,
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(productName)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 40px 20px;
    }
    .container { max-width: 900px; margin: 0 auto; }
    h1 { color: white; text-align: center; margin-bottom: 40px; font-size: 2.2em; }
    .pages-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 20px;
    }
    .page-card {
      background: white;
      border-radius: 16px;
      padding: 24px;
      text-decoration: none;
      color: #333;
      transition: transform 0.2s, box-shadow 0.2s;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      text-align: center;
    }
    .page-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 12px 24px rgba(0,0,0,0.15);
    }
    .page-icon { font-size: 3em; margin-bottom: 12px; }
    .page-name { font-size: 1.1em; font-weight: 600; margin-bottom: 8px; }
    .page-desc { font-size: 0.85em; color: #666; line-height: 1.4; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🥤 ${escapeHtml(productName)}</h1>
    <div class="pages-grid">
${cards}
    </div>
  </div>
</body>
</html>`;
}

function fixPageNavigation(projectPath: string, pages: GeneratedPage[]) {
  // Build navMap: common reference names -> actual file names
  const navMap: Record<string, string> = {};
  for (const p of pages) {
    navMap[p.name] = p.fileName;
    // Also map the fileName to itself (idempotent)
    navMap[p.fileName] = p.fileName;
  }

  // Add common aliases based on page names
  for (const p of pages) {
    const name = p.name;
    if (name === '对战' || name === '双人对战' || name === '对战模式' || name === '双人模式' || name === '竞技对战') {
      navMap['match.html'] = p.fileName;
      navMap['duel.html'] = p.fileName;
      navMap['battle.html'] = p.fileName;
    }
    if (name === '练习' || name === '单人挑战' || name === '练习场' || name === '练习模式') {
      navMap['practice.html'] = p.fileName;
      navMap['single-player.html'] = p.fileName;
    }
    if (name === '规则' || name === '规则说明' || name === '教程' || name === '规则馆') {
      navMap['rules.html'] = p.fileName;
      navMap['guide.html'] = p.fileName;
      navMap['tutorial.html'] = p.fileName;
    }
    if (name === '战绩' || name === '战绩统计' || name === '统计' || name === '战绩中心' || name === '排行榜') {
      navMap['records.html'] = p.fileName;
      navMap['stats.html'] = p.fileName;
      navMap['leaderboard.html'] = p.fileName;
    }
    if (name === '首页' || name === '主页' || name === '游戏首页') {
      navMap['home.html'] = p.fileName;
      navMap['index.html'] = 'index.html';
    }
  }

  // Ensure index.html always points to itself
  navMap['index.html'] = 'index.html';
  navMap['首页'] = 'index.html';
  navMap['主页'] = 'index.html';

  for (const p of pages) {
    const filePath = join(projectPath, p.fileName);
    if (!existsSync(filePath)) continue;

    let html = readFileSync(filePath, 'utf-8');
    let modified = false;

    for (const [oldRef, newRef] of Object.entries(navMap)) {
      if (oldRef === newRef) continue;

      // Replace href="oldRef" -> href="newRef"
      const regex = new RegExp(`href=["']${escapeRegExp(oldRef)}["']`, 'g');
      if (regex.test(html)) {
        html = html.replace(regex, `href="${newRef}"`);
        modified = true;
      }

      // Replace href="./oldRef" -> href="./newRef"
      const regex2 = new RegExp(`href=["']\\./${escapeRegExp(oldRef)}["']`, 'g');
      if (regex2.test(html)) {
        html = html.replace(regex2, `href="./${newRef}"`);
        modified = true;
      }
    }

    if (modified) {
      writeFileSync(filePath, html, 'utf-8');
    }
  }
}

function injectNavigation(html: string, pageName: string): string {
  const navBar = `<div style="background:#1f2937;color:#fff;padding:10px 20px;font-family:sans-serif;display:flex;align-items:center;gap:12px;"><a href="./index.html" style="color:#93c5fd;text-decoration:none;font-weight:600;">← 返回首页</a><span style="opacity:0.6;">|</span><span>${escapeHtml(pageName)}</span></div>`;

  if (html.includes('<body')) {
    return html.replace('<body>', `<body>\n${navBar}`);
  }
  if (html.includes('<html')) {
    return html.replace('<html>', `<html>\n<body>\n${navBar}\n`) + '\n</body>';
  }
  return navBar + '\n' + html;
}

function buildDataBridge(): string {
  return `// kele data bridge — cross-page shared state via localStorage
(function(){var K=window.KeleData=window.KeleData||{};K.get=function(k){try{return JSON.parse(localStorage.getItem('kele_'+k));}catch(e){return null;}};K.set=function(k,v){localStorage.setItem('kele_'+k,JSON.stringify(v));};K.onChange=function(k,cb){window.addEventListener('storage',function(e){if(e.key==='kele_'+k){try{cb(JSON.parse(e.newValue));}catch(ex){}}});};})();`;
}

function injectDataBridge(html: string): string {
  const scriptTag = '<script src="./data-bridge.js"></script>';
  if (html.includes('</head>')) {
    return html.replace('</head>', `${scriptTag}\n</head>`);
  }
  if (html.includes('<body>')) {
    return html.replace('<body>', `<body>\n${scriptTag}`);
  }
  return scriptTag + '\n' + html;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
