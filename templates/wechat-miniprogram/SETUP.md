# 🚀 微信小游戏部署指南

## Step 1: 注册小程序/小游戏账号
- 访问 [微信公众平台](https://mp.weixin.qq.com/)
- 注册小游戏账号（需企业/个体工商户认证才能接入广告）
- 在「开发」→「开发管理」中获取 AppID

## Step 2: 安装微信开发者工具
- 下载 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
- 使用微信扫码登录

## Step 3: 配置项目
1. 打开开发者工具，选择「导入项目」
2. 选择本项目目录
3. 填入你的 AppID（从微信公众平台获取）
4. `project.config.json` 中的 `appid` 需要替换为你的真实 AppID

## Step 4: 配置广告位
1. 登录 [微信广告助手](https://ad.weixin.qq.com/)
2. 创建广告位，获取广告单元 ID
3. 编辑 `wechat-ad-init.js`，替换 `adunit-xxxxxxxxxxxxxxxx`

## Step 5: 上传与审核
1. 开发者工具中点击「上传」→ 填写版本号和备注
2. 在微信公众平台「版本管理」中提交审核
3. 审核通过后点击「发布」

## 注意事项
- 微信小游戏使用 `wx.createCanvas()` 创建画布
- 主包大小限制 4MB，总包 20MB
- 激励视频广告需要用户主动触发
- 个人主体小游戏不支持广告变现
