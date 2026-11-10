# 发布流程与检查清单

本仓库按“Issue → PR → 合并”推进；CI 与发布在**构建阶段**统一执行，不在每个 PR 跑全量 CI。

## 1. 版本与兼容

- 版本号在 `package.json`；`engines.dsh` 决定安装兼容范围（当前 `>=0.2.1-rc.2 <0.3.0-0`）。
- 发布前确认 [docs/COMPATIBILITY.md](COMPATIBILITY.md) 的 webctl 版本矩阵与实测记录没有过期。
- 行为变化、新增配置与诊断码必须写进 [CHANGELOG.md](../CHANGELOG.md)。

## 2. 发布前检查单

### 自动化

```bash
node --test tests/*.test.mjs                 # 离线：探测/解析/状态/客户端一致
WEBCTL_BIN=/path/to/webctl node --test tests/contract.test.mjs   # 工具面/版本/并发/无孤儿
WEBCTL_BIN=/path/to/webctl node --test tests/tools-real.test.mjs # 真实工具信封 + 降级链路 + 会话
node scripts/build-client.mjs --check        # client.js 与源码同步
node scripts/e2e-smoke.mjs --webctl /path/to/webctl              # 隔离实例安装/启动/接口/bundle
```

### 人工

- [ ] 设置页在明/暗主题下渲染正常，刷新按钮与折叠清单可用（`docs/ACCEPTANCE.md` §3）。
- [ ] `webctl` 缺失、版本过旧、MCP 握手失败三种情况下，状态页诊断与提示正确。
- [ ] 真实站点触发一次 JS 降级，设置页“最近降级与回退”出现记录且不含页面正文。
- [ ] `cookies` 导出需要显式确认，且结果/日志不出现 cookie 值。
- [ ] “两行 `command` 不一致”能被 `MCP_REGISTRATION_MISMATCH` 检出（可临时改一行验证）。

## 3. 发布步骤

1. 更新 `package.json` 版本与 CHANGELOG 的发布日期段落（遵循 Keep a Changelog）。
2. 在干净工作区跑 §2 全部命令；记录 webctl/DSH 版本。
3. 合并发布 PR（`chore(release): x.y.z`），本地打 tag：`git tag vX.Y.Z && git push origin vX.Y.Z`。
4. GitHub Release 采用 CHANGELOG 段落；附 `pnpm pack` 产物与 sha256。
5. 安装冒烟：在临时 `DSH_HOME` 用 `dsh plugin --profile web add <tgz>` 后重复 §2 的 E2E。

## 4. 回滚

- 插件是 bundle：`dsh plugin --profile web remove dsh-webctl` 即可回到无插件状态，不影响 webctl 本身。
- 若只有某次工具行配置有问题：在 profile 的 `cordis.patch.yml` 覆盖 `mcp-client-webctl` 的 `config`（整体替换）。
- 发布资产损坏时撤销 GitHub Release 并重新打 tag（不要移动已发布 tag）。

## 5. 不做什么

- 不在 PR 阶段跑三平台/发布流水线（按仓库规则留到构建阶段）。
- 不自动发布到任何 registry；发布由维护者手动触发。
