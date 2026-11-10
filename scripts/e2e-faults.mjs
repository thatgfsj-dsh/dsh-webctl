/**
 * 隔离实例故障矩阵（#19）：在临时 DSH_HOME 里分别制造两类故障，验证状态页仍可诊断而不是崩溃。
 *
 * 用例：
 *  A. webctl 不存在：两行 command 指向不存在的路径 -> WEBCTL_MISSING + 0 个已注册工具 + HTTP 200。
 *  B. 工具行被禁用：disable mcp-client-webctl -> webctl 探测正常，但宿主 0 个已注册工具 + MCP_NOT_REGISTERED。
 *
 * 用法：node scripts/e2e-faults.mjs [--webctl /path/to/webctl]
 * 退出码：0 通过；1 失败；2 跳过（缺 dsh 或 webctl）。
 */
import { spawn, spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const PROFILE = 'webctl-faults'
const BOOT_TIMEOUT_MS = 90000
const HTTP_TIMEOUT_MS = 30000

/**
 * 解析参数。
 * @param {string[]} argv - 参数。
 * @returns {{webctl: string}} 选项。
 */
function parseArgs(argv) {
  let webctl = 'webctl'
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--webctl') {
      const value = argv[index + 1]
      if (typeof value !== 'string' || value === '') throw new Error('--webctl 需要一个路径')
      webctl = value
      index += 1
    }
  }
  return { webctl }
}

/**
 * 在 PATH 里找命令。
 * @param {string} command - 命令。
 * @returns {string|null} 路径。
 */
function which(command) {
  const result = spawnSync('which', [command], { encoding: 'utf8' })
  if (result.status !== 0) return null
  const path = result.stdout.trim()
  return path === '' ? null : path
}

/**
 * 打印步骤。
 * @param {string} message - 文案。
 * @returns {void}
 */
function step(message) {
  process.stdout.write('[faults] ' + message + '\n')
}

/**
 * 运行命令，失败即抛。
 * @param {string} command - 命令。
 * @param {string[]} args - 参数。
 * @param {NodeJS.ProcessEnv} env - 环境。
 * @returns {void}
 */
function runOrThrow(command, args, env) {
  const result = spawnSync(command, args, { encoding: 'utf8', env, cwd: ROOT })
  if (result.status !== 0) {
    throw new Error(command + ' ' + args.join(' ') + ' 失败：' + (result.stderr || result.stdout || '').slice(0, 800))
  }
}

/**
 * 等启动 URL。
 * @param {import('node:child_process').ChildProcess} child - 进程。
 * @param {number} timeoutMs - 超时。
 * @returns {Promise<{base: string, token: string}>} 地址与 token。
 */
function waitForUrl(child, timeoutMs) {
  return new Promise((resolve, reject) => {
    let buffer = ''
    const timer = setTimeout(() => reject(new Error('等待启动超时：' + buffer.slice(-1200))), timeoutMs)
    const onData = (chunk) => {
      buffer += chunk.toString('utf8')
      const match = /http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)/.exec(buffer)
      if (match !== null) {
        clearTimeout(timer)
        child.stdout.off('data', onData)
        resolve({ base: 'http://127.0.0.1:' + match[1], token: match[2] })
      }
    }
    child.stdout.on('data', onData)
    child.on('exit', (code) => {
      clearTimeout(timer)
      reject(new Error('实例提前退出（code=' + String(code) + '）：' + buffer.slice(-1500)))
    })
  })
}

/**
 * 带超时的 fetch。
 * @param {string} url - 地址。
 * @param {object} [options] - 选项。
 * @returns {Promise<Response>} 响应。
 */
async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 断言。
 * @param {unknown} condition - 条件。
 * @param {string} message - 失败文案。
 * @returns {void}
 */
function assert(condition, message) {
  if (!condition) throw new Error('断言失败：' + message)
}

/**
 * 启动一次实例并返回状态快照。
 * @param {object} options - 选项。
 * @param {string} options.home - DSH_HOME。
 * @param {string} options.overlayPath - overlay 文件。
 * @param {string} options.label - 用例名。
 * @returns {Promise<object>} 状态 JSON。
 */
async function runCase(options) {
  const env = { ...process.env, DSH_HOME: options.home }
  step(options.label + '：启动实例…')
  const child = spawn('dsh', ['--profile', PROFILE, '--patch', options.overlayPath, '--port', '0', '--no-open'], {
    env,
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  try {
    const { base, token } = await waitForUrl(child, BOOT_TIMEOUT_MS)
    const login = await fetchWithTimeout(base + '/?token=' + token, { redirect: 'manual' })
    const cookies = typeof login.headers.getSetCookie === 'function' ? login.headers.getSetCookie() : []
    assert(cookies.length > 0, options.label + '：登录未下发 cookie')
    const cookie = cookies.map((item) => item.split(';')[0]).join('; ')
    const page = await fetchWithTimeout(base + '/', { headers: { cookie } })
    assert(page.status === 200, options.label + '：页面应 200')
    const response = await fetchWithTimeout(base + '/api/dsh-webctl/status?refresh=1', { headers: { cookie } })
    assert(response.status === 200, options.label + '：状态接口应 200，实际 ' + String(response.status))
    const status = await response.json()
    assert(status.ok === true, options.label + '：状态接口应 ok')
    return status
  } finally {
    child.kill('SIGTERM')
    await new Promise((resolve) => setTimeout(resolve, 1200))
    if (child.exitCode === null) child.kill('SIGKILL')
  }
}

/**
 * 主流程。
 * @returns {Promise<number>} 退出码。
 */
async function main() {
  const options = parseArgs(process.argv.slice(2))
  const dshVersion = spawnSync('dsh', ['--version'], { encoding: 'utf8' })
  if (dshVersion.status !== 0) {
    step('跳过：PATH 里没有可用的 dsh')
    return 2
  }
  const webctlPath = isAbsolute(options.webctl) ? options.webctl : which(options.webctl)
  if (webctlPath === null) {
    step('跳过：找不到 webctl（' + options.webctl + '）')
    return 2
  }
  step('dsh ' + dshVersion.stdout.trim() + '，webctl ' + webctlPath)

  const tempRoot = await mkdtemp(join(tmpdir(), 'dsh-webctl-faults-'))
  const home = join(tempRoot, 'home')
  await mkdir(home, { recursive: true })
  const env = { ...process.env, DSH_HOME: home }
  try {
    runOrThrow('dsh', ['--profile', PROFILE, '--from-default-profile', 'web', '--dump-config'], env)
    runOrThrow('dsh', ['plugin', '--profile', PROFILE, 'add', ROOT], env)

    // 用例 A：两行都指向不存在的 webctl。
    const missingOverlay = join(tempRoot, 'missing.yml')
    await writeFile(missingOverlay, [
      '- id: dsh-webctl',
      '  config:',
      '    command: /nonexistent/webctl-does-not-exist',
      '    args: [mcp]',
      '- id: mcp-client-webctl',
      '  config:',
      '    transport: stdio',
      '    serverName: webctl',
      '    command: /nonexistent/webctl-does-not-exist',
      '    args: [mcp]',
      '    failOnStartupError: false',
      '',
    ].join('\n'))
    const missing = await runCase({ home, overlayPath: missingOverlay, label: 'A/webctl 缺失' })
    const missingCodes = missing.diagnostics.map((item) => item.code)
    assert(missing.webctl.state === 'missing', 'A：webctl 应 missing')
    assert(missingCodes.includes('WEBCTL_MISSING'), 'A：应报告 WEBCTL_MISSING')
    assert(missing.webctlMcp.registeredToolCount === 0, 'A：不应注册任何 webctl 工具')
    assert(missing.webctlMcp.state === 'skipped', 'A：MCP 探测应 skipped')
    step('A 通过：missing + 0 工具 + 诊断可读')

    // 用例 B：禁用官方 mcp-client 行。
    const disabledOverlay = join(tempRoot, 'disabled.yml')
    await writeFile(disabledOverlay, [
      '- id: dsh-webctl',
      '  config:',
      '    command: ' + JSON.stringify(webctlPath),
      '    args: [mcp]',
      '- id: mcp-client-webctl',
      '  disabled: true',
      '  config:',
      '    transport: stdio',
      '    serverName: webctl',
      '    command: ' + JSON.stringify(webctlPath),
      '    args: [mcp]',
      '    failOnStartupError: false',
      '',
    ].join('\n'))
    const disabled = await runCase({ home, overlayPath: disabledOverlay, label: 'B/工具行禁用' })
    const disabledCodes = disabled.diagnostics.map((item) => item.code)
    assert(disabled.webctl.state === 'ready', 'B：webctl 探测应 ready')
    assert(disabled.webctlMcp.registeredToolCount === 0, 'B：不应注册任何 webctl 工具')
    assert(disabledCodes.includes('MCP_NOT_REGISTERED'), 'B：应报告 MCP_NOT_REGISTERED')
    step('B 通过：webctl ready + 0 已注册工具 + 诊断可读')

    step('全部故障用例通过')
    return 0
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    process.stderr.write('[faults] 失败：' + (error instanceof Error ? error.message : String(error)) + '\n')
    process.exit(1)
  })
