# 🥤 kele

> **kele** — wudisongshu 的第一个完全由 AI 驱动的个人全方位助手。
> Built entirely with Agentic Engineering. Zero manual code.

## 这是什么？

kele 是一个"无所不能"的个人 AI 助手项目。它不只是代码，它是 vibe-coding 理念的终极实践：

- **你不写一行代码** — 描述意图，AI 实现一切
- **你不写一行文档** — AI 自动生成并维护
- **你只管提需求** — 架构、编码、测试、部署，全部交给 AI

## 🚀 快速开始

```bash
# 克隆项目
git clone git@github.com:wudisongshu/kele.git
cd kele

# 安装依赖
npm install
npm run build

# 告诉 kele 你的想法，它会自动完成从开发到变现的全部工作
npx kele "我要做一个塔防游戏并部署到微信小程序赚钱"
```

## 📁 项目结构

```
kele/                          # CLI 工具源码
├── src/
│   ├── cli/
│   │   └── index.ts         # 🚀 CLI 入口
│   ├── core/
│   │   ├── idea-engine.ts   # 🧠 想法解析引擎
│   │   ├── incubator.ts     # 🥚 项目孵化器
│   │   ├── task-planner.ts  # 📐 任务规划器
│   │   └── executor.ts      # ⚡ 执行调度器
│   ├── adapters/
│   │   ├── mock.ts          # 🧪 Mock AI（零成本测试）
│   │   └── deepseek.ts      # 🤖 DeepSeek 适配器
│   ├── db/
│   │   ├── schema.sql       # 🗄️ SQLite 数据库结构
│   │   └── index.ts         # 💾 状态持久化
│   └── types/
│       └── index.ts         # 📋 核心数据类型
├── tests/                   # ✅ 测试套件
├── skills/                  # 🛠️ AI 行为技能
├── docs/                    # 📚 文档
├── AGENTS.md                # 📜 项目宪法
├── .kimi/KIMI.md            # 🤖 Kimi 配置
├── .cursorrules             # 🎯 Cursor 配置
└── .clinerules/             # ⚡ Cline 配置
```

## 🧠 Vibe-Coding 基础设施

本项目内置了业界最先进的 AI 协作基础设施：

| 组件 | 作用 |
|------|------|
| **AGENTS.md** | 跨工具通用项目宪法，定义架构、安全红线、代码规范 |
| **Memory Bank** | `memory/MEMORY.md` 记录每次会话的决策，AI 下次自动回忆 |
| **Context Template** | `context/CONTEXT.md` 每次会话前更新，AI 立即知道当前状态 |
| **Skills** | 可复用工作流：vibe-coding、Karpathy 原则、Planning、安全基线、代码质量门 |
| **Self-Improvement** | 每次任务后 AI 自动反思，持续优化规则 |

## 🎮 使用方式

### 1. 描述需求（焚诀模板）

```markdown
## Task
我要一个能自动整理日程的模块

## Context
目前项目为空，需要从零搭建

## Requirements
- 必须支持自然语言输入（"明天下午三点开会"）
- 必须能识别并解析时间、地点、人物
- 必须持久化存储到本地 SQLite
- 禁止依赖外部日历 API

## Output
完整的模块代码 + 单元测试 + 使用文档
```

### 2. kele 自动执行

kele 会：
- 🔍 **解析想法**：识别创意类型（游戏/音乐/工具）、变现渠道、复杂度
- 🥚 **孵化子项目**：自动生成开发、部署、上架等子项目
- 📐 **拆解任务**：每个子项目拆解为可执行的具体任务
- ⚡ **智能执行**：简单任务用免费 AI，复杂任务用付费 AI
- 💾 **状态持久**：所有进度保存在本地 SQLite，随时恢复

### 3. 变现完成

你只需关注：
- 想法是否清晰表达
- 关键决策确认（使用 --yes 自动执行）
- 最终审核和收款 💰

## 📖 文档

- [Vibe Coding Playbook](./docs/vibe-coding-playbook.md) — 完整工作流指南
- [Prompt Engineering Guide](./docs/prompt-engineering-guide.md) — 提示词工程手册
- [Architecture Decisions](./docs/adr/) — 架构决策记录

## 🏗️ 设计理念

本项目深受以下理念影响：

> **"先对齐，再动手"** — 焚诀  
> **"Agentic Engineering"** — Andrej Karpathy 2026  
> **"AI 是需要 onboarding 的新同事"** — 不是搜索引擎

## 🤝 贡献

欢迎提交 Issue 和 PR！不过记住：所有代码都应由 AI 生成，人类只负责审查和提出需求。

## 📄 License

[MIT](./LICENSE)

---

> *"The best prompt technique is when you no longer need to think about prompt techniques."* — 焚诀
