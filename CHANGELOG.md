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
- **离线单测**：假 webctl 覆盖 ready / missing / 版本失败 / 超时 / 路径解析。