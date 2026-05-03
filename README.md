# ImageAll / 双语说明

> EN: A multilingual image workbench for generating, editing, and comparing images across providers — without flattening their differences.  
> 中文：一个多语言图像工作台，用统一但诚实的方式连接多个图像生成/编辑 provider，而不是把它们强行抹平。

---

## English

### What is ImageAll?

ImageAll is an opinionated open-source image workbench.

It is built around a few strong ideas:

- one coherent workbench shell
- honest multi-provider adaptors
- complete i18n as an architectural concern
- artifact / run oriented workflows
- a calm, layered visual language with personality

ImageAll is **not** trying to become:

- a universal wrapper over every provider
- a node-graph system like ComfyUI
- a SaaS platform
- a lowest-common-denominator “all models look the same” UI

The goal is a **beautiful, multilingual, provider-aware image workbench**.

---

### Current status

The repository is already beyond the docs-only phase.

Current implementation includes:

- Bun workspace monorepo
- `apps/web` — Vue 3 + Vite workbench UI
- `apps/server` — ElysiaJS API host
- `packages/core` — shared domain model, provider manifests, adaptor contracts
- real adaptor implementations for:
  - MiniMax
  - StepFun

It is still an early prototype, but it is already usable as a **minimal workbench for adaptor testing**.

---

### Features available now

- bilingual UI foundation (`en`, `zh-CN`)
- provider / model switching
- generate / edit operation switching
- provider-specific options in the inspector
- API key input in the WebUI
- source image upload for edit flows
- server-side `prepare -> execute` run flow
- live output preview in the stage panel

---

### How to use

#### 1. Install dependencies

```bash
bun install
```

#### 2. Start the server

```bash
bun run --cwd apps/server dev
```

Optional environment variables:

- `MINIMAX_API_KEY`
- `STEPFUN_API_KEY`
- `IMAGEALL_PORT` (default: `3001`)

You may either:

- set provider keys in the server environment, or
- paste them into the WebUI at runtime

#### 3. Start the web app

```bash
bun run --cwd apps/web dev
```

If needed, set the API base URL:

```bash
VITE_API_BASE_URL=http://localhost:3001
```

#### 4. Test StepFun Plan adaptor in the WebUI

Recommended minimal path:

1. Select **StepFun Plan** as provider
2. Select a model such as:
   - `step-image-edit-2` for text-aware edit
   - `step-1x-edit` for multipart edit
   - `step-1x-medium` for generation / image2image
3. Paste your **StepFun API key** into the inspector
4. If using edit mode, upload a source image
5. Write a prompt
6. Click **Prepare & run**
7. Inspect:
   - execution plan summary
   - runtime message / error
   - live output preview in the stage panel

> Note: `stepfun-plan` image support is currently enabled for testing against observed behavior. StepFun's official docs do **not** currently document image endpoints under `/step_plan/v1`, so compatibility may change without notice.

---

### Development commands

```bash
bun run typecheck
bun run test
bun run build
```

These currently pass in the repository.

---

### Document map

- [`MANIFESTO.md`](./MANIFESTO.md) — project thesis, anti-goals, taste boundaries
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — object model, adaptor architecture, shell layout
- [`PLAN.md`](./PLAN.md) — foreseeable roadmap

---

## 中文

### ImageAll 是什么？

ImageAll 是一个有明确立场的开源图像工作台。

它关注的是这几件事：

- 一个统一且完整的工作台壳层
- 诚实的多 provider adaptor
- 从第一天开始就完整支持 i18n
- 围绕 artifact / run 的工作流
- 有个人风格、克制而有层次的界面语言

ImageAll **不打算**做成：

- 一个“万物皆可接”的万能壳子
- 像 ComfyUI 那样的节点图系统
- SaaS 平台
- 一个把所有模型强行说成一样的通用面板

它更像是一个：

**好看、可扩展、多语言、但不说谎的图像工作台。**

---

### 当前状态

这个仓库已经不只是文档仓库了。

目前已经有：

- Bun workspace monorepo
- `apps/web`：Vue 3 + Vite 的 workbench UI
- `apps/server`：ElysiaJS API host
- `packages/core`：共享对象模型、provider manifest、adaptor contract
- 两个真实 adaptor：
  - MiniMax
  - StepFun

它仍然是早期原型，但已经可以作为一个**最小可用的 adaptor 测试工作台**来使用。

---

### 目前可用的能力

- 中英双语 UI 基础
- provider / model 切换
- generate / edit 操作切换
- inspector 中显示 provider 专属参数
- WebUI 中直接输入 API key
- edit 流程支持上传源图
- server 端 `prepare -> execute` 运行链路
- 中间舞台支持显示实时返回结果

---

### 如何使用

#### 1. 安装依赖

```bash
bun install
```

#### 2. 启动 server

```bash
bun run --cwd apps/server dev
```

可选环境变量：

- `MINIMAX_API_KEY`
- `STEPFUN_API_KEY`
- `IMAGEALL_PORT`（默认 `3001`）

你可以二选一：

- 在 server 环境变量里配置 API key
- 或者在 WebUI 的 inspector 里临时输入

#### 3. 启动 WebUI

```bash
bun run --cwd apps/web dev
```

如果需要，显式指定 API 地址：

```bash
VITE_API_BASE_URL=http://localhost:3001
```

#### 4. 在 WebUI 里测试 StepFun Plan adaptor

建议的最小测试路径：

1. 选择 **StepFun Plan** provider
2. 选择模型，例如：
   - `step-image-edit-2`：适合文字感更强的编辑
   - `step-1x-edit`：multipart 编辑流
   - `step-1x-medium`：生成 / image2image
3. 在 inspector 中填入 **StepFun API key**
4. 如果是 edit 模式，上传一张源图
5. 写 prompt
6. 点击 **Prepare & run / 准备并执行**
7. 查看：
   - execution plan 摘要
   - 运行消息 / 错误
   - 中间舞台中的实时输出结果

> 说明：当前 `stepfun-plan` 的图像支持是基于现阶段可观察行为做的测试接入。StepFun 官方文档目前**没有正式文档化** `/step_plan/v1` 下的图像 endpoint，因此兼容性后续可能变化。

---

### 开发命令

```bash
bun run typecheck
bun run test
bun run build
```

这些命令当前都已经通过。

---

### 文档索引

- [`MANIFESTO.md`](./MANIFESTO.md) — 项目 thesis、anti-goals、审美边界
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — 对象模型、adaptor 架构、工作台布局
- [`PLAN.md`](./PLAN.md) — 可预见未来计划
