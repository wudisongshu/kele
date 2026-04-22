// Google AdSense 初始化 — PWA/网页游戏
// 替换 ca-pub-XXXXXXXXXXXXXXXX 为你的真实 Publisher ID
// 替换 XXXXXXXXXX 为你的真实 Ad Unit ID

const ADSENSE_CONFIG = {
  publisherId: 'ca-pub-XXXXXXXXXXXXXXXX',
  bannerSlot: 'XXXXXXXXXX',
  interstitialSlot: 'XXXXXXXXXX',
  rewardedSlot: 'XXXXXXXXXX',
};

// Banner 广告容器（必须在 HTML 中存在 <div id="ad-banner-bottom"></div>）
let bannerAd = null;

function initAds() {
  // AdSense 脚本由 index.html 中的 <script async src=".../adsbygoogle.js"> 加载
  // 此处仅做配置和初始化
  console.log('[AdSense] Initialized with publisher:', ADSENSE_CONFIG.publisherId);
}

function showBannerAd() {
  const container = document.getElementById('ad-banner-bottom');
  if (!container) {
    console.warn('[AdSense] Banner container #ad-banner-bottom not found');
    return;
  }

  // 清除旧内容
  container.innerHTML = '';

  const ins = document.createElement('ins');
  ins.className = 'adsbygoogle';
  ins.style.display = 'block';
  ins.setAttribute('data-ad-client', ADSENSE_CONFIG.publisherId);
  ins.setAttribute('data-ad-slot', ADSENSE_CONFIG.bannerSlot);
  ins.setAttribute('data-ad-format', 'auto');
  ins.setAttribute('data-full-width-responsive', 'true');
  container.appendChild(ins);

  try {
    (window.adsbygoogle = window.adsbygoogle || []).push({});
  } catch (err) {
    console.warn('[AdSense] Banner load failed (expected in test mode):', err);
  }
}

function hideBannerAd() {
  const container = document.getElementById('ad-banner-bottom');
  if (container) container.style.display = 'none';
}

// 插屏广告（使用 AdSense 全屏广告或 Google Publisher Tag）
let lastInterstitialTime = 0;
const MIN_AD_INTERVAL = 30000; // 30 秒频率限制

function canShowInterstitial() {
  return Date.now() - lastInterstitialTime >= MIN_AD_INTERVAL;
}

function showInterstitialAd() {
  if (!canShowInterstitial()) {
    console.log('[AdSense] Interstitial skipped: cooldown active');
    return;
  }

  lastInterstitialTime = Date.now();

  const container = document.getElementById('ad-interstitial');
  if (!container) {
    console.warn('[AdSense] Interstitial container #ad-interstitial not found');
    return;
  }

  container.style.display = 'flex';
  container.innerHTML = `
    <div style="background:#000;color:#fff;padding:20px;text-align:center;position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;justify-content:center;align-items:center;">
      <p>广告展示中...</p>
      <button id="ad-skip" style="margin-top:20px;padding:10px 20px;font-size:16px;">关闭广告</button>
    </div>
  `;

  document.getElementById('ad-skip')?.addEventListener('click', () => {
    container.style.display = 'none';
    container.innerHTML = '';
  });

  // 真实环境：此处应调用 AdSense/GAM 插屏广告 API
  console.log('[AdSense] Interstitial shown (test mode)');
}

// 激励视频（AdSense 不直接支持，需用 Google Ad Manager 或第三方）
function showRewardedAd(onReward) {
  if (!canShowInterstitial()) {
    console.log('[AdSense] Rewarded ad skipped: cooldown active');
    return;
  }

  lastInterstitialTime = Date.now();

  const container = document.getElementById('ad-interstitial');
  if (!container) {
    console.warn('[AdSense] Rewarded ad container #ad-interstitial not found');
    if (onReward) onReward();
    return;
  }

  container.style.display = 'flex';
  container.innerHTML = `
    <div style="background:#1a1a2e;color:#fff;padding:20px;text-align:center;position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;justify-content:center;align-items:center;">
      <p>🎬 观看广告获得奖励</p>
      <button id="ad-complete" style="margin-top:20px;padding:10px 20px;font-size:16px;">模拟观看完成</button>
      <button id="ad-cancel" style="margin-top:10px;padding:8px 16px;font-size:14px;">取消</button>
    </div>
  `;

  document.getElementById('ad-complete')?.addEventListener('click', () => {
    container.style.display = 'none';
    container.innerHTML = '';
    if (onReward) onReward();
  });

  document.getElementById('ad-cancel')?.addEventListener('click', () => {
    container.style.display = 'none';
    container.innerHTML = '';
  });
}

// 自动初始化（如果 adsbygoogle 已加载）
if (typeof window !== 'undefined') {
  initAds();
}

// PWA Browser environment — expose globally
if (typeof window !== 'undefined') {
  window.initAds = initAds;
  window.showBannerAd = showBannerAd;
  window.hideBannerAd = hideBannerAd;
  window.showInterstitialAd = showInterstitialAd;
  window.showRewardedAd = showRewardedAd;
  window.canShowInterstitial = canShowInterstitial;
}
