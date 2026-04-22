// iOS App — AdMob 广告集成示例
// 使用 Capacitor 构建时，通过 @capacitor-community/admob 插件集成

const ADMOB_CONFIG = {
  banner: {
    adUnitId: 'ca-app-pub-xxxxxxxxxxxxxxxx/xxxxxxxxxx', // 替换为你的 Banner 广告单元 ID
    position: 'bottom',
    margin: 0,
  },
  interstitial: {
    adUnitId: 'ca-app-pub-xxxxxxxxxxxxxxxx/xxxxxxxxxx', // 替换为你的插屏广告单元 ID
  },
  rewarded: {
    adUnitId: 'ca-app-pub-xxxxxxxxxxxxxxxx/xxxxxxxxxx', // 替换为你的激励视频广告单元 ID
  },
};

async function initAdMob() {
  try {
    const { AdMob } = await import('@capacitor-community/admob');
    await AdMob.initialize({
      requestTrackingAuthorization: true,
      testingDevices: [],
      initializeForTesting: false,
    });
    console.log('AdMob initialized');
  } catch (err) {
    console.warn('AdMob initialization failed:', err);
  }
}

async function showBanner() {
  try {
    const { AdMob, BannerAdSize, BannerAdPosition } = await import('@capacitor-community/admob');
    await AdMob.showBanner({
      adId: ADMOB_CONFIG.banner.adUnitId,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: 0,
    });
  } catch (err) {
    console.warn('Banner show failed:', err);
  }
}

async function showInterstitial() {
  try {
    const { AdMob } = await import('@capacitor-community/admob');
    await AdMob.prepareInterstitial({ adId: ADMOB_CONFIG.interstitial.adUnitId });
    await AdMob.showInterstitial();
  } catch (err) {
    console.warn('Interstitial show failed:', err);
  }
}

async function showRewarded(onReward) {
  try {
    const { AdMob, RewardAdPluginEvents } = await import('@capacitor-community/admob');
    await AdMob.prepareRewardVideoAd({ adId: ADMOB_CONFIG.rewarded.adUnitId });
    AdMob.addListener(RewardAdPluginEvents.Rewarded, (reward) => {
      if (onReward) onReward(reward);
    });
    await AdMob.showRewardVideoAd();
  } catch (err) {
    console.warn('Rewarded show failed:', err);
  }
}

module.exports = { initAdMob, showBanner, showInterstitial, showRewarded, ADMOB_CONFIG };
