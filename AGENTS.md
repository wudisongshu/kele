# AGENTS.md — kele Project Constitution

> kele 是 wudisongshu 的第一个完全由 vibe-coding / agentic-engineering 驱动的个人全方位 AI 助手项目。
> 本项目代码、文档、测试、部署全部由 AI 生成，人类只负责意图表达和架构监督。

## Project Identity

| Key | Value |
|-----|-------|
| **Name** | kele |
| **Author** | wudisongshu |
| **Email** | 1572699677@qq.com |
| **Philosophy** | Agentic Engineering — 人类是架构师，AI 是执行者 |
| **Constraint** | 用户不手动编写任何代码、文档或配置文件 |

## Core Principles

1. **Intent-Driven Development**: 只描述要什么，不描述怎么做
2. **Zero Manual Coding**: 所有代码由 AI 生成、修改、重构
3. **Zero Manual Docs**: 所有文档由 AI 根据代码和决策自动生成
4. **Test-First**: 新功能必须先有测试，AI 再实现代码
5. **Frequent Commits**: 每个功能点完成后立即提交，描述性消息标注 AI 生成部分
6. **Review Critical Paths**: 认证、支付、数据验证等高危模块必须人工确认
7. **Self-Improving**: AI 应根据每次交互反馈优化 `.clinerules` / `AGENTS.md` / `skills`

## Architecture Rules

- 模块化设计，每个模块有单一职责
- 优先使用 TypeScript / Python（根据具体模块决定）
- API 优先设计，文档自动生成
- 所有配置通过环境变量管理，禁止硬编码密钥
- 数据库变更必须通过迁移脚本

## Code Quality Standards

- 所有公共函数必须有 JSDoc / docstring
- 测试覆盖率：核心业务逻辑 >= 80%
- 错误处理：绝不暴露原始堆栈给终端用户
- 日志：结构化日志，包含 request_id
- 命名：语义化，避免缩写

## Security Red Lines

- 禁止在提示词中粘贴任何凭证或 token
- 禁止提交 `.env` 文件到 Git
- 禁止在日志中输出敏感信息
- 所有外部输入必须经过验证和消毒
- 使用参数化查询，禁止字符串拼接 SQL

## Communication Protocol

- AI 是"需要 onboarding 的新同事"，不是搜索引擎
- **先对齐，再动手**：任何任务开始前先确认理解
- 复杂任务必须进入 Plan Mode，获得用户确认后再执行
- 使用子代理进行探索性工作（读代码、查文档），保持主线程 Context 清洁

## File Organization

```
kele/
├── AGENTS.md              # 项目宪法（本文件）
├── .kimi/KIMI.md          # Kimi Code CLI 行为配置
├── .cursorrules           # Cursor 兼容
├── .clinerules/           # Cline 兼容
├── memory/MEMORY.md       # 跨会话决策日志（append-only）
├── context/CONTEXT.md     # 当前会话状态
├── skills/                # 可复用技能/工作流
├── docs/                  # 自动生成 + 架构文档
└── src/                   # 源代码（AI 生成）
```
