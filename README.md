# 🥤 kele — 想法→变现 AI 助手

> **不是编程助手，是生意助手。**
>
> 你说一句话，kele 帮你变成一个能赚钱的产品。

```bash
kele "做一个像牛牛消消乐那样的游戏，部署到抖音小游戏赚钱"
```

kele 会：
1. 🔍 **研究** — 分析竞品、变现模式、目标受众
2. 🥚 **孵化** — 拆成可执行的子项目（开发→测试→发布）
3. 🤖 **执行** — 调用 AI 写代码、写配置、写文档
4. 🔄 **升级** — 你对结果不满意？一句话改画面、改规则、改平台

---

## 与编程助手的区别

| | OpenClaw / Cursor | **kele** |
|---|---|---|
| **定位** | 帮你写代码 | 帮你赚钱 |
| **输入** | "帮我写一个排序算法" | "做一个塔防游戏部署微信赚钱" |
| **输出** | 代码片段 | 完整可运行的产品 + 发布方案 |
| **迭代** | 改代码 | 改产品（画面、规则、平台） |
| **持久化** | 单次会话 | SQLite 项目历史，随时升级 |

kele 不关心你用什么技术栈，只关心你的东西能不能上线、能不能变现。

---

## 快速开始

### 1. 安装

```bash
npm install -g kele
```

### 2. 配置 AI（任选一个）

```bash
# Kimi Code（推荐，代码能力强）
kele config --provider kimi-code --key <你的key> --url https://api.kimi.com/coding/v1 --model kimi-for-coding

# DeepSeek（免费额度多）
kele config --provider deepseek --key <你的key> --url https://api.deepseek.com/v1 --model deepseek-chat

# 通义千问
kele config --provider qwen --key <你的key> --url https://dashscope.aliyuncs.com/compatible-mode/v1 --model qwen-turbo
```

### 3. 创建项目

```bash
# 基础用法
kele "做一个塔防游戏并部署到微信小程序赚钱"

# 自动执行所有任务（跳过确认）
kele "做一个像牛牛消消乐那样的游戏" --yes

# 指定输出目录
kele "帮我写一首歌并发布到音乐平台" --output ~/my-music
```

### 4. 不满意？升级它

```bash
# 查看项目和任务
kele list
kele show <project-id>

# 升级某个任务
kele upgrade <project-id> <task-id> "把画面改成像素风"
kele upgrade <project-id> <task-id> "增加多人对战模式"
kele upgrade <project-id> <task-id> "从抖音小游戏改成微信小程序"
```

---

## 核心能力

### 🔍 商业研究
检测到模糊需求或竞品引用时，自动启动研究：
- 产品定位分析
- 变现模式设计（广告/订阅/IAP）
- 平台选择建议（微信/抖音/Steam/网页）
- MVP 功能建议

### 🥚 智能孵化
根据复杂度自动调整子项目数量：
- **简单**：Setup + 开发
- **中等**：+ 测试
- **复杂**：+ 部署 + 变现配置

### 🤖 AI 执行
- 自动选择最佳 AI 提供商
- 代码质量约束（模块化、类型安全、错误处理）
- 失败自动重试 + fallback
- 每个任务 30 分钟超时，整体 3 小时

### 🔄 持续迭代
- 任务版本管理（v1 → v2 → v3）
- 保留历史代码上下文
- 只改该改的，不动不该动的

---

## 支持的变现平台

| 平台 | 状态 |
|---|---|
| 微信小程序 | ✅ 模板 + 配置 |
| 抖音小游戏 | ✅ 模板 + 配置 |
| 网页 (PWA) | ✅ 模板 + 配置 |
| Steam | 🚧 开发中 |
| App Store | 🚧 开发中 |
| Google Play | 🚧 开发中 |

---

## 技术栈

- TypeScript + Node.js
- SQLite（better-sqlite3）项目状态持久化
- OpenAI-compatible API（Kimi / DeepSeek / Qwen / OpenAI）
- Commander.js CLI

---

## License

MIT
