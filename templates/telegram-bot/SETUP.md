# 🤖 Telegram Bot 部署指南

## Step 1: 创建 Bot
1. 在 Telegram 搜索 @BotFather
2. 发送 `/newbot`
3. 按提示输入 bot 名称和用户名
4. 复制返回的 Bot Token（格式：123456:ABC-DEF...）

## Step 2: 本地运行
```bash
npm install
cp .env.example .env
# 编辑 .env，填入 TELEGRAM_BOT_TOKEN
npm start
```

## Step 3: 部署到服务器
- Railway: `railway up`
- Render: 连接 GitHub 仓库自动部署
- 使用 Webhook 模式（推荐生产环境）：
  ```js
  const bot = new TelegramBot(token, { webHook: { port: process.env.PORT } });
  bot.setWebHook(`https://your-app.com/bot${token}`);
  ```

## 💰 变现方式
- Telegram Ads 推广
- Premium 功能订阅（Stripe / TON）
- 捐赠（TON 钱包）
