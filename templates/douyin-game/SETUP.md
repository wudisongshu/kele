# 🚀 抖音小游戏部署指南

## Step 1: 注册开发者账号
- 访问 [抖音开放平台](https://developer.open-douyin.com/)
- 注册并认证小游戏开发者账号
- 创建小游戏，获取 AppID

## Step 2: 安装字节跳动开发者工具
- 下载 [开发者工具](https://developer.open-douyin.com/docs/resource/zh-CN/mini-game/introduction/plugin/ide)
- 使用抖音账号登录

## Step 3: 配置项目
1. 打开开发者工具，选择「导入项目」
2. 选择本项目目录
3. 填入你的 AppID（从开放平台获取）
4. `project.config.json` 中的 `appid` 需要替换为你的真实 AppID

## Step 4: 配置广告位
1. 登录 [穿山甲广告平台](https://www.pangle.cn/)
2. 创建广告位，获取广告位 ID
3. 编辑 `monetization.js`，替换 `PLACEHOLDER_*_AD_UNIT_ID`

## Step 5: 上传与审核
1. 开发者工具中点击「上传」
2. 在开放平台提交审核
3. 审核通过后发布上线

## 注意事项
- 抖音小游戏 Canvas API 使用 `tt.createCanvas()`
- 文件大小限制：主包 4MB，总包 20MB
- 需遵守《抖音小游戏内容审核规范》
