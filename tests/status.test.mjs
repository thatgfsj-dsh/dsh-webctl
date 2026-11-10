/**
 * 宿主侧单元测试：命令解析、caps 归一化、webctl 探测、MCP 握手探测与状态合成。
 *
 * 全部离线：用临时目录里的假可执行文件模拟 webctl，不发任何网络请求。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chmod, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { probeMcpServer } from '../src/host/mcp-probe.mjs'
import { composeStatus } from '../src/host/status.mjs'

/**
 * 建一个临时目录并在结束时清理。
 * @param {(dir: string) => Promise<void>} work - 测试主体。
 * @returns {Promise<void>} 完成。
 */
async function withTempDir(work) {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-webctl-test-'))
  try {
    await work(dir)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

/**
 * 写一个可执行的假 webctl。
 * @param {string} dir - 目录。
 * @param {string} body - POSIX sh 脚本正文。
 * @returns {Promise<string>} 脚本路径。
 */
async function writeFakeWebctl(dir, body) {
  const path = join(dir, 'webctl')
  await writeFile(path, '#!/bin/sh\n' + body)
  await chmod(path, 0o755)
  return path
}

test('probeMcpServer 对假 MCP 服务完成 initialize 与 tools/list', async () => {
  await withTempDir(async (dir) => {
    const script = join(dir, 'fake-mcp.mjs')
    const source = [
      '#!/usr/bin/env node',
      'let buffer = ""',
      'process.stdin.on("data", (chunk) => {',
      '  buffer += chunk.toString("utf8")',
      '  for (;;) {',
      '    const index = buffer.indexOf("\\n")',
      '    if (index < 0) break',
      '    const line = buffer.slice(0, index).trim()',
      '    buffer = buffer.slice(index + 1)',
      '    if (line === "") continue',
      '    const message = JSON.parse(line)',
      '    if (message.method === "initialize") {',
      '      process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { protocolVersion: "2025-06-18", serverInfo: { name: "fake", version: "9.9.9" }, capabilities: {} } }) + "\\n")',
      '    } else if (message.method === "tools/list") {',
      '      process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { tools: [{ name: "fetch" }, { name: "web_search" }] } }) + "\\n")',
      '    }',
      '  }',
      '})',
    ].join('\n')
    await writeFile(script, source)
    await chmod(script, 0o755)
    const result = await probeMcpServer({ command: script, timeoutMs: 5000 })
    assert.equal(result.state, 'ready')
    assert.deepEqual(result.tools, ['fetch', 'web_search'])
    assert.equal(result.serverInfo?.name, 'fake')
  })
})

test('probeMcpServer 对沉默的服务返回超时错误', async () => {
  await withTempDir(async (dir) => {
    const script = join(dir, 'silent.mjs')
    await writeFile(script, '#!/usr/bin/env node\nsetInterval(() => {}, 1000)\n')
    await chmod(script, 0o755)
    const result = await probeMcpServer({ command: script, timeoutMs: 800 })
    assert.equal(result.state, 'error')
    assert.equal(result.error?.code, 'MCP_TIMEOUT')
  })
})
