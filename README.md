# Note
Three-Platform Interconnected AI Notes Project Plan

采用 **TypeScript Monorepo + 独立 Web 客户端 + React Native 移动/平板客户端 + Node.js 服务端**。

该方案不是强制三端共用全部 UI，而是共享类型、领域逻辑、API SDK、校验规则、设计变量和编辑器数据协议。在保证原生体验的同时，减少重复开发。

```text
手机/iPad/Android 平板（Expo + React Native）
                       ├── REST/JSON：业务读写与增量同步
Web（Next.js）         ├── WebSocket：变更通知
                       └── SSE：AI 流式输出
                                  │
                         API / AI 服务（NestJS）
                                  │
        MySQL 8.4 LTS / Redis / S3 / Qdrant（P1）
                                  │
                 模型网关（可切换不同 AI 供应商）
```

### 8.2 前端技术

| 范围 | 推荐技术 | 原因 |
| --- | --- | --- |
| 语言 | TypeScript | 三端和服务端共享类型，降低接口不一致 |
| Monorepo | pnpm workspace + Turborepo | 管理 Web、App 和共享包，统一构建与检查 |
| Web | Next.js + React | 适合复杂 Web 交互、流式 AI 和后续官网/管理端扩展 |
| 手机/平板 | Expo + React Native | 一套代码支持 iOS、iPadOS、Android 手机和平板，并具备原生通知与本地能力 |
| 路由 | Next.js App Router、Expo Router | 分别适配 Web 和原生应用的导航模式 |
| 服务端状态 | TanStack Query | 缓存、失效、重试和乐观更新机制成熟 |
| 轻量客户端状态 | Zustand 或同类轻量方案 | 只存界面状态和临时交互状态，避免与服务端缓存重复 |
| 表单/校验 | React Hook Form + Zod | 表单性能良好，校验规则可共享 |
| Web 样式 | Tailwind CSS + 项目组件层 | 快速建立统一设计系统，不在业务页面散落样式常量 |
| 移动端样式 | React Native StyleSheet 或成熟跨端 UI 方案 | 以稳定和无障碍支持为选择标准 |
| 本地数据 | SQLite（App）、IndexedDB（Web） | 支持离线读取、写入和待同步队列 |
| 测试 | Vitest/Jest、React Testing Library、Playwright、移动端 E2E 工具 | 覆盖单元、组件、Web 端到端和移动关键流程 |

编辑器建议以 ProseMirror/Tiptap 兼容的结构化 JSON 作为候选统一格式，并通过适配层在 Web 与移动端复用 schema。正式选型前必须制作原型，验证中文输入法、撤销重做、粘贴、清单、图片、长文性能和跨端内容一致性；编辑器是本项目最高风险模块之一。

### 8.3 服务端技术

| 范围 | 推荐技术 | 原因 |
| --- | --- | --- |
| API 服务 | NestJS（Node.js + TypeScript） | 模块化、类型一致，适合认证、同步和 AI 编排接口 |
| 接口风格 | REST + OpenAPI | 核心 CRUD 和同步易调试、易生成 SDK |
| 实时通道 | WebSocket | 只发送变更通知、在线状态等实时事件 |
| AI 流式输出 | Server-Sent Events（SSE） | 单向流式返回简单稳定，适合文本生成 |
| 主数据库 | MySQL 8.4 LTS（InnoDB） | 事务、关系查询、成熟运维生态和高可用方案适合该业务；统一使用 utf8mb4 |
| 全文检索 | MySQL InnoDB FULLTEXT + ngram parser | MVP 对标题和正文纯文本建立中文全文索引；规模或检索需求提升后再评估独立搜索服务 |
| 向量检索 | Qdrant（P1 按需引入） | 向量与 MySQL 解耦存储，按用户/空间过滤，并可独立扩缩容 |
| 缓存/队列 | Redis + BullMQ | 限流、短期缓存、异步摘要、索引和通知任务 |
| 文件存储 | S3 兼容对象存储 | 管理图片、音频和附件，便于 CDN 与生命周期策略 |
| ORM | Prisma 或 Drizzle | 二选一，在原型阶段按迁移、类型和团队经验验证后确定 |
| 可观测性 | OpenTelemetry + 错误监控平台 | 统一采集日志、指标、链路和客户端崩溃 |

### 8.4 AI 技术方案

增加独立的 AI 编排模块，不让客户端直接调用大模型：

1. **模型网关**：统一封装不同模型供应商，业务层不绑定单一模型。
2. **结构化输出**：任务和日程提取使用 JSON Schema/Zod 校验，失败时重试或要求用户补充信息。
3. **RAG 检索（P1）**：对用户授权范围内的内容分段、生成向量，并按用户/空间过滤后召回。
4. **引用回传**：答案携带内容片段对应的便签 id 和位置，供界面展示来源。
5. **工具调用**：模型只能生成操作建议；真正写入前由服务端再次鉴权、校验，并等待用户确认。
6. **异步任务**：长文索引、OCR、语音转写等进入队列，不阻塞普通请求。
7. **成本治理**：按用户限额、模型路由、上下文裁剪、缓存和用量监控控制费用。
8. **安全防护**：把用户内容视为不可信输入，隔离系统指令与检索内容，限制工具权限和参数范围。

MVP 的当前便签问答直接使用当前便签或用户选中内容作为上下文，不依赖向量数据库；仅在 P1 开启跨便签问答和语义搜索时引入 Qdrant，并在检索层强制按用户或空间过滤。

模型供应商应通过配置切换，可根据部署地区、合规要求、中文效果、上下文长度、延迟、价格和数据保护条款选择，不建议在立项阶段将产品永久绑定到某一个模型。
