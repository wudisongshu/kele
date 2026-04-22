// itch.io Game — 自愿付费（Pay What You Want）和 DLC 配置示例
// itch.io 本身处理支付，此处提供游戏内提示和链接生成

const ITCH_IO_PAGE_URL = 'https://YOUR_USERNAME.itch.io/YOUR_GAME'; // 替换为你的 itch.io 页面

function showSupportPrompt() {
  return {
    title: '支持开发者',
    message: '喜欢这个游戏？考虑在 itch.io 上支持开发者！',
    actions: [
      { label: '去 itch.io 支持', url: ITCH_IO_PAGE_URL },
      { label: '以后再说', url: null },
    ],
  };
}

function generateDownloadLink(version = 'latest') {
  return `${ITCH_IO_PAGE_URL}/download/${version}`;
}

module.exports = { ITCH_IO_PAGE_URL, showSupportPrompt, generateDownloadLink };
