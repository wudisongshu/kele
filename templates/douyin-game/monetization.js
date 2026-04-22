// 抖音小游戏 — 穿山甲广告 SDK 示例
// 请将 PLACEHOLDER_AD_UNIT_ID 替换为你的真实广告位 ID

function initAds() {
  // 激励视频广告
  const rewardedAd = tt.createRewardedVideoAd({
    adUnitId: 'PLACEHOLDER_REWARDED_AD_UNIT_ID',
  });

  rewardedAd.onLoad(() => {
    console.log('激励视频广告加载成功');
  });

  rewardedAd.onError((err) => {
    console.error('激励视频广告加载失败', err);
  });

  // 插屏广告
  const interstitialAd = tt.createInterstitialAd({
    adUnitId: 'PLACEHOLDER_INTERSTITIAL_AD_UNIT_ID',
  });

  interstitialAd.onLoad(() => {
    console.log('插屏广告加载成功');
  });

  interstitialAd.onError((err) => {
    console.error('插屏广告加载失败', err);
  });

  return { rewardedAd, interstitialAd };
}

// 在游戏适当位置调用：
// const ads = initAds();
// ads.rewardedAd.show().then(() => { /* 给予奖励 */ });

// Douyin Mini Game environment — expose globally
if (typeof window !== 'undefined') {
  window.initAds = initAds;
}
