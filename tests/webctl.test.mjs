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
import { runCommand } from '../src/host/proc.mjs'
import { normalizeCaps, parseVersion, probeWebctl, resolveExecutable } from '../src/host/webctl.mjs'

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

test('parseVersion 从 webctl --version 输出里取版本号', () => {
  assert.equal(parseVersion('webctl 0.2.2\n'), '0.2.2')
  assert.equal(parseVersion('webctl 0.2.3-rc.1'), '0.2.3-rc.1')
  assert.equal(parseVersion('no version here'), null)
})

test('normalizeCaps 只接受 ok=true 的 caps 信封', () => {
  const caps = normalizeCaps({
    ok: true,
    data: { version: '0.2.2', tools: [{ name: 'fetch', state: 'available' }, { name: 'web_search', state: 'available' }], fallback_capability: { name: 'playwright' } },
  })
  assert.deepEqual(caps?.tools, [{ name: 'fetch', state: 'available' }, { name: 'web_search', state: 'available' }])
  assert.equal(caps?.version, '0.2.2')
  assert.deepEqual(caps?.fallbackCapability, { name: 'playwright' })
  assert.equal(normalizeCaps({ ok: false, data: {} }), null)
  assert.equal(normalizeCaps(null), null)
})

test('resolveExecutable 在 PATH 上找到命令，找不到返回 null', async () => {
  await withTempDir(async (dir) => {
    const path = await writeFakeWebctl(dir, 'echo webctl 0.2.2\n')
    assert.equal(resolveExecutable('webctl', { PATH: dir }), path)
    assert.equal(resolveExecutable('webctl', { PATH: '/nonexistent-dir-xyz' }), null)
    assert.equal(resolveExecutable('', { PATH: dir }), null)
  })
})

test('probeWebctl 识别 ready / missing / 版本失败', async () => {
  await withTempDir(async (dir) => {
    const path = await writeFakeWebctl(dir, [
      'if [ "$1" = "--version" ]; then echo "webctl 0.2.2"; exit 0; fi',
      'if [ "$1" = "caps" ]; then echo \'{"ok":true,"data":{"version":"0.2.2","tools":[{"name":"fetch","state":"available"}]}}\'; exit 0; fi',
      'exit 1',
    ].join('\n'))
    const ready = await probeWebctl({ command: path, timeoutMs: 5000 })
    assert.equal(ready.state, 'ready')
    assert.equal(ready.version, '0.2.2')
    assert.equal(ready.caps?.tools?.length, 1)

    const missing = await probeWebctl({ command: join(dir, 'nope'), timeoutMs: 5000 })
    assert.equal(missing.state, 'missing')
    assert.equal(missing.error?.code, 'WEBCTL_MISSING')
  })

  await withTempDir(async (dir) => {
    const path = await writeFakeWebctl(dir, 'echo unexpected\nexit 1\n')
    const failed = await probeWebctl({ command: path, timeoutMs: 5000 })
    assert.equal(failed.state, 'error')
    assert.equal(failed.error?.code, 'WEBCTL_VERSION_FAILED')
  })
})

test('runCommand 超时会终止进程', async () => {
  await withTempDir(async (dir) => {
    const script = join(dir, 'slow.mjs')
    await writeFile(script, '#!/usr/bin/env node\nsetInterval(() => {}, 1000)\n')
    await chmod(script, 0o755)
    const result = await runCommand(script, [], { timeoutMs: 500 })
    assert.equal(result.ok, false)
    assert.equal(result.timedOut, true)
  })
})
test('resolveExecutable 在 Windows 上按 PATHEXT 解析（平台参数可测）', async () => {
  await withTempDir(async (dir) => {
    const exe = join(dir, 'webctl.EXE')
    await writeFile(exe, 'binary')
    const resolved = resolveExecutable('webctl', { PATH: dir, PATHEXT: '.EXE;.CMD' }, 'win32')
    assert.equal(resolved, exe)
    assert.equal(resolveExecutable('webctl', { PATH: dir, PATHEXT: '.CMD' }, 'win32'), null)
  })
})

test('resolveExecutable 对显式相对/绝对路径不做 PATH 搜索', async () => {
  await withTempDir(async (dir) => {
    const exe = await writeFakeWebctl(dir, 'echo webctl 0.2.2\n')
    assert.equal(resolveExecutable(exe, { PATH: '' }), exe)
    assert.equal(resolveExecutable(join(dir, 'missing'), { PATH: dir }), null)
  })
})
