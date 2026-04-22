// Discord Bot — Premium 订阅命令结构示例
// 使用 Stripe/Patreon 进行付费订阅管理

const PREMIUM_COMMANDS = {
  name: 'premium',
  description: '管理 Premium 订阅',
  options: [
    {
      name: 'status',
      description: '查看当前订阅状态',
      type: 1, // SUB_COMMAND
    },
    {
      name: 'upgrade',
      description: '升级到 Premium',
      type: 1,
    },
    {
      name: 'features',
      description: '查看 Premium 功能列表',
      type: 1,
    },
  ],
};

const PREMIUM_FEATURES = [
  '无限使用次数',
  '优先响应队列',
  '高级数据分析',
  '自定义配置',
];

function isPremium(userId) {
  // TODO: 替换为真实的订阅数据库查询
  // 例如：查询 Stripe 订阅状态或 Patreon 会员等级
  return false;
}

function checkPremiumOrReply(interaction) {
  if (!isPremium(interaction.user.id)) {
    return interaction.reply({
      content: '⭐ 这是 Premium 功能。请使用 `/premium upgrade` 订阅。',
      ephemeral: true,
    });
  }
  return null;
}

module.exports = {
  PREMIUM_COMMANDS,
  PREMIUM_FEATURES,
  isPremium,
  checkPremiumOrReply,
};
