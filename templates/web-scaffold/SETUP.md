# 🚀 部署指南

## Step 1: 推送到 GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

## Step 2: 启用 GitHub Pages
- 打开仓库 Settings → Pages
- Source 选择 "GitHub Actions"

## Step 3: 设置 Workflow 权限
- Settings → Actions → General
- Workflow permissions 选择 "Read and write permissions"

## Step 4: 替换 AdSense Placeholder IDs
1. 编辑 `ads.txt`，将 `pub-XXXXXXXXXXXXXXXX` 替换为你的真实 Publisher ID
2. 编辑 `adsense.html`，替换所有 `pub-XXXXXXXXXXXXXXXX` 和 `XXXXXXXXXX`

## Step 5: 添加自定义域名（可选）
- 编辑 `CNAME` 文件，将 `your-domain.com` 替换为你的域名
- 在域名 DNS 添加 CNAME 记录指向 `YOUR_USERNAME.github.io`
