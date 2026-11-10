# 变更日志

本文件遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 与语义化版本。

## [0.1.0] - 2026-11-10

### Added

- **bundle 骨架**：`dsh-webctl` 宿主插件行与官方 `@deepseek-ai/dsh-mcp-client` 行（`serverName=webctl`，`webctl mcp`）。
- **webctl 发现**：解析可执行文件（PATH / 显式路径）、读 `--version` 与 `caps --json`，失败给出可诊断错误码。
- **受控探测**：全部子进程 `shell:false`，带超时与输出字节上限。
- **只读诊断接口**：`GET /api/dsh-webctl/status`（`?refresh=1` 跳过后续缓存层）。
- **离线单测**：假 webctl 覆盖 ready / missing / 版本失败 / 超时 / 路径解析。
