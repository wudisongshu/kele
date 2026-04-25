/**
 * Release checklist generator — outputs monetization and deployment guidance.
 */

import type { Project } from '../project/types.js';

export interface ChecklistItem {
  icon: string;
  text: string;
}

export function generateChecklist(_project: Project): ChecklistItem[] {
  const items: ChecklistItem[] = [
    { icon: '✅', text: '游戏文件已生成' },
    { icon: '✅', text: 'PWA manifest 已配置' },
    { icon: '✅', text: 'Service Worker 已启用（离线可玩）' },
  ];

  // Platform-specific guidance
  items.push(
    { icon: '📋', text: '部署到 H5 / GitHub Pages: 无需资质，直接部署' },
    { icon: '📋', text: '部署到 Vercel / Netlify: 免费托管，全球 CDN' },
  );

  // Monetization warnings
  items.push(
    { icon: '⚠️', text: '如需软著：请确认代码经过人工改写（AI 代码不能直接申请软著）' },
    { icon: '⚠️', text: '微信小程序：需要软著 + 企业认证 + ICP 备案' },
    { icon: '⚠️', text: '抖音小游戏：需要软著 + 企业认证 + 版号（如涉及充值）' },
  );

  return items;
}

export function printChecklist(project: Project): void {
  console.log('\n📋 发布检查清单\n');
  for (const item of generateChecklist(project)) {
    console.log(`  ${item.icon} ${item.text}`);
  }
  console.log();
}
