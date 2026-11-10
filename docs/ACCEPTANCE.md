# 验收矩阵

记录每个 webctl 工具在 dsh-webctl 里“验证到什么程度”，区分**自动化覆盖**与**需要人工/联网验证**。
不把未验证的写成已验证。

## 1. 自动化覆盖

| 层级 | 命令 | 覆盖 |
| --- | --- | --- |
| 离线单测 | `node --test tests/*.test.mjs` | 探测、信封解析、降级记录、状态合成、回退声明、客户端产物一致性 |
| 真实二进制契约 | `WEBCTL_BIN=... node --test tests/contract.test.mjs` | caps ↔ tools/list 工具面一致、三处版本一致、并发双启动 |
| 真实工具调用 | `WEBCTL_BIN=... node --test tests/tools-real.test.mjs` | 9 个工具的原始信封闭环 + trust 标记 + 内联 HTML 不触发降级的上游语义 |
| 隔离实例 E2E | `node scripts/e2e-smoke.mjs --webctl ...` | 安装、启动、MCP 连通、`mcp__webctl__*` 注册数、状态接口、client bundle |

## 2. 逐工具状态（18 个）

| 工具 | 自动化 | 说明 |
| --- | --- | --- |
| `fetch` | 间接 | 由 E2E/状态探测覆盖连接层；真实取回需联网 |
| `extract` | ✅ 真实 | 真实 MCP 调用（内联 HTML）+ 信封解析 |
| `search` | ✅ 真实 | 同上 |
| `links` | ✅ 真实 | 同上 |
| `tables` | ✅ 真实 | 同上 |
| `forms` | ✅ 真实 | 同上 |
| `fill_form` | ✗ | 有副作用（提交表单），只做人工点测 |
| `paginate` | ✗ | 需多页站点，人工/联调 |
| `session` | ✗ | 需要 session 状态目录，人工验证 |
| `cookies` | ✗ | 凭据敏感，人工验证导出确认与脱敏 |
| `json_query` | ✅ 真实 | 实测表达式需 `$` 前缀 |
| `doc_text` | ✅ 真实 | 临时 HTML 文件 |
| `embedded_data` | ✅ 真实 | JSON-LD 抽取 |
| `download` | ✗ | 需要联网与落盘，人工验证 |
| `robots` | ✗ | 需要联网，人工验证 |
| `resolve_site` | ✗ | 多通道联网，人工验证 |
| `caps` | ✅ 真实 | 工具面与版本 |
| `web_search` | ✗ | 需要联网；`0.2.3` 新字段用 fixture 覆盖（见 `docs/COMPATIBILITY.md`） |

## 3. 必须人工验证的检查单

1. **设置页渲染**：`dsh web` → 设置 → webctl；明/暗主题各看一次，确认无 slot crash、按钮可键盘聚焦。
2. **真实取回**：`fetch` 一个静态站与一个 JS 空壳站；后者应 `DEGRADED` 且带 `actionable`（0.2.3 起带 `fallback_hint`）。
3. **搜索**：`web_search` 单引擎与多引擎各一次，确认 `filtered_ads`、`applied_operators`、`same_domain_count`、`snippet_truncated` 字段可见。
4. **会话/凭据**：`cookies` 导出需显式确认；输出里不出现 cookie 值。
5. **降级记录**：真实触发一次 JS 页降级后，设置页“最近降级与回退”出现记录且不含页面正文。

## 4. 回归节奏

- 每次改探测/信封/状态代码：跑离线单测。
- 每次升级 webctl 或 DSH：跑契约 + 真实工具 + E2E 三层（`docs/COMPATIBILITY.md` §5）。
- 发布前：按 `CHANGELOG.md` 与上表补齐人工检查单。
