/**
 * src/host/playwright.mjs 的单元测试。
 *
 * 全部在 os.tmpdir() 下的临时目录里伪造 node_modules 包与浏览器缓存目录，
 * 测试结束时递归清理；不依赖本机是否安装 Playwright，也不下载/启动真实浏览器。
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'

import { parseFallbackDeclaration, probePlaywright } from '../src/host/playwright.mjs'

/**
 * 创建临时根目录，并注册结束时清理。
 * @param {import('node:test').TestContext} t - 测试上下文。
 * @returns {string} 临时目录绝对路径。
 */
function makeTmpRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-webctl-pw-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  return root
}

/**
 * 构造隔离的环境变量：HOME 指向临时目录，避免读到真实浏览器缓存。
 * @param {import('node:test').TestContext} t - 测试上下文。
 * @param {object} [extra] - 额外环境变量。
 * @returns {Record<string, string>} 环境变量。
 */
function makeEnv(t, extra = {}) {
  const home = path.join(makeTmpRoot(t), 'home')
  fs.mkdirSync(home, { recursive: true })
  return { HOME: home, USERPROFILE: home, ...extra }
}

/**
 * 伪造一个已安装包。
 * @param {string} root - 项目目录。
 * @param {string} name - 包名。
 * @param {string} version - 版本号。
 * @returns {string} 包目录绝对路径。
 */
function writeFakePackage(root, name, version) {
  const packageDir = path.join(root, 'node_modules', name)
  fs.mkdirSync(packageDir, { recursive: true })
  const manifest = { name, version, main: 'index.js' }
  fs.writeFileSync(path.join(packageDir, 'package.json'), JSON.stringify(manifest, null, 2))
  return packageDir
}

/**
 * 伪造浏览器缓存目录。
 * @param {string} cacheDir - 缓存目录。
 * @param {string[]} names - 条目名（目录）。
 * @returns {string} 缓存目录绝对路径。
 */
function writeBrowserCache(cacheDir, names) {
  fs.mkdirSync(cacheDir, { recursive: true })
  for (const name of names) fs.mkdirSync(path.join(cacheDir, name), { recursive: true })
  return cacheDir
}

test('parseFallbackDeclaration：解析合法声明', () => {
  assert.deepEqual(parseFallbackDeclaration('playwright:browser_navigate'), {
    name: 'playwright',
    toolName: 'browser_navigate',
  })
  // 两侧空白会被裁掉。
  assert.deepEqual(parseFallbackDeclaration('  playwright : web_fetch  '), {
    name: 'playwright',
    toolName: 'web_fetch',
  })
  // 以第一个冒号切分，工具名里允许出现冒号。
  assert.deepEqual(parseFallbackDeclaration('a:b:c'), { name: 'a', toolName: 'b:c' })
})

test('parseFallbackDeclaration：非法声明返回 null', () => {
  const invalidValues = [undefined, null, '', '   ', 'playwright', ':web_fetch', 'playwright:', ' : ']
  for (const value of invalidValues) {
    assert.equal(parseFallbackDeclaration(value), null, '应判为非法：' + String(value))
  }
})

test('probePlaywright：没有包也没有浏览器 -> missing', async (t) => {
  const root = makeTmpRoot(t)
  const env = makeEnv(t)
  const result = await probePlaywright({ env, searchDirs: [root] })

  assert.equal(result.state, 'missing')
  assert.deepEqual(result.package, {
    found: false,
    name: null,
    version: null,
    path: null,
    searchedDirs: result.package.searchedDirs,
  })
  assert.equal(result.package.searchedDirs.includes(root), true)
  assert.ok(result.package.searchedDirs.includes(process.cwd()))
  assert.equal(result.browsers.exists, false)
  assert.deepEqual(result.browsers.entries, [])
  assert.equal(typeof result.browsers.path, 'string')
  assert.equal(result.browsers.path.endsWith('ms-playwright'), true)
  // 默认零副作用：不做启动冒烟。
  assert.deepEqual(result.launchSmoke, { enabled: false, tested: false, ok: null, error: null })
  assert.equal(result.error, null)
})

test('probePlaywright：只有包 -> partial，并过滤不存在的搜索目录', async (t) => {
  const root = makeTmpRoot(t)
  const packageDir = writeFakePackage(root, 'playwright', '1.49.0')
  const missingDir = path.join(root, 'does-not-exist')
  const env = makeEnv(t, { PLAYWRIGHT_BROWSERS_PATH: path.join(root, 'no-browsers') })
  const result = await probePlaywright({ env, searchDirs: [root, missingDir] })

  assert.equal(result.state, 'partial')
  assert.equal(result.package.found, true)
  assert.equal(result.package.name, 'playwright')
  assert.equal(result.package.version, '1.49.0')
  assert.equal(result.package.path, path.join(packageDir, 'package.json'))
  assert.equal(result.package.searchedDirs.includes(root), true)
  assert.equal(result.package.searchedDirs.includes(missingDir), false)
  assert.equal(result.browsers.exists, false)
  assert.deepEqual(result.browsers.entries, [])
  assert.equal(result.error, null)
})

test('probePlaywright：包与浏览器都有 -> ready，并解析条目', async (t) => {
  const root = makeTmpRoot(t)
  writeFakePackage(root, 'playwright-core', '1.49.0')
  const cacheDir = writeBrowserCache(path.join(root, 'ms-playwright'), [
    'chromium-1187',
    'chromium_headless_shell-1187',
    'firefox-1490',
    'webkit-2150',
    'not-a-browser',
    'chromium-abc',
  ])
  // 同名但为普通文件的条目不应计入。
  fs.writeFileSync(path.join(cacheDir, 'chromium-1500'), 'not a directory')

  const env = makeEnv(t, { PLAYWRIGHT_BROWSERS_PATH: cacheDir })
  const result = await probePlaywright({ env, searchDirs: [root] })

  assert.equal(result.state, 'ready')
  assert.equal(result.package.found, true)
  assert.equal(result.package.name, 'playwright-core')
  assert.equal(result.package.version, '1.49.0')
  assert.equal(result.browsers.path, cacheDir)
  assert.equal(result.browsers.exists, true)
  assert.deepEqual(result.browsers.entries, [
    { name: 'chromium', version: '1187' },
    { name: 'chromium_headless_shell', version: '1187' },
    { name: 'firefox', version: '1490' },
    { name: 'webkit', version: '2150' },
  ])
  assert.equal(result.error, null)
})

test('probePlaywright：playwright 优先于 playwright-core', async (t) => {
  const root = makeTmpRoot(t)
  writeFakePackage(root, 'playwright', '1.51.0')
  writeFakePackage(root, 'playwright-core', '1.49.0')
  const env = makeEnv(t, { PLAYWRIGHT_BROWSERS_PATH: path.join(root, 'no-browsers') })
  const result = await probePlaywright({ env, searchDirs: [root] })

  assert.equal(result.state, 'partial')
  assert.equal(result.package.name, 'playwright')
  assert.equal(result.package.version, '1.51.0')
})

test('probePlaywright：DSH_HOME 目录也能作为搜索根', async (t) => {
  const root = makeTmpRoot(t)
  writeFakePackage(root, 'playwright', '1.49.0')
  const env = makeEnv(t, {
    DSH_HOME: root,
    PLAYWRIGHT_BROWSERS_PATH: path.join(root, 'no-browsers'),
  })
  const result = await probePlaywright({ env })

  assert.equal(result.state, 'partial')
  assert.equal(result.package.found, true)
  assert.equal(result.package.path, path.join(root, 'node_modules', 'playwright', 'package.json'))
})

test('probePlaywright：NODE_PATH 里本身就是 node_modules 的目录也能找到包', async (t) => {
  const root = makeTmpRoot(t)
  writeFakePackage(root, 'playwright-core', '1.49.0')
  const nodeModulesDir = path.join(root, 'node_modules')
  const env = makeEnv(t, {
    NODE_PATH: [nodeModulesDir, path.join(root, 'nope')].join(path.delimiter),
    PLAYWRIGHT_BROWSERS_PATH: path.join(root, 'no-browsers'),
  })
  const result = await probePlaywright({ env })

  assert.equal(result.state, 'partial')
  assert.equal(result.package.found, true)
  assert.equal(result.package.name, 'playwright-core')
  assert.equal(result.package.path, path.join(nodeModulesDir, 'playwright-core', 'package.json'))
})

test('probePlaywright：空浏览器缓存目录不算 ready', async (t) => {
  const root = makeTmpRoot(t)
  writeFakePackage(root, 'playwright', '1.49.0')
  const emptyCache = writeBrowserCache(path.join(root, 'ms-playwright'), [])
  const env = makeEnv(t, { PLAYWRIGHT_BROWSERS_PATH: emptyCache })
  const result = await probePlaywright({ env, searchDirs: [root] })

  assert.equal(result.state, 'partial')
  assert.equal(result.browsers.path, emptyCache)
  assert.equal(result.browsers.exists, true)
  assert.deepEqual(result.browsers.entries, [])
})

test('probePlaywright：PLAYWRIGHT_BROWSERS_PATH=0 使用包内 .local-browsers', async (t) => {
  const root = makeTmpRoot(t)
  const packageDir = writeFakePackage(root, 'playwright', '1.49.0')
  const localBrowsers = path.join(packageDir, 'node_modules', 'playwright-core', '.local-browsers')
  writeBrowserCache(localBrowsers, ['chromium-1187'])

  const env = makeEnv(t, { PLAYWRIGHT_BROWSERS_PATH: '0' })
  const result = await probePlaywright({ env, searchDirs: [root] })

  assert.equal(result.browsers.path, localBrowsers)
  assert.equal(result.browsers.exists, true)
  assert.equal(result.state, 'ready')
})

test('probePlaywright：回退声明进入 fallback 字段', async (t) => {
  const root = makeTmpRoot(t)
  writeFakePackage(root, 'playwright', '1.49.0')
  const env = makeEnv(t, {
    PLAYWRIGHT_BROWSERS_PATH: path.join(root, 'no-browsers'),
    WEBCTL_FALLBACK_TOOL: 'playwright:browser_navigate',
  })
  const result = await probePlaywright({ env, searchDirs: [root] })
  assert.deepEqual(result.fallback, { declaredInEnv: true, toolName: 'browser_navigate' })

  const undeclared = await probePlaywright({ env: makeEnv(t), searchDirs: [root] })
  assert.deepEqual(undeclared.fallback, { declaredInEnv: false, toolName: null })
})

test('probePlaywright：包 package.json 损坏 -> error', async (t) => {
  const root = makeTmpRoot(t)
  const packageDir = path.join(root, 'node_modules', 'playwright')
  fs.mkdirSync(packageDir, { recursive: true })
  fs.writeFileSync(path.join(packageDir, 'package.json'), '{ not valid json')

  const env = makeEnv(t, { PLAYWRIGHT_BROWSERS_PATH: path.join(root, 'no-browsers') })
  const result = await probePlaywright({ env, searchDirs: [root] })

  assert.equal(result.state, 'error')
  assert.equal(result.error.code, 'PLAYWRIGHT_PACKAGE_INVALID')
  assert.equal(typeof result.error.message, 'string')
})

test('probePlaywright：launchSmoke 默认关闭，不启动子进程', async (t) => {
  const root = makeTmpRoot(t)
  writeFakePackage(root, 'playwright', '1.49.0')
  const env = makeEnv(t, { PLAYWRIGHT_BROWSERS_PATH: path.join(root, 'no-browsers') })
  const result = await probePlaywright({ env, searchDirs: [root] })

  assert.equal(result.launchSmoke.enabled, false)
  assert.equal(result.launchSmoke.tested, false)
  assert.equal(result.launchSmoke.ok, null)
  assert.equal(result.launchSmoke.error, null)
  assert.equal(result.error, null)
})

test('probePlaywright：显式 launchSmoke 失败时记录错误但 state 不变', async (t) => {
  const root = makeTmpRoot(t)
  // 只有 package.json、没有真实入口的假包：子进程加载必然失败，用来覆盖失败分支。
  writeFakePackage(root, 'playwright', '1.49.0')
  const env = makeEnv(t, { PLAYWRIGHT_BROWSERS_PATH: path.join(root, 'no-browsers') })
  const result = await probePlaywright({ env, searchDirs: [root], launchSmoke: true, timeoutMs: 5000 })

  assert.equal(result.launchSmoke.enabled, true)
  assert.equal(result.launchSmoke.tested, true)
  assert.equal(result.launchSmoke.ok, false)
  assert.equal(typeof result.launchSmoke.error, 'string')
  assert.ok(result.launchSmoke.error.length > 0)
  assert.equal(result.error.code, 'PLAYWRIGHT_SMOKE_FAILED')
  // state 仍按包/浏览器判定：只有包、没有浏览器 -> partial。
  assert.equal(result.state, 'partial')
})