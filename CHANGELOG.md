# 变更日志

本文件遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 与语义化版本。

## [0.1.0] - 2026-11-10

### Added

- **bundle 骨架**：`dsh-webctl` 宿主插件行与官方 `@deepseek-ai/dsh-mcp-client` 行（`serverName=webctl`，`webctl mcp`）。
- **webctl 发现**：解析可执行文件（PATH / 显式路径）、读 `--version` 与 `caps --json`，失败给出可诊断错误码。
- **MCP 握手探测**：一次性启动 `webctl mcp`，完成 initialize → initialized → tools/list 后关闭，支持分页与超时；不调用任何工具。
- **状态合成**：把 webctl 探测、MCP 握手、宿主实际注册的 `mcp__webctl__*` 工具与 Playwright 诊断合成一份快照，带 5 秒缓存与并发合并；`?refresh=1` 强制重算。
- **可行动诊断**：webctl 缺失 / 版本失败 / 握手失败 / 工具漂移 / Playwright 缺失都会给出 level、code、hint。
- **Playwright 被动探测**：只读 `playwright`/`playwright-core` 的 `package.json` 与浏览器缓存目录（`PLAYWRIGHT_BROWSERS_PATH`、各平台默认路径），默认不执行用户代码、不下载、不启动；显式 `launchSmoke` 才做一次性 headless 启动验证。
- **回退声明识别**：解析 `WEBCTL_FALLBACK_TOOL=<名字>:<工具名>`，供状态页显示 webctl 会指向哪个回退工具。
- **受控探测**：全部子进程 `shell:false`，带超时与输出字节上限。
- **只读诊断接口**：`GET /api/dsh-webctl/status`（`?refresh=1` 跳过后续缓存层）。
- **设置页状态面板**：`settings.section` 分区（id `dsh-webctl`、order 70）展示 webctl 状态/路径/版本/工具数、MCP 握手与 tools/list、宿主已注册 `mcp__webctl__*`、Playwright 包与浏览器状态、`WEBCTL_FALLBACK_TOOL` 声明、launchSmoke 结果、可折叠工具清单与诊断列表；带刷新/重试、加载态、AbortController 中止与中英文本地化。
- **展示元数据**：`locale/*.json` 的 `meta.title`/`meta.description` 与 `icon.svg`，插件管理页可见。
- **降级观测与回退建议**：监听 `tools/result`，从 webctl 信封提取 `meta.actionable` 与 `fallback_hint`（`playwright_suitable`/`signals`/`embedded_data_tried`/`js_engine_suitable`），保留最近 20 条；状态接口输出 `recentDegradations` 与 `fallbackReadiness`，设置页新增“最近降级与回退”分区。仅当出现 `playwright_suitable=true` 且 Playwright 未就绪时给出 `PLAYWRIGHT_FALLBACK_UNAVAILABLE` 警告（先试 `embedded_data`，不要放弃 webctl 静态能力）。记录不含页面内容或凭据。
- **端到端冒烟脚本**：`node scripts/e2e-smoke.mjs --webctl <path>` 在临时 `DSH_HOME` 里创建 web profile、安装插件、启动随机端口实例，断言 MCP 连通、`mcp__webctl__*` 注册数、状态接口字段与 client bundle 可下载；结束自动清理，缺 `dsh`/`webctl` 时以退出码 2 跳过。
- **真实二进制契约守卫**：`WEBCTL_BIN=... node --test tests/contract.test.mjs` 校验 `caps` 与 MCP `tools/list` 工具面/版本一致，并验证两次 MCP 探测可并发成功（对应 DSH 的探测 + 服务双启动约束）；未设置时自动跳过。
- **二进制一致性诊断**：宿主已注册工具的集合与探测到的 `tools/list` 不一致时给出 `MCP_REGISTRATION_MISMATCH`（提示两行 `command` 对齐）；`MCP_REGISTERED` 现在只统计 `mcp__<serverName>__*`，不再把其他 MCP 服务器的工具算进来。
- **README 诊断码表**：常见 code 的含义与处理。
- **回退声明预览**：`dsh-webctl` 行新增 `fallbackTool` 配置；插件用注入 `WEBCTL_FALLBACK_TOOL` 的探测读取 `caps.fallback_capability`，在状态页显示声明是否被识别（`FALLBACK_TOOL_ACTIVE` / `FALLBACK_TOOL_NOT_REPORTED` / `FALLBACK_TOOL_INVALID`），并明确提示真正生效需要写进 `mcp-client-webctl` 行的 `env`。
- **安全模型文档**：`docs/SECURITY.md` 说明信任边界（页面内容/可执行文件/工具结果/Playwright/凭据）、默认最小权限姿态、已知风险与缓解。
- **多平台路径测试**：`resolveExecutable` 增加 `platform='win32'` 的 `PATHEXT` 解析用例与显式路径不做 PATH 搜索的用例。
- **离线单测**：假 webctl 覆盖 ready / missing / 版本失败 / 超时 / 路径解析。