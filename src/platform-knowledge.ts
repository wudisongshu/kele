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
    notes: '微信小游戏审核较严格，棋牌类、文化互动类需额外资质。建议企业主体注册，个人主体无法接入支付。\n\n⚠️ CRITICAL: 2026年3月起软著申请明确禁止AI生成代码。若使用kele/AI辅助开发，必须在代码基础上进行实质性人工改造（重写核心算法、重构代码结构、添加原创注释等），否则软著可能被驳回并纳入征信记录。\n\n替代方案：可先部署为H5网页游戏（无需任何资质），积累用户后再申请软著上架。',
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
    notes: '抖音小游戏审核相对微信宽松，但同样要求软著。eCPM 较高，适合 IAA（广告变现）。\n\n⚠️ CRITICAL: 2026年3月起软著申请明确禁止AI生成代码。若使用kele/AI辅助开发，必须在代码基础上进行实质性人工改造（重写核心算法、重构代码结构、添加原创注释等），否则软著可能被驳回并纳入征信记录。\n\n替代方案：可先部署为H5网页游戏（无需任何资质），积累用户后再申请软著上架。',
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
      { title: 'ICP备案（国内服务器）', description: '国内服务器必须备案，提交主体信息和域名。使用海外托管可跳过', estimatedDays: 15 },
      { title: '选择托管', description: 'Vercel/Netlify/Cloudflare Pages（海外，免备案）或阿里云 COS（国内）', estimatedDays: 1 },
      { title: '配置 DNS', description: '将域名解析到托管平台', estimatedDays: 1 },
      { title: '部署上线', description: '上传构建产物，配置 HTTPS', estimatedDays: 1 },
      { title: '接入广告', description: 'Google AdSense / 百度联盟等', estimatedDays: 3 },
    ],
    requiredMaterials: [
      '域名',
      'ICP备案号（国内服务器）',
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
    notes: 'App Store 审核较严格，需符合 Human Interface Guidelines。首次审核通常 1-2 天，更新审核几小时。\n\n✅ 优势：国际版 App Store 不需要软著，也不需要版号。适合个人开发者快速上架。如果目标用户在国内，需考虑 App Store 中国区是否需要额外资质。',
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
    notes: 'Google Play 审核比 App Store 宽松，但同样要求隐私政策和内容分级。支持 A/B 测试和分阶段发布。\n\n✅ 优势：不需要软著，不需要版号，25美元一次性费用即可上架。个人开发者最友好的国际平台之一。',
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
  output += '   支持平台：wechat-miniprogram, douyin, steam, web, app-store, google-play\n';
  output += '\n   ⚠️  注意：wechat-miniprogram 和 douyin 需要软著。如果代码由AI辅助生成，\n';
  output += '      必须先进行实质性人工改造（重写核心算法、重构代码结构等）才能申请软著。\n';
  output += '      若不想等软著，可先部署为 web（H5网页）版本，无需任何资质即可上线变现。\n';

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

/**
 * Get a one-command deploy guide for a platform.
 * Shown after project completion so the user knows exactly what to run.
 */
export function getDeployCommandGuide(platform: string, projectDir: string): string {
  const guides: Record<string, string> = {
    'web': `\n🚀 一键部署指南（H5 网页版）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

你的游戏已经准备好了！部署只需 2 步：

Step 1: 进入项目目录
   cd ${projectDir}

Step 2: 部署到 Vercel（推荐，免费）
   npx vercel --yes

或者部署到 Cloudflare Pages（免费）：
   npm install -g wrangler
   wrangler pages deploy .

✅ 部署完成后，你会得到一个 URL，分享出去就能开始赚钱！

💰 下一步：注册 Google AdSense
   1. 访问 https://www.google.com/adsense/start
   2. 用 Google 账号注册，填写网站 URL（你的部署地址）
   3. 将 AdSense 提供的代码粘贴到 adsense.html 中
   4. 重新部署：npx vercel --yes

🏦 收款：AdSense 会在余额满 $100 时自动电汇到你的银行卡
`,

    'wechat-miniprogram': `\n🚀 部署指南（微信小程序）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

你的游戏代码已生成，但微信小游戏需要额外步骤：

Step 1: 安装微信开发者工具
   https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html

Step 2: 导入项目
   打开开发者工具 → 导入项目 → 选择 ${projectDir}

Step 3: 配置 AppID
   编辑 project.config.json，填入你的 AppID

Step 4: 上传代码
   点击「上传」按钮，填写版本号

⚠️  注意：上架前必须完成
   1. 申请软著（AI代码需人工改造后才能申请）
   2. 完成 ICP 备案
   3. 提交自审自查报告

💰 收益：接入微信广告后，日活 1000 ≈ ¥30-100/天
`,

    'google-play': `\n🚀 部署指南（Google Play）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Step 1: 注册 Google Play 开发者账号
   https://play.google.com/console
   费用：$25 一次性

Step 2: 安装 fastlane
   cd ${projectDir}
   npm install -g fastlane

Step 3: 配置 Fastfile
   编辑 fastlane/Appfile，填入你的 package_name

Step 4: 构建并上传
   fastlane android deploy

✅ 不需要软著！不需要版号！

💰 收益：AdMob 广告 + 内购，日活 1000 ≈ $10-50/天
🏦 收款：Google 自动打款至你的银行卡
`,

    'app-store': `\n🚀 部署指南（App Store）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Step 1: 注册 Apple Developer
   https://developer.apple.com
   费用：$99/年

Step 2: 使用 Xcode 打开项目
   open ${projectDir}/*.xcodeproj

Step 3: 配置签名
   在 Xcode 中选择你的 Team，配置 Bundle Identifier

Step 4: 上传构建
   Product → Archive → Distribute App → App Store Connect

✅ 不需要软著！不需要版号！

💰 收益：AdMob 广告 + 内购，日活 1000 ≈ $15-60/天
🏦 收款：Apple 自动打款至你的银行账户
`,

    'steam': `\n🚀 部署指南（Steam）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Step 1: 注册 Steamworks
   https://partner.steamgames.com
   费用：$100/游戏（销量满 $1000 后返还）

Step 2: 配置 steamworks_config.json
   编辑文件，填入你的 Steam App ID

Step 3: 上传构建
   cd ${projectDir}
   ./build-upload.sh

✅ 不需要软著！不需要版号！

💰 收益：付费下载，定价你自己定
🏦 收款：Steam 钱包提现至 PayPal / 银行
`,

    'douyin': `\n🚀 部署指南（抖音小游戏）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Step 1: 注册抖音开发者
   https://developer.open-douyin.com

Step 2: 安装抖音开发者工具
   https://developer.open-douyin.com/docs/resource/zh-CN/mini-game/introduction/development-environment

Step 3: 导入项目
   打开开发者工具 → 导入 ${projectDir}

Step 4: 上传代码
   点击「上传」按钮

⚠️  注意：上架前必须完成
   1. 申请软著（AI代码需人工改造后才能申请）
   2. 完成 ICP 备案

💰 收益：穿山甲广告，日活 1000 ≈ ¥50-200/天
`,
  };

  return guides[platform] || '';
}

/**
 * Get a deployable config template for a platform.
 * Injected into AI prompts so the AI knows what actual files to generate.
 */
export function getDeployableConfigTemplate(platform: string): string {
  const templates: Record<string, string> = {
    'web': `For H5/Web deployment, generate these actual files (not guides):

1. .github/workflows/deploy.yml — GitHub Actions workflow for GitHub Pages deploy. MUST use actions/deploy-pages@v4. EXACT structure:
   - on: push: branches: ["main"] + workflow_dispatch
   - permissions: contents: read, pages: write, id-token: write
   - concurrency: group: "pages", cancel-in-progress: false
   - jobs.deploy.runs-on: ubuntu-latest
   - steps: actions/checkout@v4, actions/configure-pages@v5, actions/upload-pages-artifact@v3 with path: './', actions/deploy-pages@v4
   - This is a STATIC HTML5 game — NO build step, NO npm install needed

2. ads.txt — Domain authorization for AdSense. Content: google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0

3. adsense.html — Standalone Google AdSense snippet that can be copy-pasted into the game's HTML. MUST contain EXACTLY:
   <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXX"></script>
   <ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-XXXXXXXXXXXXXXXX" data-ad-slot="1234567890" data-ad-format="auto" data-full-width-responsive="true"></ins>
   <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>

4. CNAME — Custom domain placeholder. Single line: your-domain.com

5. SETUP.md — One-page setup guide with these EXACT sections:
   ## Step 1: Push to GitHub
   ## Step 2: Enable GitHub Pages (Settings → Pages → Source: GitHub Actions)
   ## Step 3: Set Workflow Permissions (Settings → Actions → General → Read and write permissions)
   ## Step 4: Replace AdSense Placeholder IDs
   ## Step 5: Add ads.txt to domain root`,

    'wechat-miniprogram': `For WeChat Mini Game deployment, generate these actual files:
1. project.config.json — WeChat developer tool project config (include appId from credentials)
2. game.json — Mini game manifest (orientation, deviceOrientation, networkTimeout)
3. deploy-wechat.sh — Shell script that uses miniprogram-ci to upload code
4. SETUP.md — How to install miniprogram-ci and run the deploy script`,

    'douyin': `For Douyin Mini Game deployment, generate these actual files:
1. project.config.json — Douyin developer tool project config
2. game.json — Game manifest
3. SETUP.md — How to use the Douyin developer tool to upload`,

    'google-play': `For Google Play deployment, generate these actual files:
1. fastlane/Appfile — Fastlane app configuration
2. fastlane/Fastfile — Fastlane deployment lane (build + upload)
3. privacy-policy.html — Privacy policy page content
4. SETUP.md — How to install fastlane and run deployment`,

    'app-store': `For App Store deployment, generate these actual files:
1. fastlane/Appfile — Fastlane app configuration
2. fastlane/Fastfile — Fastlane deployment lane (build + upload to TestFlight)
3. PrivacyInfo.xcprivacy — Apple privacy manifest
4. SETUP.md — How to install fastlane and deploy`,

    'steam': `For Steam deployment, generate these actual files:
1. steamworks_config.json — Steamworks app configuration
2. build-upload.sh — Script using steamcmd to upload builds
3. SETUP.md — How to install steamcmd and run the upload`,
  };

  return templates[platform] || '';
}
