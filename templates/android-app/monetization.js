// Android App — AdMob 广告集成示例
// 使用 Cordova/Capacitor 构建时，通过插件集成 AdMob

// cordova-plugin-admob-free 示例配置
const ADMOB_CONFIG = {
  banner: {
    adUnitId: 'ca-app-pub-xxxxxxxxxxxxxxxx/xxxxxxxxxx', // 替换为你的 Banner 广告单元 ID
    position: 'BOTTOM_CENTER',
    autoShow: true,
  },
  interstitial: {
    adUnitId: 'ca-app-pub-xxxxxxxxxxxxxxxx/xxxxxxxxxx', // 替换为你的插屏广告单元 ID
    autoShow: false,
  },
  rewarded: {
    adUnitId: 'ca-app-pub-xxxxxxxxxxxxxxxx/xxxxxxxxxx', // 替换为你的激励视频广告单元 ID
    autoShow: false,
  },
};

function initAdMob() {
  if (typeof admob !== 'undefined') {
    admob.banner.config(ADMOB_CONFIG.banner);
    admob.banner.prepare();

    admob.interstitial.config(ADMOB_CONFIG.interstitial);
    admob.interstitial.prepare();

    admob.rewardvideo.config(ADMOB_CONFIG.rewarded);
    admob.rewardvideo.prepare();
  } else {
    console.warn('AdMob plugin not available');
  }
}

function showInterstitial() {
  if (typeof admob !== 'undefined') {
    admob.interstitial.show();
  }
}

function showRewarded(onReward) {
  if (typeof admob !== 'undefined') {
    admob.rewardvideo.show().then(() => {
      if (onReward) onReward();
    });
  }
}

module.exports = { initAdMob, showInterstitial, showRewarded, ADMOB_CONFIG };
