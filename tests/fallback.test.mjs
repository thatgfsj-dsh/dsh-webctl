/**
 * 回退声明（WEBCTL_FALLBACK_TOOL）预览与校验测试。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { composeStatus, parseFallbackTool } from '../src/host/status.mjs'
import { probeWebctl } from '../src/host/webctl.mjs'

test('parseFallbackTool 解析合法/非法声明', () => {
  assert.deepEqual(parseFallbackTool('playwright:playwright_browser_snapshot'), {
    raw: 'playwright:playwright_browser_snapshot',
    name: 'playwright',
    tool: 'playwright_browser_snapshot',
    valid: true,
  })
  assert.equal(parseFallbackTool(''), null)
  assert.equal(parseFallbackTool(undefined), null)
  assert.equal(parseFallbackTool('no-colon').valid, false)
  assert.equal(parseFallbackTool(':tool').valid, false)
  assert.equal(parseFallbackTool('name:').valid, false)
  assert.equal(parseFallbackTool('bad name:tool').valid, false)
})

/**
 * 构造状态输入。
 * @param {object} options - 选项。
 * @returns {object} composeStatus 输入。
 */
function statusInput({ fallbackTool, fallbackCapability }) {
  return {
    webctl: { state: 'ready', command: 'webctl', resolvedPath: '/usr/bin/webctl', version: '0.2.3', caps: { version: '0.2.3', tools: [{ name: 'fetch', state: 'available' }], fallbackCapability }, error: null },
    mcp: { state: 'ready', serverInfo: { name: 'webctl', version: '0.2.3' }, protocolVersion: '2025-06-18', tools: ['fetch'], error: null },
    playwright: { state: 'missing', package: { found: false, name: null, version: null, path: null, searchedDirs: [] }, browsers: { path: null, exists: false, entries: [] }, fallback: { declaredInEnv: false, toolName: null }, launchSmoke: { enabled: false, tested: false, ok: null, error: null }, error: null },
    registeredTools: ['mcp__webctl__fetch'],
    degradations: [],
    config: { command: 'webctl', serverName: 'webctl', fallbackTool },
    durationMs: 5,
  }
}

test('composeStatus：合法声明且 caps 已报告 -> 生效', () => {
  const status = composeStatus(statusInput({
    fallbackTool: 'playwright:playwright_browser_snapshot',
    fallbackCapability: { name: 'playwright', tool: 'playwright_browser_snapshot' },
  }))
  const codes = status.diagnostics.map((item) => item.code)
  assert.ok(codes.includes('FALLBACK_TOOL_ACTIVE'))
  assert.equal(status.webctl.fallbackPreview.configured, true)
  assert.equal(status.webctl.fallbackPreview.valid, true)
  assert.equal(status.webctl.fallbackPreview.active, true)
})

test('composeStatus：合法声明但 caps 未报告 -> 警告（版本过旧）', () => {
  const status = composeStatus(statusInput({ fallbackTool: 'playwright:snapshot', fallbackCapability: null }))
  const codes = status.diagnostics.map((item) => item.code)
  assert.ok(codes.includes('FALLBACK_TOOL_NOT_REPORTED'))
  assert.equal(status.webctl.fallbackPreview.active, false)
})

test('composeStatus：非法声明 -> FALLBACK_TOOL_INVALID 且不激活', () => {
  const status = composeStatus(statusInput({ fallbackTool: 'oops', fallbackCapability: { name: 'x', tool: 'y' } }))
  const codes = status.diagnostics.map((item) => item.code)
  assert.ok(codes.includes('FALLBACK_TOOL_INVALID'))
  assert.equal(status.webctl.fallbackPreview.active, false)
})

test('probeWebctl 会把注入的 WEBCTL_FALLBACK_TOOL 传给子进程', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-webctl-fallback-'))
  try {
    const script = join(dir, 'webctl')
    const source = [
      '#!/bin/sh',
      'if [ "$1" = "--version" ]; then echo "webctl 0.2.3"; exit 0; fi',
      'if [ "$1" = "caps" ]; then',
      '  if [ "$WEBCTL_FALLBACK_TOOL" = "playwright:snapshot" ]; then',
      '    echo \'{"ok":true,"data":{"version":"0.2.3","tools":[{"name":"fetch","state":"available"}],"fallback_capability":{"name":"playwright","tool":"snapshot"}}}\'; exit 0;',
      '  fi',
      '  echo \'{"ok":true,"data":{"version":"0.2.3","tools":[{"name":"fetch","state":"available"}]}}\'; exit 0;',
      'fi',
      'exit 1',
    ].join('\n')
    await writeFile(script, source)
    await chmod(script, 0o755)
    const result = await probeWebctl({
      command: script,
      timeoutMs: 5000,
      env: { ...process.env, WEBCTL_FALLBACK_TOOL: 'playwright:snapshot' },
    })
    assert.equal(result.state, 'ready')
    assert.deepEqual(result.caps?.fallbackCapability, { name: 'playwright', tool: 'snapshot' })
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
