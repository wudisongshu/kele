# 🤖 Discord Bot 部署指南

## Step 1: 创建 Discord 应用
1. 访问 https://discord.com/developers/applications
2. 点击 "New Application"，输入应用名称
3. 进入 "Bot" 标签页，点击 "Add Bot"
4. 复制 Bot Token（这就是 DISCORD_BOT_TOKEN）

## Step 2: 配置权限
1. 在 "OAuth2" → "URL Generator" 中：
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: `Send Messages`, `Read Message History`
2. 复制生成的 URL，在浏览器中打开，邀请 Bot 加入你的服务器

## Step 3: 本地运行
```bash
npm install
cp .env.example .env
# 编辑 .env，填入 DISCORD_BOT_TOKEN
npm start
```

## Step 4: 部署到服务器（可选）
- Railway: `railway up`
- Render: 连接 GitHub 仓库自动部署
- VPS: 使用 `pm2 start index.js`

## 💰 变现方式
- Patreon 订阅 Premium 功能
- 内置订阅系统（Stripe/PayPal）
- 捐赠链接（Ko-fi / Buy Me a Coffee）
