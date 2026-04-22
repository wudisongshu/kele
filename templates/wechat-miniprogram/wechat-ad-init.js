// 微信小游戏广告 SDK 初始化
// 替换 adUnitIds 为你的真实广告位 ID（从微信公众平台获取）

const WECHAT_AD_CONFIG = {
  bannerAdUnitId: 'adunit-xxxxxxxxxxxxxxxx',      // Banner 广告位
  rewardedAdUnitId: 'adunit-yyyyyyyyyyyyyyyy',    // 激励视频广告位
  interstitialAdUnitId: 'adunit-zzzzzzzzzzzzzzzz', // 插屏广告位
};

let bannerAd = null;
let rewardedAd = null;
let interstitialAd = null;
let lastAdTime = 0;
const MIN_AD_INTERVAL = 30000; // 30 秒频率限制

function initAds() {
  if (typeof wx === 'undefined') {
    console.warn('[WeChat Ad] wx object not available — running outside WeChat environment');
    return;
  }

  rewardedAd = wx.createRewardedVideoAd({ adUnitId: WECHAT_AD_CONFIG.rewardedAdUnitId });
  interstitialAd = wx.createInterstitialAd({ adUnitId: WECHAT_AD_CONFIG.interstitialAdUnitId });

  rewardedAd.onLoad(() => console.log('[WeChat Ad] Rewarded video loaded'));
  rewardedAd.onError((err) => console.warn('[WeChat Ad] Rewarded video error:', err));

  interstitialAd.onLoad(() => console.log('[WeChat Ad] Interstitial loaded'));
  interstitialAd.onError((err) => console.warn('[WeChat Ad] Interstitial error:', err));

  console.log('[WeChat Ad] SDK initialized');
}

function canShowAd() {
  return Date.now() - lastAdTime >= MIN_AD_INTERVAL;
}

function showBannerAd() {
  if (typeof wx === 'undefined') {
    console.warn('[WeChat Ad] wx not available');
    return;
  }

  if (bannerAd) {
    bannerAd.hide();
    bannerAd.destroy();
  }

  bannerAd = wx.createBannerAd({
    adUnitId: WECHAT_AD_CONFIG.bannerAdUnitId,
    style: { left: 0, top: wx.getSystemInfoSync().windowHeight - 80, width: 320 },
  });

  bannerAd.onError((err) => console.warn('[WeChat Ad] Banner error:', err));
  bannerAd.show().catch((err) => console.warn('[WeChat Ad] Banner show failed:', err));
}

function hideBannerAd() {
  if (bannerAd) {
    bannerAd.hide();
  }
}

function showInterstitialAd() {
  if (!canShowAd()) {
    console.log('[WeChat Ad] Interstitial skipped: cooldown');
    return;
  }

  if (typeof wx === 'undefined' || !interstitialAd) {
    console.warn('[WeChat Ad] Interstitial not ready');
    return;
  }

  lastAdTime = Date.now();
  interstitialAd.show().catch((err) => {
    console.warn('[WeChat Ad] Interstitial show failed:', err);
  });
}

function showRewardedAd(onReward) {
  if (!canShowAd()) {
    console.log('[WeChat Ad] Rewarded skipped: cooldown');
    return;
  }

  if (typeof wx === 'undefined' || !rewardedAd) {
    console.warn('[WeChat Ad] Rewarded not ready');
    if (onReward) onReward();
    return;
  }

  lastAdTime = Date.now();

  const onClose = (res) => {
    rewardedAd.offClose(onClose);
    if (res && res.isEnded) {
      console.log('[WeChat Ad] Rewarded completed');
      if (onReward) onReward();
    } else {
      console.log('[WeChat Ad] Rewarded skipped by user');
    }
  };

  rewardedAd.onClose(onClose);
  rewardedAd.show().catch((err) => {
    console.warn('[WeChat Ad] Rewarded show failed:', err);
    if (onReward) onReward(); // 容错：加载失败也给奖励
  });
}

// WeChat Mini Game environment — expose globally
if (typeof window !== 'undefined') {
  window.initAds = initAds;
  window.showBannerAd = showBannerAd;
  window.hideBannerAd = hideBannerAd;
  window.showInterstitialAd = showInterstitialAd;
  window.showRewardedAd = showRewardedAd;
}
