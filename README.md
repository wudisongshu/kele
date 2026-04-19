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

# 告诉 AI 你要什么
# 例如："我要一个能自动整理我日程的模块"
# AI 会：规划 → 实现 → 测试 → 提交 → 生成文档
```

## 📁 项目结构

```
kele/
├── AGENTS.md              # 📜 项目宪法 — AI 的行为准则
├── .kimi/KIMI.md          # 🤖 Kimi Code CLI 专属配置
├── .cursorrules           # 🎯 Cursor 兼容配置
├── .clinerules/           # ⚡ Cline 兼容配置
├── memory/MEMORY.md       # 🧠 跨会话记忆库
├── context/CONTEXT.md     # 📋 当前会话状态
├── skills/                # 🛠️ 可复用技能/工作流
│   ├── vibe-coding.md
│   ├── agentic-engineering.md
│   ├── code-quality.md
│   ├── security.md
│   └── self-improvement.md
├── docs/                  # 📚 自动生成的文档
│   ├── vibe-coding-playbook.md
│   ├── prompt-engineering-guide.md
│   └── adr/               # 架构决策记录
└── src/                   # 💻 源代码（100% AI 生成）
```

## 🧠 Vibe-Coding 基础设施

本项目内置了业界最先进的 AI 协作基础设施：

| 组件 | 作用 |
|------|------|
| **AGENTS.md** | 跨工具通用项目宪法，定义架构、安全红线、代码规范 |
| **Memory Bank** | `memory/MEMORY.md` 记录每次会话的决策，AI 下次自动回忆 |
| **Context Template** | `context/CONTEXT.md` 每次会话前更新，AI 立即知道当前状态 |
| **Skills** | 可复用的工作流模板：vibe-coding、安全基线、代码质量门 |
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

### 2. AI 工作

AI 会自动：
- 进入 Plan Mode，向你确认方案
- 编写代码、测试、文档
- 运行验证，确保通过
- 提交代码，更新记忆库

### 3. 审核 & 迭代

你只需关注：
- 架构设计是否符合预期
- 安全关键路径（认证、数据验证）
- 最终效果是否满足需求

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
