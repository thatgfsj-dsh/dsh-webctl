# 架构与流程图

本文用 Mermaid 描述 dsh-webctl 的结构、启动时序、状态采集、工具调用与降级回退决策。
图与代码的实际关系：**工具注册与调用走官方 MCP 客户端；本插件只做诊断、观测与展示。**

## 1. 组件与数据流

```mermaid
flowchart LR
    subgraph DSH[DeepSeek Harness 宿主]
        UI[设置页 webctl 面板]
        API[GET /api/dsh-webctl/status]
        P[dsh-webctl 宿主插件]
        M[官方 mcp-client 行<br/>serverName=webctl]
        T[ctx.tools 工具表]
        D[(降级记录 20 条<br/>内存环缓冲)]
    end
    W[webctl 可执行文件]
    S[(webctl session 状态<br/>~/.webctl 或 WEBCTL_STATE_DIR)]
    PW[Playwright 安装与浏览器缓存]

    UI --> API --> P
    P -- "--version / caps --json" --> W
    P -- "一次性 MCP 握手" --> W
    P -- "只读 package.json / 缓存目录" --> PW
    M -- "stdio: webctl mcp" --> W
    M --> T
    P -. "tools.definitions() 只读" .-> T
    T -. "tools/result 事件" .-> P
    P --> D
    W --- S
```

- 宿主插件只用 Node 内置模块，不 import 任何 `@deepseek-ai/*` 包，避免依赖解析失败导致的静默不加载。
- 工具名固定为 `mcp__webctl__<rawName>`，由官方桥接层生成；插件不硬编码、也不改写。

## 2. 启动时序

```mermaid
sequenceDiagram
    autonumber
    participant L as DSH Loader
    participant P as dsh-webctl
    participant M as mcp-client(webctl)
    participant W as webctl
    participant T as ctx.tools

    L->>P: apply(ctx, config)
    P->>P: 注册 /api/dsh-webctl/* 与 tools/result 监听
    P->>P: 2.5s 后预热状态缓存
    L->>M: apply(ctx, config)
    M->>W: spawn webctl mcp
    M->>W: initialize → notifications/initialized → tools/list
    W-->>M: 18 个工具
    M->>T: 注册 mcp__webctl__*
    Note over P,T: 之后状态页可对比 caps 与已注册工具，发现漂移
```

> DSH 可能先起探测进程再起服务进程；webctl 不在启动时抢独占锁，因此两个实例可并发。
> `tests/contract.test.mjs` 用真实二进制验证了这一点。

## 3. 状态采集（按需 + 短缓存）

```mermaid
flowchart TD
    A[GET /api/dsh-webctl/status] --> B{refresh=1 或缓存过期?}
    B -- 否 --> C[返回缓存快照]
    B -- 是 --> D[探测 webctl: 解析路径 → --version → caps --json]
    D --> E{webctl ready?}
    E -- 是 --> F[一次性 MCP 握手: initialize + tools/list]
    E -- 否 --> G[MCP 状态 skipped]
    F --> H[读取宿主已注册 mcp__webctl__*]
    G --> H
    H --> I[探测 Playwright: 包 / 浏览器缓存 / 回退声明]
    I --> J[合成诊断: MCP_READY / TOOL_DRIFT / REGISTRATION_MISMATCH / FALLBACK_* / PLAYWRIGHT_*]
    J --> K[写入缓存并返回]
```

- 缓存 5 秒、并发请求合并；`?refresh=1` 强制重算。
- 所有子进程 `shell:false`、带超时与输出上限；握手拿到工具清单即关闭。

## 4. 一次工具调用与降级观测

```mermaid
sequenceDiagram
    autonumber
    participant A as Agent/模型
    participant T as ctx.tools
    participant M as mcp-client(webctl)
    participant W as webctl
    participant P as dsh-webctl

    A->>T: mcp__webctl__fetch(url)
    T->>M: callTool
    M->>W: tools/call
    W-->>M: CallToolResult（webctl 信封 JSON）
    M-->>T: 规范值 + 文本投影
    T-->>A: 工具结果（原样，不改写）
    T-)P: tools/result 事件
    P->>P: 解析信封 → code / actionable / fallback_hint
    P->>P: 有降级信号才写入 20 条环缓冲
```

插件**不参与**结果渲染：模型看到的仍是上游信封；插件只旁路记录元数据（不含页面正文与凭据）。

## 5. 降级与 Playwright 回退决策

```mermaid
flowchart TD
    A[webctl 工具返回] --> B{code}
    B -- OK --> C[直接使用结果]
    B -- DEGRADED / UNSUPPORTED --> D[读 meta.actionable]
    D --> E{next_steps 里有可用通道?}
    E -- 有，如 embedded_data --> F[先试静态通道]
    E -- 空数组 --> G[确实没有通道]
    F --> H{拿到内容?}
    H -- 是 --> I[结束]
    H -- 否 --> J{fallback_hint.playwright_suitable}
    G --> J
    J -- false --> K[不要回退；按 actionable.reason 处理]
    J -- true --> L{宿主声明了回退工具且本机就绪?}
    L -- 是 --> M[由 agent 决定是否调用 Playwright]
    L -- 否 --> N[状态页提示 PLAYWRIGHT_FALLBACK_UNAVAILABLE<br/>先 embedded_data，再考虑安装]
```

对应实现：`src/host/degradations.mjs`（解析与记录）、`src/host/status.mjs`（`fallbackReadiness` 与诊断）。

## 6. 验证分层

```mermaid
flowchart BT
    U[离线单测<br/>node --test] --> C[真实二进制契约<br/>WEBCTL_BIN · contract]
    C --> R[真实工具/降级/会话<br/>WEBCTL_BIN · tools-real]
    R --> E[隔离实例 E2E<br/>scripts/e2e-smoke.mjs]
    E --> F[故障矩阵<br/>scripts/e2e-faults.mjs]
    F --> H[人工检查单<br/>docs/ACCEPTANCE.md §3]
```

每一层的命令与覆盖范围见 [ACCEPTANCE.md](ACCEPTANCE.md)；发布前检查见 [RELEASE.md](RELEASE.md)。
