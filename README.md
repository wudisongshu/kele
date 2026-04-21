# 🥤 kele — 想法→变现 AI 工作流引擎

> **不是编程助手，是生意助手。**
>
> 你说一句话，kele 帮你变成一个能赚钱的产品。

```bash
kele "做一个像牛牛消消乐那样的游戏，部署到抖音小游戏赚钱"
```

kele 会：
1. 🔍 **研究** — 分析竞品、变现模式、目标受众
2. 🧠 **AI 设计** — AI 动态决定项目结构（不是硬编码模板）
3. 🤖 **执行** — 调用 AI 写完整可运行代码（不是空壳）
4. ✅ **验证** — 自动检测 stub/TODO/空函数/游戏可玩性
5. 📦 **发布准备** — 告诉你需要什么材料、怎么配置
6. 🔄 **升级** — 一句话改画面、改规则、改平台

---

## 与编程助手的区别

| | Cursor / Copilot | **kele** |
|---|---|---|
| **定位** | 帮你写代码 | 帮你赚钱 |
| **输入** | "帮我写一个排序算法" | "做一个塔防游戏部署微信赚钱" |
| **输出** | 代码片段 | 完整可运行的产品 + 发布方案 |
| **交互** | 命令式 | 自然语言（像和助手说话） |
| **持久化** | 单次会话 | SQLite 项目历史，随时继续 |
| **验证** | 不验证 | 自动验证代码质量 + 游戏可玩性 |

kele 不关心你用什么技术栈，只关心你的东西能不能上线、能不能变现。

---

## 快速开始

### 1. 安装

```bash
npm install -g kele
```

### 2. 配置 AI（任选一个）

```bash
# Kimi Code（推荐，代码能力最强）
kele config --provider kimi-code --key <your-key> --url https://api.kimi.com/coding/v1 --model kimi-for-coding

# DeepSeek（免费额度多，推荐作为备用）
kele config --provider deepseek --key <your-key> --url https://api.deepseek.com/v1 --model deepseek-chat

# 通义千问
kele config --provider qwen --key <your-key> --url https://dashscope.aliyuncs.com/compatible-mode/v1 --model qwen-turbo

# Kimi（普通版）
kele config --provider kimi --key <your-key> --url https://api.moonshot.cn/v1 --model moonshot-v1-128k

# 查看已配置的 providers
kele config --list
```

### 3. 创建项目

```bash
# 基础用法 — kele 会询问确认，按回车继续
kele "做一个塔防游戏并部署到微信小程序赚钱"

# 自动执行所有任务（跳过确认）
kele "做一个像牛牛消消乐那样的游戏" --yes

# Mock 模式快速测试（无需 API Key，5 秒出结果）
kele "做一个贪吃蛇游戏" --mock --yes

# 预览将要执行的操作（不实际运行 AI）
kele "做一个塔防游戏" --dry-run
```

### 4. 卡住了？按 Ctrl+C 安全退出

```bash
kele "做一个大型 RPG 游戏"
# ... 执行中 ...
# 按 Ctrl+C
# ⏹️  收到中断信号，正在安全退出...
#    当前任务状态已保存到数据库
#    之后可以用 kele "继续" 或 kele "接着干" 恢复
```

---

## CLI 命令大全

### 主命令

```bash
kele "你的想法"                          # 创建/管理项目
kele "你的想法" --yes                    # 跳过确认自动执行
kele "你的想法" --mock --yes             # Mock 模式快速测试
kele "你的想法" --dry-run                # 预览操作不执行
kele "你的想法" --debug                  # Debug 模式查看完整 prompt
kele "你的想法" --timeout 600            # 设置 AI 超时时间为 10 分钟
kele "你的想法" --json                   # JSON 输出（适合 CI/CD）
kele "你的想法" --quiet                  # 抑制非错误输出
```

### 项目管理

```bash
kele list                              # 列出所有项目
kele show <project-id>                 # 查看项目详情和任务状态
kele search <关键词>                    # 按名称/关键词搜索项目
kele delete <project-id>               # 删除项目
kele export <project-id> [dir]         # 导出项目文件 + 元数据
kele init [dir]                        # 初始化现有目录为 kele 项目
kele validate <project-id>             # 验证项目质量并输出评分
```

### 任务管理

```bash
kele upgrade <project-id> <task-id> "改成像素风格"
kele upgrade <project-id> <task-id> "改成像素风格" --timeout 600
kele retry <project-id> <task-id>      # 重试失败的任务
kele retry <project-id> <task-id> --mock  # Mock 模式重试
```

### 配置与诊断

```bash
kele config --list                     # 查看已配置的 providers
kele config --provider <name> --key <key> --url <url> --model <model>
kele config --default <name>           # 设置默认 provider
kele config --remove <name>            # 移除 provider
kele config --auto-yes                 # 开启免确认模式
kele secrets --platform <name> --set key=val
kele doctor                            # 诊断环境和配置问题
kele clean                             # 清理旧日志和临时文件
kele logs                              # 查看执行日志
kele stats                             # 查看项目统计
```

### 自然语言管理（无需记命令）

```bash
# 继续上次中断的项目
kele "继续"
kele "接着干"
kele "接着弄那个游戏"

# 查看进度
kele "项目怎么样了"
kele "进度如何"

# 本地运行
kele "怎么运行"
kele "本地启动"

# 升级任务
kele "上次那个消消乐改成动物主题"
kele "把塔防游戏增加多人对战"

# 配置 AI provider
kele "配置 DeepSeek"

# 随便聊
kele "这个游戏怎么赚钱"
```

---

## 核心能力

### 🔍 商业研究
检测到模糊需求或竞品引用时，自动启动研究：
- 产品定位分析
- 变现模式设计（广告/订阅/IAP）
- 平台选择建议（微信/抖音/Steam/网页/Discord/Telegram）
- MVP 功能建议

### 🧠 AI 驱动孵化器
**AI 根据你的具体输入动态设计项目结构**，不是硬编码的 simple/medium/complex：

```
kele "做个网页版俄罗斯方块"
→ AI: "用户只想本地玩，不需要发布 → setup + dev"

kele "做个消消乐发布到微信小程序赚钱"
→ AI: "用户要发布+变现 → setup + dev + testing + deployment + monetization"

kele "做一个 Discord 机器人"
→ AI: "bot 项目 → bot-setup + bot-dev + bot-test + deployment + monetization"
```

AI 决策失败时，自动 fallback 到本地规则。

### 🛡️ 多层代码质量验证
AI 写完代码后，kele 自动执行多层验证：

| 验证层级 | 检测内容 | 不通过时 |
|---|---|---|
| **静态检查** | TODO / FIXME / stub / 空函数 / 未完成代码 | 标记任务失败 |
| **文件大小** | 单文件超过 5MB 自动截断（防止 AI 幻觉） | 截断并警告 |
| **HTML 修复** | 自动移除 crossorigin、转换绝对路径、移动 script 到 body 末尾、添加 base href | 自动修复 |
| **浏览器验证** | Canvas 是否存在、游戏循环、输入处理器、JS 错误 | 输出评分 0-100 |
| **游戏验证** | 分数显示、重新开始、游戏结束、触摸/键盘支持 | 影响可玩性评分 |

### 🤖 AI 执行引擎
- **智能路由**：根据任务复杂度自动选择最佳 AI provider
- **指数退避重试**：网络超时/5xx 错误时自动重试（1s → 2s → 4s），最多 3 次
- **代码质量约束**：模块化、类型安全、错误处理、禁止空壳
- **超时保护**：默认 30 分钟，可自定义 `--timeout`
- **安全中断**：Ctrl+C 优雅退出，自动保存状态

### 📦 发布准备
- **idea 解析后立即输出发布洞察**：需要什么材料、多长时间、什么账号
- **项目完成后输出发布清单**：带 checkbox 的步骤列表
- **平台知识库**：每个平台的详细发布流程、所需材料、预计时间
- **缺少凭证时提示配置**：`kele secrets --platform <name> --set key=val`

### 🔄 持续迭代
- 任务版本管理（v1 → v2 → v3）
- Diff-aware 升级：读取文件系统当前状态，只改该改的
- 保留历史代码上下文
- 自然语言升级：`kele "把画面改成像素风"`

### ⚡ 并发执行
子项目按依赖层级分组，同层级并行执行：
```
Level 0: [project-setup]              → 串行
Level 1: [core-dev, game-dev]         → 并行
Level 2: [testing, deployment]        → 并行
Level 3: [monetization]               → 串行
```

---

## 支持的变现平台

| 平台 | 需要软著？ | 需要版号？ | 适合个人？ | 成本 |
|---|---|---|---|---|
| **H5 网页** | ❌ 不需要 | ❌ 不需要 | ✅ 最适合 | 域名 ~50元/年 |
| **Google Play** | ❌ 不需要 | ❌ 不需要 | ✅ 适合 | $25 一次性 |
| **App Store（国际）** | ❌ 不需要 | ❌ 不需要 | ✅ 适合 | $99/年 |
| **Steam** | ❌ 不需要 | ❌ 不需要 | ✅ 适合 | $100/游戏 |
| **微信小程序** | ✅ 需要 | ❌ 纯广告不需要 | ⚠️ 需软著 | 认证 300元/年 |
| **抖音小游戏** | ✅ 需要 | ❌ 纯广告不需要 | ⚠️ 需软著 | 免费 |
| **Discord Bot** | ❌ 不需要 | ❌ 不需要 | ✅ 适合 | 免费 |
| **Telegram Bot** | ❌ 不需要 | ❌ 不需要 | ✅ 适合 | 免费 |

### ⚠️ 重要：AI 代码与软著合规

**2026年3月起**，中国版权保护中心新版软著申请表明确规定：
> 申请人不得使用 AI 编写代码，违者纳入征信记录。

这意味着：
1. **微信/抖音小游戏上架必须软著，软著必须人工代码**
2. **kele 生成的代码不能直接用于软著申请**
3. **但你不需要放弃** — kele 帮你生成原型，你在上面做实质性人工改造即可

**解决方案：**

| 路线 | 做法 | 时间 |
|---|---|---|
| 🚀 **快速变现（推荐新手）** | 部署为 H5 网页游戏，接广告联盟，无需任何资质 | 当天上线 |
| 🌍 **国际路线** | 上架 Google Play / App Store 国际版，不需要软著 | 1-2 周 |
| 🤖 **Bot 路线** | Discord/Telegram Bot，零门槛，Premium 订阅变现 | 当天上线 |
| 🇨🇳 **国内正规路线** | kele 生成原型 → 自己重写核心代码 → 申请软著 → 上架微信/抖音 | 2-3 个月 |

**kele 的定位是"原型加速器"** — 帮你把想法变成可运行的原型（省 80% 时间），剩下的 20%（软著合规、核心算法重写、独特设计）由你完成。

---

## Mock 模式（无需 API Key 快速测试）

```bash
kele "做一个贪吃蛇游戏" --mock --yes
```

Mock 模式使用内置的 canned response，零成本、零延迟，适合：
- 测试 kele 工作流
- 演示 kele 功能
- 没有 API Key 时快速体验

**Mock 模式支持的游戏类型：**
- match3（消消乐）
- snake（贪吃蛇）
- breakout（打砖块）
- pong（乒乓球）
- tetris（俄罗斯方块）
- flappy（像素鸟）

**Mock 模式支持的 incubation 类型：**
- 游戏项目（game-setup + game-core + game-ui + deployment + monetization）
- 小程序项目（mp-setup + mp-core + mp-deploy + monetization）
- 工具项目（tool-setup + tool-core + tool-ui + deployment + monetization）
- 标准 Web 项目（setup + dev + testing + deployment + monetization）

---

## 技术栈

- **TypeScript + Node.js**（ESM）
- **SQLite**（better-sqlite3）项目状态持久化
- **OpenAI-compatible API**（Kimi / DeepSeek / Qwen / OpenAI）
- **JSDOM** 浏览器验证（无需 headless Chrome）
- **AI 驱动决策**（孵化器、任务拆分、意图识别）
- **多层安全**（路径遍历保护、敏感文件过滤、prompt 注入防护）

---

## License

MIT
