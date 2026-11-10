# 兼容性矩阵与上游契约

本文件记录 dsh-webctl 依赖的 **webctl 工具面契约**、**DSH 版本基线**，以及两者之间的适配边界。
每条结论都标注来源；上游未发布的内容不当作稳定契约。

## 1. 版本矩阵

| 组件 | 已验证 | 声明支持 | 来源 |
| --- | --- | --- | --- |
| DSH | `0.2.2-rc.1` | `>=0.2.1-rc.2 <0.3.0-0`（`engines.dsh`） | 本机实测 + 插件 `package.json` |
| webctl | `0.2.2`（Release 资产，18 工具） | `0.2.x` | `webctl caps --json`、`webctl mcp --list-tools`、Release 页 |
| webctl 主干 | `0.2.3`（commit `d64b7bb`，**未打 tag**） | 兼容读取，按最终发布核对 | 本地 checkout + `CHANGELOG.md` |
| Playwright | 未安装（本机 `missing`） | 任意版本，仅诊断 | 插件探测输出 |

> `0.2.3` 的仓库已有 release 提交但 **GitHub Release 仍是 v0.2.2**，因此插件对 0.2.3 只承诺
> “不丢字段的透传”和“状态页可读”，不承诺字段级验收；等 `v0.2.3` 资产发布后再补 fixture。

## 2. 工具面（18 个，0.2.0 起稳定）

| 版本 | 工具数 | 说明 |
| --- | --- | --- |
| `0.1.x` | 15 | 无 `embedded_data` / `resolve_site` / `web_search` |
| `0.2.0` | 17 | 加 `resolve_site` |
| `0.2.2` | 18 | 加 `web_search`（bing/baidu/360，去重 + RRF） |
| `0.2.3` | 18 | 工具面不变；搜索参数/字段与回退信息变化 |

插件不硬编码工具清单：工具由官方 `@deepseek-ai/dsh-mcp-client` 按 `tools/list` 动态注册；
状态页把 `caps` 的 `tools` 与 `tools/list` 对比，出现漂移会给出 `MCP_TOOL_DRIFT` 警告。

## 3. 0.2.3 新增契约（源码核对）

来源：`Thatgfsj/webctl` 本地 checkout（`d64b7bb`）与 `CHANGELOG.md`。

| 契约 | 位置 | 插件侧行为 |
| --- | --- | --- |
| `web_search.exclude` / `applied_operators` | `crates/webctl-mcp/src/params.rs`、`web_search_tool.rs` | 参数原样透传；结果字段原样回传，不裁剪 |
| `filtered_ads` / `is_ad`（去广告） | `webctl-web` 搜索解析 | 同上；`filtered_ads` 用于状态页/模型自行判断 |
| 同域折叠 `same_domain_count` / `expand_domains` | `params.rs` | 默认折叠是上游行为，插件不覆盖 |
| `snippet_max_chars` / `snippet_truncated` | `params.rs` | 默认 300 字符截断由上游决定 |
| `meta.actionable.fallback_hint` | `crates/webctl-core/src/envelope.rs` | 插件解析并展示：`playwright_suitable` / `signals` / `embedded_data_tried` / `js_engine_suitable` |
| `caps.fallback_capability` | `crates/webctl-core/src/caps.rs` | 状态页显示；声明方式见 README |
| `WEBCTL_FALLBACK_TOOL` | `crates/webctl-core/src/fallback_decl.rs` | 插件只读识别（`playwright.fallback`），不自动注入 |
| Playwright `storage_state` 导出 | `crates/webctl-web/src/session/storage_state.rs` | **上游只有库内能力**：MCP 工具面未变、CLI 子命令也无导出入口 → 插件暂不实现（见 #16） |

## 4. 插件如何保持“不丢语义”

- 工具调用与结果由官方 MCP 客户端桥接：插件不注册同名工具、不改写参数、不重排结果、不改写错误码。
- 插件只**读**：`tools/result` 事件里提取 webctl 信封（`meta.actionable` / `fallback_hint`），记录进 20 条环缓冲；不改写结果、不发起额外请求。
- 记录只保留 code / degraded_from / reason / detected / next_steps / fallback_hint 与工具名；**不含页面内容、cookie 或凭据**。

## 5. 如何重新核对

```bash
# 1) 工具面（裸名）
webctl mcp --list-tools

# 2) 能力自检（含 fallback_capability）
webctl caps --json

# 3) 插件状态
dsh --profile web --dump-config | grep -A8 mcp-client-webctl
# 打开 设置 → webctl 状态，或在已登录的页面上请求：
# GET /api/dsh-webctl/status?refresh=1
```

插件状态接口会同时报告：webctl 可执行文件与版本、`caps` 工具数、真实 MCP `tools/list`、
宿主实际注册的 `mcp__webctl__*` 工具、Playwright 状态与最近降级记录。

## 6. 已知上游缺口

- **`storage_state` 无 CLI/MCP 入口**（0.2.3）：只有 Rust 库函数，插件无法在不读用户会话文件的前提下导出。
- **`caps` 不含逐工具 schema**：插件只能对比工具名，无法在插件侧校验参数 schema 漂移；参数契约依赖上游 `tools/list` 变化时重新核对。
- **0.2.3 未发布资产**：当前验证用 `0.2.2` 资产；0.2.3 字段以源码核对，发布后需补一次端到端冒烟。

## 7. 变更流程

1. 上游发版 → 读 `CHANGELOG.md` 与 `docs/ROADMAP-*.md`。
2. 按本文件 §5 重新核对工具面与 caps。
3. 若工具数/字段变化：更新本文件与状态页文案，补一条 fixture 测试。
4. 通过 Issue + PR 提交，单个 PR ≤1000 行代码。
