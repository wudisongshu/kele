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

  // 2. Inject navigation into each sub-page if missing
  for (const page of pages) {
    const pagePath = join(projectPath, page.fileName);
    if (!existsSync(pagePath)) continue;

    let html = readFileSync(pagePath, 'utf-8');
    if (!html.includes('返回首页') && !html.includes('href="./index.html"')) {
      html = injectNavigation(html, page.name);
      writeFileSync(pagePath, html, 'utf-8');
    }
  }

  // 3. Generate shared data bridge
  const bridgePath = join(projectPath, 'data-bridge.js');
  writeFileSync(bridgePath, buildDataBridge(), 'utf-8');

  // 4. Inject data-bridge into each page (including index.html)
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
        <div class="page-desc">${p.description || ''}</div>
      </a>`,
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${productName}</title>
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
    <h1>🥤 ${productName}</h1>
    <div class="pages-grid">
${cards}
    </div>
  </div>
</body>
</html>`;
}

function injectNavigation(html: string, pageName: string): string {
  const navBar = `<div style="background:#1f2937;color:#fff;padding:10px 20px;font-family:sans-serif;display:flex;align-items:center;gap:12px;"><a href="./index.html" style="color:#93c5fd;text-decoration:none;font-weight:600;">← 返回首页</a><span style="opacity:0.6;">|</span><span>${pageName}</span></div>`;

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
