// Steam Game — Steamworks monetization (renderer-safe via preload)
// Replace '480' in preload.js with your real Steam App ID

const STEAM_APP_ID = '480';

const STEAM_IAP_ITEMS = [
  { itemId: 'premium_upgrade', name: 'Premium Upgrade', priceUSD: 4.99 },
  { itemId: 'coin_pack_small', name: 'Small Coin Pack', priceUSD: 0.99 },
  { itemId: 'coin_pack_large', name: 'Large Coin Pack', priceUSD: 4.99 },
];

function initSteamworks() {
  if (typeof window !== 'undefined' && window.steamworks) {
    const available = window.steamworks.isAvailable();
    console.log('[Steam] Steamworks available:', available);
    return available ? window.steamworks : null;
  }
  console.warn('[Steam] Steamworks preload not available');
  return null;
}

function purchaseItem(steam, itemId, onSuccess) {
  if (!steam) {
    console.warn('[Steam] Cannot purchase: Steamworks not initialized');
    return;
  }
  steam.purchaseItem(itemId);
  if (onSuccess) onSuccess();
}

function unlockAchievement(steam, name) {
  if (steam) {
    steam.activateAchievement(name);
  }
}

// Expose globally for inline scripts
if (typeof window !== 'undefined') {
  window.STEAM_APP_ID = STEAM_APP_ID;
  window.STEAM_IAP_ITEMS = STEAM_IAP_ITEMS;
  window.initSteamworks = initSteamworks;
  window.purchaseItem = purchaseItem;
  window.unlockAchievement = unlockAchievement;
}
