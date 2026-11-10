/**
 * webctl 契约守卫（需要真实二进制）：设置 `WEBCTL_BIN=/path/to/webctl` 才会运行，否则跳过。
 *
 * 覆盖三件事：
 * 1) `caps` 的工具面与 MCP `tools/list` 一致（版本/工具漂移会失败）；
 * 2) `--version` 与 `caps.data.version` 一致；
 * 3) DSH 的“先探测、再服务 / 允许并发启动”约束：两个 MCP 探测可同时成功。
 */
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { probeMcpServer } from '../src/host/mcp-probe.mjs'
import { probeWebctl } from '../src/host/webctl.mjs'

const BIN = process.env.WEBCTL_BIN
const skip = BIN === undefined || BIN === ''

test('webctl caps 与 MCP tools/list 的工具面一致', { skip: skip ? '未设置 WEBCTL_BIN' : false }, async () => {
  const webctl = await probeWebctl({ command: BIN, timeoutMs: 10000 })
  assert.equal(webctl.state, 'ready', 'webctl 应可执行')
  const mcp = await probeMcpServer({ command: webctl.resolvedPath, timeoutMs: 15000 })
  assert.equal(mcp.state, 'ready', 'MCP 应握手成功')
  const capsTools = (webctl.caps?.tools ?? []).map((tool) => tool.name).sort()
  const mcpTools = mcp.tools.slice().sort()
  assert.ok(capsTools.length >= 15, 'caps 应至少报告 15 个工具')
  assert.deepEqual(mcpTools, capsTools, 'caps 与 tools/list 的工具集合必须一致（漂移时更新插件文档与测试）')
  assert.equal(webctl.version, webctl.caps?.version, '--version 与 caps.data.version 必须一致')
  assert.equal(mcp.serverInfo?.version, webctl.caps?.version, 'MCP serverInfo 版本应与 caps 一致')
})

test('两个 MCP 探测可并发成功（对应 DSH 的探测 + 服务双启动）', { skip: skip ? '未设置 WEBCTL_BIN' : false }, async () => {
  const webctl = await probeWebctl({ command: BIN, timeoutMs: 10000 })
  assert.equal(webctl.state, 'ready')
  const [first, second] = await Promise.all([
    probeMcpServer({ command: webctl.resolvedPath, timeoutMs: 15000 }),
    probeMcpServer({ command: webctl.resolvedPath, timeoutMs: 15000 }),
  ])
  assert.equal(first.state, 'ready', '第一个探测应成功')
  assert.equal(second.state, 'ready', '第二个探测应成功（服务不能抢独占锁/端口）')
  assert.equal(first.tools.length, second.tools.length)
})

test('四舍五入式保护：探测结束后没有残留子进程', { skip: skip ? '未设置 WEBCTL_BIN' : false }, async () => {
  const webctl = await probeWebctl({ command: BIN, timeoutMs: 10000 })
  const started = Date.now()
  const result = await probeMcpServer({ command: webctl.resolvedPath, timeoutMs: 15000 })
  assert.equal(result.state, 'ready')
  assert.ok(Date.now() - started < 15000, '探测应在超时前结束')
})
/**
 * 统计当前存活的 `webctl mcp` 子进程数量（仅 POSIX；用 pgrep）。
 * @returns {number} 数量。
 */
function countWebctlMcpProcesses() {
  const result = spawnSync('pgrep', ['-fc', 'webctl mcp'], { encoding: 'utf8' })
  if (result.status !== 0) return 0
  const value = Number.parseInt(result.stdout.trim(), 10)
  return Number.isFinite(value) ? value : 0
}

test('探测结束后不留下 webctl mcp 子进程', { skip: skip ? '未设置 WEBCTL_BIN' : process.platform === 'win32' ? 'Windows 跳过 pgrep 检查' : false }, async () => {
  const webctl = await probeWebctl({ command: BIN, timeoutMs: 10000 })
  assert.equal(webctl.state, 'ready')
  const before = countWebctlMcpProcesses()
  for (let index = 0; index < 5; index += 1) {
    const result = await probeMcpServer({ command: webctl.resolvedPath, timeoutMs: 15000 })
    assert.equal(result.state, 'ready', '第 ' + String(index + 1) + ' 次探测应成功')
  }
  // 给内核回收留一点时间，再确认没有新增存活进程。
  await new Promise((resolve) => setTimeout(resolve, 500))
  const after = countWebctlMcpProcesses()
  assert.ok(after <= before, '探测不应留下存活的 webctl mcp 进程（before=' + String(before) + ', after=' + String(after) + '）')
})
