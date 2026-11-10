# 安全模型（威胁模型与默认行为）

dsh-webctl 站在 DSH 与 webctl 之间，只做**诊断与展示**；它不重新实现抓取、不改写工具结果。
本文件说明它的信任边界、默认姿态与已知风险。

## 1. 组件与信任边界

```mermaid
flowchart LR
  U[用户/管理员] -->|配置 profile 补丁| P[dsh-webctl 宿主插件]
  P -->|只读探测 spawn(argv)| W[webctl 可执行文件]
  M[官方 mcp-client 行] -->|stdio JSON-RPC| W
  M -->|mcp__webctl__*| T[DSH 工具表]
  T --> A[模型]
  P -.->|只读 tools/result| D[(降级记录 20 条)]
```

| 边界 | 信任级别 | 说明 |
| --- | --- | --- |
| 页面内容 | **不可信** | webctl 信封标记 `trust: untrusted_page_content`；插件不把它当指令，只读元数据 |
| webctl 可执行文件 | 管理员配置 | 路径来自 profile 补丁，不接受网页输入；`shell:false` 避免注入 |
| MCP 工具结果 | 半可信 | 插件只提取 `code`/`meta.actionable`/`fallback_hint`，记录不含内容正文 |
| Playwright 安装 | 本机环境 | 默认只读探测；不执行包代码、不下载浏览器 |
| storage_state | **凭据** | 上游只有库能力、无 CLI/MCP 入口；插件**不读取**会话文件，暂不实现导出 |

## 2. 默认姿态（最小权限）

- **Playwright 探测默认零副作用**：只读 `node_modules/playwright*/package.json` 与浏览器缓存目录；不 `require` 用户代码、不下载浏览器、不启动浏览器、不访问站点。
- **启动冒烟默认关闭**：`launchSmoke: true` 才会启动一次 headless Chromium 并立即关闭；失败只影响诊断。
- **不自动注入环境变量**：`WEBCTL_FALLBACK_TOOL` 只识别、不设置；声明由管理员写进 profile 补丁。
- **不自动安装 webctl**：状态页只给出安装链接与配置方法，由用户执行。
- **探测有界**：所有子进程带超时与输出字节上限；MCP 握手拿到工具清单即关闭。

## 3. 已知风险与缓解

| 风险 | 缓解 |
| --- | --- |
| 网页内容提示注入 | 插件不改写、不执行页面内容；模型侧仍按 untrusted 处理 |
| `fill_form` 等有副作用工具 | 由 webctl 自身语义与用户授权决定；插件不隐藏、不代调用 |
| cookie / 凭据泄漏 | 插件不在日志、状态接口或降级记录里保存 cookie 值；官方 mcp-client 对子进程环境做凭据擦除 |
| 错误配置把 `command` 指向恶意程序 | 只有能改 profile 的人能改；文档要求使用可信路径 |
| 探测阻塞宿主 | 全部异步、有超时；失败进入诊断而不是抛错中止 |
| 降级记录占用内存 | 20 条环缓冲，字段截断 |

## 4. 不做的事

- 不内嵌浏览器、不实现 CDP/WebDriver。
- 不绕过验证码/Cloudflare（webctl 自身的 `BLOCKED` 语义原样透传）。
- 不读取用户浏览器 profile、不导出 cookie、不自动登录。
- 不因为 Playwright 缺失改变 webctl 工具是否可用。

## 5. 报告安全问题

请通过仓库 Issues 私密反馈或在 issue 中标明 `security`；不要在公开 issue 贴凭据或可复现的敏感 URL。
