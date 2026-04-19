/**
 * Platform Release Knowledge Base
 *
 * Detailed publishing workflows for each supported platform.
 * Injected into AI prompts so the generated code knows exactly
 * what steps, materials, and credentials are needed.
 */

export interface ReleaseStep {
  title: string;
  description: string;
  estimatedDays: number;
}

export interface UserInfoField {
  field: string;
  label: string;
  reason: string;
  required: boolean;
}

export interface PlatformGuide {
  steps: ReleaseStep[];
  requiredMaterials: string[];
  userInfoNeeded: UserInfoField[];
  notes: string;
}

export const PLATFORM_RELEASE_GUIDE: Record<string, PlatformGuide> = {
  'wechat-miniprogram': {
    steps: [
      { title: '注册小程序账号', description: '访问 mp.weixin.qq.com，用邮箱注册小程序账号', estimatedDays: 1 },
      { title: '微信认证', description: '企业/个体工商户需支付300元认证费，提交营业执照、对公账户等信息', estimatedDays: 1 },
      { title: 'ICP备案', description: '2023年底起强制执行。提交主体信息、负责人身份证、人脸识别、域名信息', estimatedDays: 15 },
      { title: '申请软著', description: '计算机软件著作权登记，证明游戏原创性', estimatedDays: 30 },
      { title: '资质审核', description: '提交软著、自审自查报告、授权书等材料', estimatedDays: 2 },
      { title: '设置适龄提示', description: '在后台设置游戏适龄提示（8+/12+/16+）', estimatedDays: 1 },
      { title: '上传代码', description: '使用微信开发者工具上传代码包到管理后台', estimatedDays: 1 },
      { title: '版本审核', description: '提交版本审核，填写游戏名称、图标、简介、截图', estimatedDays: 2 },
      { title: '正式发布', description: '审核通过后，在版本管理页面点击发布', estimatedDays: 1 },
    ],
    requiredMaterials: [
      '软著证书（或电子版权认证）',
      '自审自查报告（签字/盖章）',
      '授权书（如有代理）',
      '营业执照（企业主体）',
      '游戏著作权自我声明',
    ],
    userInfoNeeded: [
      { field: 'email', label: '邮箱', reason: '接收审核通知和账号验证', required: true },
      { field: 'phone', label: '手机号', reason: '账号注册和短信验证', required: true },
      { field: 'idCard', label: '身份证号', reason: '负责人实名认证和人脸识别', required: true },
      { field: 'companyName', label: '企业名称', reason: '微信认证和资质审核', required: false },
      { field: 'businessLicense', label: '营业执照号', reason: '企业主体认证', required: false },
    ],
    notes: '微信小游戏审核较严格，棋牌类、文化互动类需额外资质。建议企业主体注册，个人主体无法接入支付。',
  },

  douyin: {
    steps: [
      { title: '注册开发者账号', description: '访问 developer.open-douyin.com，用手机号注册', estimatedDays: 1 },
      { title: '主体认证', description: '企业需提交营业执照、法人身份证；个人仅限娱乐类', estimatedDays: 3 },
      { title: '创建小游戏', description: '填写游戏名称、简介、类目，上传图标和截图', estimatedDays: 1 },
      { title: '申请软著', description: '软件著作权登记，名称需与游戏名一致', estimatedDays: 30 },
      { title: '配置服务器域名', description: '设置 request、socket、uploadFile 合法域名', estimatedDays: 1 },
      { title: '上传代码包', description: '在开发者工具或平台上传 ZIP 格式的游戏包', estimatedDays: 1 },
      { title: '自测环节', description: '通过平台自测工具检查，确保无违规内容', estimatedDays: 1 },
      { title: '提交审核', description: '提交版本审核，审核周期 1-2 个工作日', estimatedDays: 2 },
      { title: '发布上线', description: '审核通过后点击发布', estimatedDays: 1 },
    ],
    requiredMaterials: [
      '软著证书',
      '自审查报告',
      '营业执照（企业）',
      '游戏内容介绍',
    ],
    userInfoNeeded: [
      { field: 'email', label: '邮箱', reason: '接收审核通知', required: true },
      { field: 'phone', label: '手机号', reason: '账号注册和验证', required: true },
      { field: 'idCard', label: '身份证号', reason: '实名认证', required: true },
      { field: 'companyName', label: '企业名称', reason: '主体认证', required: false },
    ],
    notes: '抖音小游戏审核相对微信宽松，但同样要求软著。eCPM 较高，适合 IAA（广告变现）。',
  },

  steam: {
    steps: [
      { title: '注册 Steamworks', description: '访问 partner.steamgames.com，用现有 Steam 账号注册', estimatedDays: 1 },
      { title: '支付入门费', description: '支付 100 美元/游戏的 Steam Direct 费用', estimatedDays: 1 },
      { title: '填写商店页面', description: '设置游戏名称、描述、截图、预告片、系统需求', estimatedDays: 2 },
      { title: '上传构建', description: '使用 SteamPipe 上传游戏构建包', estimatedDays: 1 },
      { title: '设置定价', description: '选择发售区域和定价策略', estimatedDays: 1 },
      { title: '准备愿望单', description: '提前发布商店页面积累愿望单', estimatedDays: 30 },
      { title: '提交审核', description: 'Steam 审核构建和商店页面', estimatedDays: 3 },
      { title: '正式发布', description: '设置发售日期并发布', estimatedDays: 1 },
    ],
    requiredMaterials: [
      'Steam 账号',
      '100 美元入门费',
      '游戏截图（至少 5 张）',
      '预告片/宣传片',
      'EULA（最终用户协议）',
    ],
    userInfoNeeded: [
      { field: 'email', label: '邮箱', reason: 'Steamworks 通知', required: true },
      { field: 'steamAccount', label: 'Steam 账号', reason: 'Steamworks 登录', required: true },
      { field: 'taxInfo', label: '税务信息', reason: '收益结算（W-8BEN 等）', required: true },
      { field: 'bankAccount', label: '银行账户', reason: '收益打款', required: true },
    ],
    notes: 'Steam 分成 30%（收入超过 1000 万美元后降至 25%）。建议提前 2-3 个月发布商店页面积累愿望单。',
  },

  web: {
    steps: [
      { title: '购买域名', description: '在阿里云/腾讯云/Cloudflare 购买域名', estimatedDays: 1 },
      { title: 'ICP备案', description: '国内服务器必须备案，提交主体信息和域名', estimatedDays: 15 },
      { title: '选择托管', description: 'Vercel/Netlify/Cloudflare Pages（海外）或阿里云 COS（国内）', estimatedDays: 1 },
      { title: '配置 DNS', description: '将域名解析到托管平台', estimatedDays: 1 },
      { title: '部署上线', description: '上传构建产物，配置 HTTPS', estimatedDays: 1 },
      { title: '接入广告', description: 'Google AdSense / 百度联盟等', estimatedDays: 3 },
    ],
    requiredMaterials: [
      '域名',
      'ICP备案号（国内）',
    ],
    userInfoNeeded: [
      { field: 'email', label: '邮箱', reason: '域名注册和托管平台账号', required: true },
      { field: 'domain', label: '域名', reason: '网站访问地址', required: true },
    ],
    notes: '网页版是最简单的发布方式，但变现效率较低（依赖广告）。建议同时做小程序版本。',
  },

  'app-store': {
    steps: [
      { title: '注册 Apple Developer', description: '访问 developer.apple.com，支付 99 美元/年', estimatedDays: 1 },
      { title: '准备材料', description: 'App 图标、截图、预览视频、隐私政策URL', estimatedDays: 2 },
      { title: '配置 App Store Connect', description: '设置 App 信息、定价、内购项目', estimatedDays: 1 },
      { title: '构建并签名', description: '使用 Xcode 构建并代码签名', estimatedDays: 1 },
      { title: '上传构建', description: '通过 Xcode 或 Transporter 上传到 App Store Connect', estimatedDays: 1 },
      { title: '提交审核', description: '填写审核信息，提交 App Review', estimatedDays: 2 },
      { title: '发布', description: '审核通过后手动发布或设置自动发布', estimatedDays: 1 },
    ],
    requiredMaterials: [
      'Apple Developer 账号（99美元/年）',
      'App 图标（1024x1024）',
      '截图（iPhone + iPad 各 3-5 张）',
      '隐私政策页面',
    ],
    userInfoNeeded: [
      { field: 'email', label: '邮箱', reason: 'Apple ID 和开发者账号', required: true },
      { field: 'appleId', label: 'Apple ID', reason: '开发者账号登录', required: true },
    ],
    notes: 'App Store 审核较严格，需符合 Human Interface Guidelines。首次审核通常 1-2 天，更新审核几小时。',
  },

  'google-play': {
    steps: [
      { title: '注册 Play Console', description: '访问 play.google.com/console，支付 25 美元一次性费用', estimatedDays: 1 },
      { title: '准备材料', description: 'App 图标、截图、功能图、隐私政策', estimatedDays: 2 },
      { title: '配置应用', description: '设置应用名称、描述、分类、内容分级', estimatedDays: 1 },
      { title: '上传 AAB', description: '构建 Android App Bundle 并上传', estimatedDays: 1 },
      { title: '设置签名', description: '配置 Play App Signing', estimatedDays: 1 },
      { title: '提交审核', description: 'Google Play 审核（通常几小时到几天）', estimatedDays: 2 },
      { title: '发布', description: '选择发布方式（内部测试/封闭测试/公开）', estimatedDays: 1 },
    ],
    requiredMaterials: [
      'Google Play 开发者账号（25美元）',
      '应用图标（512x512）',
      '截图（手机+平板）',
      '功能图（1024x500）',
      '隐私政策',
    ],
    userInfoNeeded: [
      { field: 'email', label: '邮箱', reason: 'Google 账号', required: true },
      { field: 'googleAccount', label: 'Google 账号', reason: 'Play Console 登录', required: true },
    ],
    notes: 'Google Play 审核比 App Store 宽松，但同样要求隐私政策和内容分级。支持 A/B 测试和分阶段发布。',
  },
};

/**
 * Get release guide for a platform.
 */
export function getPlatformGuide(platform: string): PlatformGuide | undefined {
  return PLATFORM_RELEASE_GUIDE[platform];
}

/**
 * Format platform guide as a text prompt for AI.
 */
export function formatPlatformGuideForPrompt(platform: string): string {
  const guide = getPlatformGuide(platform);
  if (!guide) return '';

  const steps = guide.steps
    .map((s, i) => `${i + 1}. ${s.title} (${s.estimatedDays}天) — ${s.description}`)
    .join('\n');

  const materials = guide.requiredMaterials.map((m) => `  - ${m}`).join('\n');

  const userInfo = guide.userInfoNeeded
    .map((u) => `  - ${u.label}${u.required ? '（必填）' : '（可选）'} — ${u.reason}`)
    .join('\n');

  return `PLATFORM PUBLISHING GUIDE for ${platform}:

Publishing steps:
${steps}

Required materials:
${materials}

User information needed:
${userInfo}

Notes: ${guide.notes}`;
}

/**
 * Format a user-friendly release insight for terminal display.
 * Shown immediately after idea parsing so the user knows what they're getting into.
 */
export function formatReleaseInsightForUser(platform: string): string {
  const guide = getPlatformGuide(platform);
  if (!guide) return '';

  const totalDays = guide.steps.reduce((sum, s) => sum + s.estimatedDays, 0);
  const requiredInfo = guide.userInfoNeeded.filter((u) => u.required);
  const optionalInfo = guide.userInfoNeeded.filter((u) => !u.required);

  let output = `\n📢 发布洞察：${platform} 平台\n`;
  output += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
  output += `⏱️  预估总时间：约 ${totalDays} 个工作日（仅供参考，实际以平台政策为准）\n\n`;

  output += '📋 你需要准备的材料：\n';
  for (const m of guide.requiredMaterials) {
    output += `   • ${m}\n`;
  }

  output += '\n👤 必填信息：\n';
  for (const u of requiredInfo) {
    output += `   • ${u.label} — ${u.reason}\n`;
  }

  if (optionalInfo.length > 0) {
    output += '\n👤 可选信息：\n';
    for (const u of optionalInfo) {
      output += `   • ${u.label} — ${u.reason}\n`;
    }
  }

  output += '\n📝 发布步骤概览：\n';
  for (const s of guide.steps) {
    output += `   ${s.title}（约 ${s.estimatedDays} 天，预估）\n`;
  }

  output += `\n💡 ${guide.notes}\n`;
  output += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
  output += '\n   配置平台凭证：kele secrets --platform <平台名> --set key=val\n';
  output += '   支持平台：wechat-miniprogram, douyin, steam, app-store, google-play\n';

  return output;
}

/**
 * Format a concise release checklist for post-project completion.
 */
export function formatReleaseChecklist(platform: string): string {
  const guide = getPlatformGuide(platform);
  if (!guide) return '';

  let output = '\n📦 发布准备清单\n';
  output += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';

  for (let i = 0; i < guide.steps.length; i++) {
    const s = guide.steps[i];
    output += `${i + 1}. [ ] ${s.title}\n`;
    output += `   ${s.description}（约 ${s.estimatedDays} 天）\n\n`;
  }

  output += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
  return output;
}
