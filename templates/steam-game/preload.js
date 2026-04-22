const { contextBridge } = require('electron');

// Expose safe Steamworks APIs to the renderer process
// Steamworks.js runs in the main process context via preload
let steamClient = null;
try {
  const steam = require('steamworks.js');
  steamClient = steam.init('480'); // 480 = Spacewar test AppID; replace with yours
} catch {
  // Running outside Steam — safe to ignore
}

contextBridge.exposeInMainWorld('steamworks', {
  isAvailable: () => steamClient !== null,
  getUserName: () => steamClient?.localplayer?.getName() || 'Player',
  getSteamId: () => steamClient?.localplayer?.getSteamId()?.steamId64 || null,
  activateAchievement: (name) => {
    if (steamClient?.achievement) {
      steamClient.achievement.activate(name);
    }
  },
  // IAP is triggered via Steam Overlay — placeholder for future integration
  purchaseItem: (itemId) => {
    console.log(`[Steam] Purchase initiated for ${itemId}`);
    // Real implementation: steamClient.microTxn... or overlay URL
  },
});
