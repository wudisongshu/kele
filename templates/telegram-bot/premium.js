// Telegram Bot — Premium 订阅命令结构示例
// 使用 Stripe / Telegram Stars 进行付费

const PREMIUM_COMMANDS = [
  { command: 'premium', description: '查看 Premium 功能和订阅选项' },
  { command: 'upgrade', description: '升级到 Premium' },
  { command: 'status', description: '查看当前订阅状态' },
];

const PREMIUM_FEATURES = [
  '无限使用次数',
  '优先响应队列',
  '高级数据分析',
  '自定义配置',
];

function isPremium(userId) {
  // TODO: 替换为真实的订阅数据库查询
  // 例如：查询 Stripe 订阅状态或 Telegram Payment 记录
  return false;
}

function checkPremiumOrReply(ctx) {
  if (!isPremium(ctx.from.id)) {
    return ctx.reply(
      '⭐ 这是 Premium 功能。\n请使用 /upgrade 订阅以解锁全部功能。'
    );
  }
  return null;
}

module.exports = {
  PREMIUM_COMMANDS,
  PREMIUM_FEATURES,
  isPremium,
  checkPremiumOrReply,
};
