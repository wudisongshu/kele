// 抖音小游戏 — 穿山甲广告 SDK 初始化
// 替换 adUnitIds 为你的真实广告位 ID（从抖音开发者平台获取）

const DOUYIN_AD_CONFIG = {
  splashAdUnitId: 'adunit-xxxxxxxxxxxxxxxx',      // 开屏广告位
  rewardedAdUnitId: 'adunit-yyyyyyyyyyyyyyyy',    // 激励视频广告位
  bannerAdUnitId: 'adunit-zzzzzzzzzzzzzzzz',      // Banner 广告位
};

let bannerAd = null;
let rewardedAd = null;
let splashAd = null;
let lastAdTime = 0;
const MIN_AD_INTERVAL = 30000; // 30 秒频率限制

function initAds() {
  if (typeof tt === 'undefined') {
    console.warn('[Douyin Ad] tt object not available — running outside Douyin environment');
    return;
  }

  rewardedAd = tt.createRewardedVideoAd({ adUnitId: DOUYIN_AD_CONFIG.rewardedAdUnitId });
  splashAd = tt.createInterstitialAd({ adUnitId: DOUYIN_AD_CONFIG.splashAdUnitId });

  rewardedAd.onLoad(() => console.log('[Douyin Ad] Rewarded video loaded'));
  rewardedAd.onError((err) => console.warn('[Douyin Ad] Rewarded video error:', err));

  splashAd.onLoad(() => console.log('[Douyin Ad] Splash/interstitial loaded'));
  splashAd.onError((err) => console.warn('[Douyin Ad] Splash error:', err));

  console.log('[Douyin Ad] 穿山甲 SDK initialized');
}

function canShowAd() {
  return Date.now() - lastAdTime >= MIN_AD_INTERVAL;
}

function showBannerAd() {
  if (typeof tt === 'undefined') {
    console.warn('[Douyin Ad] tt not available');
    return;
  }

  if (bannerAd) {
    bannerAd.hide();
    bannerAd.destroy();
  }

  bannerAd = tt.createBannerAd({
    adUnitId: DOUYIN_AD_CONFIG.bannerAdUnitId,
    style: { left: 0, top: tt.getSystemInfoSync().windowHeight - 80, width: 320 },
  });

  bannerAd.onError((err) => console.warn('[Douyin Ad] Banner error:', err));
  bannerAd.show().catch((err) => console.warn('[Douyin Ad] Banner show failed:', err));
}

function hideBannerAd() {
  if (bannerAd) {
    bannerAd.hide();
  }
}

function showInterstitialAd() {
  if (!canShowAd()) {
    console.log('[Douyin Ad] Interstitial skipped: cooldown');
    return;
  }

  if (typeof tt === 'undefined' || !splashAd) {
    console.warn('[Douyin Ad] Interstitial not ready');
    return;
  }

  lastAdTime = Date.now();
  splashAd.show().catch((err) => {
    console.warn('[Douyin Ad] Interstitial show failed:', err);
  });
}

function showRewardedAd(onReward) {
  if (!canShowAd()) {
    console.log('[Douyin Ad] Rewarded skipped: cooldown');
    return;
  }

  if (typeof tt === 'undefined' || !rewardedAd) {
    console.warn('[Douyin Ad] Rewarded not ready');
    if (onReward) onReward();
    return;
  }

  lastAdTime = Date.now();

  const onClose = (res) => {
    rewardedAd.offClose(onClose);
    if (res && res.isEnded) {
      console.log('[Douyin Ad] Rewarded completed');
      if (onReward) onReward();
    } else {
      console.log('[Douyin Ad] Rewarded skipped by user');
    }
  };

  rewardedAd.onClose(onClose);
  rewardedAd.show().catch((err) => {
    console.warn('[Douyin Ad] Rewarded show failed:', err);
    if (onReward) onReward(); // 容错：加载失败也给奖励
  });
}

module.exports = { initAds, showBannerAd, hideBannerAd, showInterstitialAd, showRewardedAd };
