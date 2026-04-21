# 🚀 Android 游戏部署指南

## 方案 A: WebView 打包（最简单）
1. 使用 Android Studio 创建新项目
2. 在 `assets/` 目录放入游戏文件
3. 使用 WebView 加载 `index.html`
4. 构建 APK 并上传 Google Play

## 方案 B: Cordova / Capacitor
```bash
npm install -g cordova
cordova create my-game com.example.mygame MyGame
cd my-game
cordova platform add android
cp -r ../www/* www/
cordova build android --release
```

## 💰 变现
- AdMob 广告集成
- Google Play 内购
- 付费下载
