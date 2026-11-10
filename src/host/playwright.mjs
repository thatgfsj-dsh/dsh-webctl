/**
 * Playwright 环境探测（回退通道，不是 webctl 的依赖）。
 *
 * 默认只做被动检查：在候选目录里读取已安装包的 package.json，并检查浏览器缓存目录。
 * 不 require/import 用户代码、不下载浏览器、不启动浏览器、不访问网络请求。
 * 启动冒烟（launchSmoke）必须由调用方显式传入 true 才执行。
 *
 * 只使用 Node 内置模块，纯 ESM；所有路径用 node:path 处理，不经过 shell。
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/** 启动冒烟默认超时（毫秒）。 */
const DEFAULT_SMOKE_TIMEOUT_MS = 10000

/** 候选包名：优先完整的 playwright，其次 playwright-core。 */
const PACKAGE_NAMES = ['playwright', 'playwright-core']

/** 浏览器缓存条目名：chromium-1187 / chromium_headless_shell-1187 / firefox-1490 / webkit-2150。 */
const BROWSER_ENTRY_PATTERN = /^([a-z][a-z0-9_]*)-(\d+)$/

/** 启动冒烟成功时子进程写出的标记。 */
const SMOKE_OK_MARKER = 'PW_SMOKE_OK '

/** 启动冒烟失败时子进程写出的标记。 */
const SMOKE_FAIL_MARKER = 'PW_SMOKE_FAIL '

/** 探测失败用的带 code 错误；只在 probePlaywright 内部抛出与捕获。 */
class ProbeFailure extends Error {
  /**
   * @param {string} code - 错误码。
   * @param {string} message - 错误信息。
   */
  constructor(code, message) {
    super(message)
    this.name = 'ProbeFailure'
    this.code = code
  }
}

/**
 * 读取第一个非空字符串。
 * @param {...(string|undefined)} values - 候选值。
 * @returns {string|null} 第一个非空值。
 */
function firstNonEmpty(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim() !== '') return value.trim()
  }
  return null
}

/**
 * 判断路径是否为已存在的目录。
 * @param {string} target - 绝对路径。
 * @returns {boolean} 是否存在且为目录。
 */
function isDirectory(target) {
  try {
    return fs.statSync(target).isDirectory()
  } catch {
    return false
  }
}

/**
 * 把候选目录规范为绝对路径、去重、只保留已存在的目录，保持声明顺序。
 * @param {unknown[]} values - 原始候选目录。
 * @param {string} cwd - 解析相对路径用的基准目录。
 * @returns {string[]} 可搜索的绝对目录。
 */
function uniqueExistingDirs(values, cwd) {
  const seen = new Set()
  const dirs = []
  for (const value of values) {
    if (typeof value !== 'string' || value.trim() === '') continue
    const absolute = path.resolve(cwd, value.trim())
    const key = process.platform === 'win32' ? absolute.toLowerCase() : absolute
    if (seen.has(key)) continue
    seen.add(key)
    if (!isDirectory(absolute)) continue
    dirs.push(absolute)
  }
  return dirs
}

/**
 * 收集包候选目录：显式 searchDirs + 当前工作目录 + DSH 相关环境变量 + npm 全局根 + NODE_PATH。
 * @param {NodeJS.ProcessEnv} env - 环境变量。
 * @param {unknown} searchDirs - 调用方传入的额外目录。
 * @returns {string[]} 已存在且去重的目录列表。
 */
function collectCandidateDirs(env, searchDirs) {
  const cwd = process.cwd()
  const candidates = []
  if (Array.isArray(searchDirs)) candidates.push(...searchDirs)
  candidates.push(cwd)
  candidates.push(env.DSH_HOME)
  candidates.push(env.INIT_CWD)
  for (const prefix of [env.npm_config_prefix, env.NPM_CONFIG_PREFIX]) {
    if (typeof prefix !== 'string' || prefix.trim() === '') continue
    // npm 全局安装根：Unix 为 <prefix>/lib/node_modules，Windows 为 <prefix>/node_modules。
    candidates.push(path.join(prefix, 'lib', 'node_modules'))
    candidates.push(path.join(prefix, 'node_modules'))
  }
  candidates.push('/usr/lib/node_modules', '/usr/local/lib/node_modules')
  if (typeof env.APPDATA === 'string' && env.APPDATA.trim() !== '') {
    candidates.push(path.join(env.APPDATA, 'npm', 'node_modules'))
  }
  if (typeof env.NODE_PATH === 'string' && env.NODE_PATH.trim() !== '') {
    candidates.push(...env.NODE_PATH.split(path.delimiter))
  }
  return uniqueExistingDirs(candidates, cwd)
}

/**
 * 从一个候选目录尝试读取指定包的 package.json。
 *
 * 同时接受 "<候选目录>/node_modules/<包>" 与 "<候选目录>/<包>" 两种布局：
 * 前者适配项目目录，后者适配 NODE_PATH / npm 全局根这类本身就是 node_modules 的目录。
 *
 * @param {string} candidateDir - 候选目录（绝对路径）。
 * @param {string} name - 包名。
 * @returns {{name: string, version: string|null, path: string, dir: string}|null} 命中信息。
 * @throws {ProbeFailure} 包存在但读不出来或 JSON 非法。
 */
function readPackageAt(candidateDir, name) {
  const packageDirs = [path.join(candidateDir, 'node_modules', name), path.join(candidateDir, name)]
  for (const packageDir of packageDirs) {
    const manifestPath = path.join(packageDir, 'package.json')
    let raw
    try {
      raw = fs.readFileSync(manifestPath, 'utf8')
    } catch (error) {
      const code = error !== null && typeof error === 'object' ? error.code : undefined
      if (code === 'ENOENT' || code === 'ENOTDIR' || code === 'EISDIR') continue
      const detail = error instanceof Error ? error.message : String(error)
      throw new ProbeFailure('PLAYWRIGHT_PACKAGE_UNREADABLE', '读取 ' + manifestPath + ' 失败：' + detail)
    }
    let manifest
    try {
      manifest = JSON.parse(raw)
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      throw new ProbeFailure('PLAYWRIGHT_PACKAGE_INVALID', manifestPath + ' 不是合法 JSON：' + detail)
    }
    const manifestObject = manifest !== null && typeof manifest === 'object' ? manifest : {}
    const version = typeof manifestObject.version === 'string' && manifestObject.version.trim() !== ''
      ? manifestObject.version
      : null
    const manifestName = typeof manifestObject.name === 'string' && manifestObject.name.trim() !== ''
      ? manifestObject.name
      : name
    return { name: manifestName, version, path: manifestPath, dir: packageDir }
  }
  return null
}

/**
 * 被动探测 playwright / playwright-core 包。
 * @param {NodeJS.ProcessEnv} env - 环境变量。
 * @param {unknown} searchDirs - 额外搜索目录。
 * @returns {{package: object, packageDir: string|null}} 包探测结果与包目录。
 */
function probePackage(env, searchDirs) {
  const searchedDirs = collectCandidateDirs(env, searchDirs)
  for (const name of PACKAGE_NAMES) {
    for (const candidateDir of searchedDirs) {
      const found = readPackageAt(candidateDir, name)
      if (found === null) continue
      return {
        package: {
          found: true,
          name: found.name,
          version: found.version,
          path: found.path,
          searchedDirs,
        },
        packageDir: found.dir,
      }
    }
  }
  return {
    package: { found: false, name: null, version: null, path: null, searchedDirs },
    packageDir: null,
  }
}

/**
 * 解析浏览器缓存目录。
 *
 * - PLAYWRIGHT_BROWSERS_PATH 为绝对/相对路径时直接使用；
 * - 为 "0" 时表示装进包内 node_modules/playwright-core/.local-browsers；
 * - 未设置时用平台默认：linux ~/.cache/ms-playwright、darwin ~/Library/Caches/ms-playwright、
 *   win32 %LOCALAPPDATA%\ms-playwright。
 *
 * @param {NodeJS.ProcessEnv} env - 环境变量。
 * @param {string|null} packageDir - 已找到的包目录，供 "0" 模式使用。
 * @returns {string|null} 缓存目录绝对路径；无法确定时为 null。
 */
function resolveBrowsersPath(env, packageDir) {
  const configured = typeof env.PLAYWRIGHT_BROWSERS_PATH === 'string' ? env.PLAYWRIGHT_BROWSERS_PATH.trim() : ''
  if (configured !== '') {
    if (configured === '0') {
      if (packageDir === null) return null
      const candidates = [
        path.join(packageDir, 'node_modules', 'playwright-core', '.local-browsers'),
        path.join(packageDir, '.local-browsers'),
      ]
      return candidates.find((candidate) => isDirectory(candidate)) ?? candidates[0]
    }
    return path.resolve(configured)
  }
  const home = firstNonEmpty(env.HOME, env.USERPROFILE) ?? os.homedir()
  if (process.platform === 'darwin') {
    return path.join(home, 'Library', 'Caches', 'ms-playwright')
  }
  if (process.platform === 'win32') {
    const localAppData = firstNonEmpty(env.LOCALAPPDATA) ?? path.join(home, 'AppData', 'Local')
    return path.join(localAppData, 'ms-playwright')
  }
  return path.join(home, '.cache', 'ms-playwright')
}

/**
 * 列出浏览器缓存目录下的条目。
 *
 * exists 表示目录本身存在；是否算“装了浏览器”由 entries 是否为空判断。
 *
 * @param {string|null} cachePath - 缓存目录。
 * @returns {{path: string|null, exists: boolean, entries: Array<{name: string, version: string|null}>}} 浏览器探测结果。
 * @throws {ProbeFailure} 目录存在但读不出来。
 */
function readBrowsers(cachePath) {
  if (cachePath === null) return { path: null, exists: false, entries: [] }
  let dirents
  try {
    dirents = fs.readdirSync(cachePath, { withFileTypes: true })
  } catch (error) {
    const code = error !== null && typeof error === 'object' ? error.code : undefined
    if (code === 'ENOENT' || code === 'ENOTDIR') return { path: cachePath, exists: false, entries: [] }
    const detail = error instanceof Error ? error.message : String(error)
    throw new ProbeFailure('PLAYWRIGHT_BROWSERS_UNREADABLE', '读取浏览器缓存目录 ' + cachePath + ' 失败：' + detail)
  }
  const entries = []
  for (const dirent of dirents) {
    const match = BROWSER_ENTRY_PATTERN.exec(dirent.name)
    if (match === null) continue
    const fullPath = path.join(cachePath, dirent.name)
    const directory = dirent.isDirectory() || (dirent.isSymbolicLink() && isDirectory(fullPath))
    if (!directory) continue
    entries.push({ name: match[1], version: match[2] })
  }
  entries.sort((left, right) => {
    if (left.name !== right.name) return left.name.localeCompare(right.name)
    return Number(left.version) - Number(right.version)
  })
  return { path: cachePath, exists: true, entries }
}

/**
 * 选择启动冒烟用的 node 可执行文件：可从 env.NODE / env.NODE_BINARY 覆盖，默认当前进程。
 * @param {NodeJS.ProcessEnv} env - 环境变量。
 * @returns {string} node 可执行文件路径。
 */
function resolveNodeBinary(env) {
  return firstNonEmpty(env.NODE, env.NODE_BINARY) ?? process.execPath
}

/**
 * 构造启动冒烟的内联脚本。
 *
 * 只做三件事：加载目标包、headless 启动 chromium、立即 close；不安装浏览器、不打开页面。
 *
 * @param {string} packageDir - 目标包目录（绝对路径）。
 * @returns {string} 传给 node -e 的脚本。
 */
function buildSmokeScript(packageDir) {
  const target = JSON.stringify(packageDir)
  return [
    "const { createRequire } = require('node:module')",
    "const { pathToFileURL } = require('node:url')",
    'const target = ' + target,
    "const req = createRequire(process.cwd() + '/__dsh_playwright_smoke__.js')",
    ';(async () => {',
    '  let mod',
    '  try {',
    '    mod = req(target)',
    '  } catch (error) {',
    "    if (error && error.code === 'ERR_REQUIRE_ESM') {",
    '      mod = await import(pathToFileURL(req.resolve(target)).href)',
    '    } else {',
    '      throw error',
    '    }',
    '  }',
    '  const playwright = mod && mod.default ? mod.default : mod',
    '  const browser = await playwright.chromium.launch({ headless: true })',
    '  try {',
    "    process.stdout.write('" + SMOKE_OK_MARKER + "' + browser.version() + '\\n')",
    '  } finally {',
    '    await browser.close()',
    '  }',
    '})().catch((error) => {',
    '  const message = error && error.stack ? error.stack : String(error)',
    "  process.stderr.write('" + SMOKE_FAIL_MARKER + "' + String(message).slice(0, 2000) + '\\n')",
    '  process.exitCode = 1',
    '})',
  ].join('\n')
}

/**
 * 从子进程输出里提取一条可读的失败原因。
 * @param {string} stderr - 标准错误。
 * @param {string} stdout - 标准输出。
 * @returns {string} 失败原因（可能为空串）。
 */
function summarizeSmokeFailure(stderr, stdout) {
  const combined = stderr + '\n' + stdout
  const index = combined.indexOf(SMOKE_FAIL_MARKER)
  if (index >= 0) {
    const rest = combined.slice(index + SMOKE_FAIL_MARKER.length)
    const newline = rest.indexOf('\n')
    return (newline >= 0 ? rest.slice(0, newline) : rest).slice(0, 800)
  }
  const line = combined
    .split('\n')
    .map((item) => item.trim())
    .find((item) => item !== '' && !item.startsWith(SMOKE_OK_MARKER))
  return line === undefined ? '' : line.slice(0, 800)
}

/**
 * 执行启动冒烟：node 子进程 headless 启动 chromium，拿到版本后立即关闭。
 *
 * 超时（默认 10s）杀掉子进程；不调用 install、不打开有头窗口、不访问网络页面。
 *
 * @param {object} input - 输入。
 * @param {string} input.packageDir - 包目录。
 * @param {NodeJS.ProcessEnv} input.env - 环境变量。
 * @param {number} input.timeoutMs - 超时毫秒数。
 * @returns {Promise<{ok: boolean, error: string|null}>} 冒烟结果。
 */
function runLaunchSmoke(input) {
  const { packageDir, env, timeoutMs } = input
  const nodeBinary = resolveNodeBinary(env)
  const childEnv = { ...env }
  if (process.platform === 'win32' && firstNonEmpty(childEnv.SystemRoot) === null) {
    childEnv.SystemRoot = firstNonEmpty(process.env.SystemRoot) ?? 'C:\\Windows'
  }
  return new Promise((resolve) => {
    let settled = false
    let stdout = ''
    let stderr = ''
    let timer = null
    /** 只允许结算一次。 */
    const finish = (value) => {
      if (settled) return
      settled = true
      if (timer !== null) clearTimeout(timer)
      resolve(value)
    }
    let child
    try {
      child = spawn(nodeBinary, ['-e', buildSmokeScript(packageDir)], {
        cwd: packageDir,
        env: childEnv,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      finish({ ok: false, error: '启动冒烟子进程失败：' + detail })
      return
    }
    timer = setTimeout(() => {
      child.kill('SIGKILL')
      finish({ ok: false, error: '启动冒烟超时（>' + timeoutMs + 'ms）' })
    }, timeoutMs)
    timer.unref?.()
    child.stdout?.on('data', (chunk) => {
      if (stdout.length < 64 * 1024) stdout += String(chunk)
    })
    child.stderr?.on('data', (chunk) => {
      if (stderr.length < 64 * 1024) stderr += String(chunk)
    })
    child.on('error', (error) => {
      const detail = error instanceof Error ? error.message : String(error)
      finish({ ok: false, error: '启动冒烟子进程失败：' + detail })
    })
    child.on('close', (code, signal) => {
      if (code === 0 && stdout.includes(SMOKE_OK_MARKER)) {
        finish({ ok: true, error: null })
        return
      }
      const detail = summarizeSmokeFailure(stderr, stdout)
      finish({
        ok: false,
        error: detail !== ''
          ? detail
          : '启动冒烟子进程退出（code=' + String(code) + '，signal=' + String(signal) + '）',
      })
    })
  })
}

/**
 * 把抛出的异常归一为 {code, message}。
 * @param {unknown} error - 异常。
 * @param {string} fallbackCode - 非 ProbeFailure 时使用的错误码。
 * @returns {{code: string, message: string}} 归一化错误。
 */
function toProbeError(error, fallbackCode) {
  if (error instanceof ProbeFailure) return { code: error.code, message: error.message }
  const detail = error instanceof Error ? error.message : String(error)
  return { code: fallbackCode, message: detail === '' ? '未知探测错误' : detail }
}

/**
 * 探测 Playwright 环境。
 *
 * 默认零副作用；只有 options.launchSmoke === true 且找到了包时才做一次启动冒烟。
 *
 * @param {object} [options] - 选项。
 * @param {NodeJS.ProcessEnv} [options.env] - 环境变量。
 * @param {string[]} [options.searchDirs] - 额外搜索目录。
 * @param {boolean} [options.launchSmoke] - 是否做启动冒烟（默认 false）。
 * @param {number} [options.timeoutMs] - 启动冒烟超时（默认 10000）。
 * @returns {Promise<{
 *   state: 'not-checked'|'missing'|'partial'|'ready'|'error',
 *   package: {found: boolean, name: string|null, version: string|null, path: string|null, searchedDirs: string[]},
 *   browsers: {path: string|null, exists: boolean, entries: Array<{name: string, version: string|null}>},
 *   fallback: {declaredInEnv: boolean, toolName: string|null},
 *   launchSmoke: {enabled: boolean, tested: boolean, ok: boolean|null, error: string|null},
 *   error: {code: string, message: string}|null,
 * }>} 探测结果。
 */
export async function probePlaywright(options = {}) {
  const env = options.env ?? process.env
  const smokeEnabled = options.launchSmoke === true
  const declared = parseFallbackDeclaration(env.WEBCTL_FALLBACK_TOOL)
  const timeoutMs = Number.isFinite(options.timeoutMs) && options.timeoutMs > 0
    ? Math.floor(options.timeoutMs)
    : DEFAULT_SMOKE_TIMEOUT_MS
  const result = {
    state: 'missing',
    package: { found: false, name: null, version: null, path: null, searchedDirs: [] },
    browsers: { path: null, exists: false, entries: [] },
    fallback: { declaredInEnv: declared !== null, toolName: declared?.toolName ?? null },
    launchSmoke: { enabled: smokeEnabled, tested: false, ok: null, error: null },
    error: null,
  }

  let packageDir = null
  try {
    const packageProbe = probePackage(env, options.searchDirs)
    result.package = packageProbe.package
    packageDir = packageProbe.packageDir
    result.browsers = readBrowsers(resolveBrowsersPath(env, packageDir))
  } catch (error) {
    result.state = 'error'
    result.error = toProbeError(error, 'PLAYWRIGHT_PROBE_FAILED')
    return result
  }

  if (result.package.found) {
    result.state = result.browsers.entries.length > 0 ? 'ready' : 'partial'
  } else {
    result.state = 'missing'
  }

  if (smokeEnabled && packageDir !== null) {
    const smoke = await runLaunchSmoke({ packageDir, env, timeoutMs })
    result.launchSmoke = { enabled: true, tested: true, ok: smoke.ok, error: smoke.error }
    if (!smoke.ok) {
      result.error = { code: 'PLAYWRIGHT_SMOKE_FAILED', message: smoke.error ?? '启动冒烟失败' }
    }
  }

  return result
}

/**
 * 解析 WEBCTL_FALLBACK_TOOL=<名字>:<工具名>。
 *
 * 空值、缺少冒号、冒号在首尾、任一侧为空都判为非法；以第一个冒号切分。
 *
 * @param {string|undefined} value - 环境变量值。
 * @returns {{name: string, toolName: string}|null} 解析结果；非法时为 null。
 */
export function parseFallbackDeclaration(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed === '') return null
  const index = trimmed.indexOf(':')
  if (index <= 0 || index === trimmed.length - 1) return null
  const name = trimmed.slice(0, index).trim()
  const toolName = trimmed.slice(index + 1).trim()
  if (name === '' || toolName === '') return null
  return { name, toolName }
}