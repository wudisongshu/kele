# 🚀 iOS 游戏部署指南

## 方案 A: WKWebView 打包（最简单）
1. 使用 Xcode 创建新项目
2. 将游戏文件放入项目 `Resources/`
3. 使用 WKWebView 加载 `index.html`
4. 构建并上传 App Store Connect

## 方案 B: Capacitor
```bash
npm install -g @capacitor/cli
npm install @capacitor/core @capacitor/ios
npx cap init MyGame com.example.mygame --web-dir .
npx cap add ios
npx cap open ios
# 在 Xcode 中签名并构建
```

## 方案 C: Cordova
```bash
npm install -g cordova
cordova create my-game com.example.mygame MyGame
cd my-game
cordova platform add ios
cp -r ../www/* www/
cordova build ios --release
```

## 💰 变现
- AdMob 广告集成
- App Store 内购
- 付费下载
- Apple Arcade（需申请）

## ⚠️ 注意事项
- 需要 Apple Developer 账号（$99/年）
- 需通过 App Store 审核
- 遵守 App Store 审核指南（尤其是内购必须使用 Apple 支付）
