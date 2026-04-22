// Steam Game — Steamworks IAP 和 DLC 配置示例
// 使用 Greenworks 或 Steamworks.js 与 Steam API 交互

const STEAM_APP_ID = '480'; // 替换为你的 Steam App ID（480 是 Spacewar 测试 ID）

// Steamworks IAP 商品配置
const STEAM_IAP_ITEMS = [
  { itemId: 'premium_upgrade', name: 'Premium Upgrade', priceUSD: 4.99 },
  { itemId: 'coin_pack_small', name: 'Small Coin Pack', priceUSD: 0.99 },
  { itemId: 'coin_pack_large', name: 'Large Coin Pack', priceUSD: 4.99 },
];

function initSteamworks() {
  try {
    // 使用 steamworks.js (npm package)
    const steam = require('steamworks.js');
    const client = steam.init(STEAM_APP_ID);
    console.log('Steamworks initialized, user:', client.localplayer.getName());
    return client;
  } catch (err) {
    console.warn('Steamworks not available (running outside Steam):', err.message);
    return null;
  }
}

function purchaseItem(client, itemId, onSuccess) {
  if (!client) {
    console.warn('Cannot purchase: Steamworks not initialized');
    return;
  }
  // Steam 微交易通过 Steam Overlay 触发
  // 具体实现依赖于 Steamworks API 版本
  console.log(`Initiating purchase for ${itemId}`);
  if (onSuccess) onSuccess();
}

module.exports = { STEAM_APP_ID, STEAM_IAP_ITEMS, initSteamworks, purchaseItem };
