/**
 * 隔离实例端到端冒烟（#19）：临时 DSH_HOME → 建 web 测试 profile → 安装本插件 → 启动 → 校验状态接口与客户端 bundle。
 *
 * 不会触碰用户真实的 ~/.dsh：所有状态都在临时目录，结束后删除。
 *
 * 用法：
 *   node scripts/e2e-smoke.mjs                       # webctl 从 PATH 解析
 *   node scripts/e2e-smoke.mjs --webctl /abs/webctl  # 指定二进制
 *   node scripts/e2e-smoke.mjs --keep                # 保留临时目录便于排查
 *
 * 退出码：0 通过；1 失败；2 跳过（缺少 dsh 或 webctl）。
 */
import { spawn, spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const PROFILE = 'webctl-e2e'
const BOOT_TIMEOUT_MS = 90000
const HTTP_TIMEOUT_MS = 30000

/**
 * 解析命令行参数。
 * @param {string[]} argv - 参数。
 * @returns {{webctl: string, keep: boolean}} 选项。
 */
function parseArgs(argv) {
  let webctl = 'webctl'
  let keep = false
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--keep') keep = true
    else if (arg === '--webctl') {
      const value = argv[index + 1]
      if (typeof value !== 'string' || value === '') throw new Error('--webctl 需要一个路径')
      webctl = value
      index += 1
    }
  }
  return { webctl, keep }
}

/**
 * 在 PATH 里找可执行文件。
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
 * 打印一行步骤。
 * @param {string} message - 文案。
 * @returns {void}
 */
function step(message) {
  process.stdout.write('[e2e] ' + message + '\n')
}

/**
 * 运行一个同步命令，失败时抛出带输出的错误。
 * @param {string} command - 命令。
 * @param {string[]} args - 参数。
 * @param {NodeJS.ProcessEnv} env - 环境。
 * @returns {void}
 */
function runOrThrow(command, args, env) {
  const result = spawnSync(command, args, { encoding: 'utf8', env, cwd: ROOT })
  if (result.status !== 0) {
    throw new Error(command + ' ' + args.join(' ') + ' 失败（code=' + String(result.status) + '）\n' + (result.stderr || result.stdout || ''))
  }
}

/**
 * 等待启动输出里出现 Web UI URL。
 * @param {import('node:child_process').ChildProcess} child - 子进程。
 * @param {number} timeoutMs - 超时。
 * @returns {Promise<{base: string, token: string}>} 地址与 token。
 */
function waitForUrl(child, timeoutMs) {
  return new Promise((resolvePromise, reject) => {
    let buffer = ''
    const timer = setTimeout(() => reject(new Error('等待 dsh 启动超时：' + buffer.slice(-1500))), timeoutMs)
    const onData = (chunk) => {
      buffer += chunk.toString('utf8')
      const match = /http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)/.exec(buffer)
      if (match !== null) {
        clearTimeout(timer)
        child.stdout.off('data', onData)
        resolvePromise({ base: 'http://127.0.0.1:' + match[1], token: match[2] })
      }
    }
    child.stdout.on('data', onData)
    child.on('exit', (code) => {
      clearTimeout(timer)
      reject(new Error('dsh 在启动完成前退出（code=' + String(code) + '）：' + buffer.slice(-2000)))
    })
  })
}

/**
 * 带超时的 fetch。
 * @param {string} url - 地址。
 * @param {object} [options] - fetch 选项。
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
 * 断言辅助。
 * @param {unknown} condition - 条件。
 * @param {string} message - 失败文案。
 * @returns {void}
 */
function assert(condition, message) {
  if (!condition) throw new Error('断言失败：' + message)
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

  const tempRoot = await mkdtemp(join(tmpdir(), 'dsh-webctl-e2e-'))
  const home = join(tempRoot, 'home')
  await mkdir(home, { recursive: true })
  const env = { ...process.env, DSH_HOME: home }
  const overlay = join(tempRoot, 'overlay.yml')
  const overlayText = [
    '# e2e：把两行命令都指向被测 webctl',
    '- id: dsh-webctl',
    '  config:',
    '    command: ' + JSON.stringify(webctlPath),
    '    args: [mcp]',
    '    timeoutMs: 8000',
    '    serverName: webctl',
    '- id: mcp-client-webctl',
    '  config:',
    '    transport: stdio',
    '    serverName: webctl',
    '    command: ' + JSON.stringify(webctlPath),
    '    args: [mcp]',
    '    toolCallTimeoutMs: 60000',
    '    failOnStartupError: false',
    '',
  ].join('\n')
  await writeFile(overlay, overlayText)

  let child = null
  try {
    step('创建隔离 profile…')
    runOrThrow('dsh', ['--profile', PROFILE, '--from-default-profile', 'web', '--dump-config'], env)
    step('安装插件…')
    runOrThrow('dsh', ['plugin', '--profile', PROFILE, 'add', ROOT], env)
    step('启动实例…')
    child = spawn('dsh', ['--profile', PROFILE, '--patch', overlay, '--port', '0', '--no-open'], {
      env,
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const { base, token } = await waitForUrl(child, BOOT_TIMEOUT_MS)
    step('实例已启动：' + base)

    const login = await fetchWithTimeout(base + '/?token=' + token, { redirect: 'manual' })
    const cookies = typeof login.headers.getSetCookie === 'function' ? login.headers.getSetCookie() : []
    assert(cookies.length > 0, '登录 / 未下发会话 cookie')
    const cookie = cookies.map((item) => item.split(';')[0]).join('; ')

    const page = await fetchWithTimeout(base + '/', { headers: { cookie } })
    const html = await page.text()
    assert(page.status === 200, '页面状态应为 200，实际 ' + String(page.status))
    assert(html.includes('dsh-webctl'), '页面启动图应包含 dsh-webctl')
    const bundleMatch = /plugins\/\?\?dsh-webctl\/client\.js[^"]*/.exec(html)
    assert(bundleMatch !== null, '启动图应给出客户端 bundle 地址')

    const bundle = await fetchWithTimeout(base + '/' + bundleMatch[0], { headers: { cookie } })
    const bundleText = await bundle.text()
    assert(bundle.status === 200, 'client bundle 状态应为 200')
    assert(bundleText.includes('settings.section'), 'client bundle 应包含 settings.section 注册')

    step('检查状态接口…')
    const statusResponse = await fetchWithTimeout(base + '/api/dsh-webctl/status?refresh=1', { headers: { cookie } })
    const status = await statusResponse.json()
    assert(statusResponse.status === 200 && status.ok === true, '状态接口应返回 ok')
    assert(status.webctl.state === 'ready', 'webctl 应为 ready，实际 ' + String(status.webctl.state))
    assert(typeof status.webctl.version === 'string', '应报告 webctl 版本')
    assert(status.webctlMcp.state === 'ready', 'MCP 握手应为 ready')
    assert(Array.isArray(status.webctl.tools) && status.webctl.tools.length >= 15, 'caps 应报告工具面')
    assert(typeof status.webctlMcp.registeredToolCount === 'number' && status.webctlMcp.registeredToolCount >= 15, '宿主应注册 mcp__webctl__* 工具')
    assert(Array.isArray(status.diagnostics) && status.diagnostics.some((item) => item.code === 'MCP_REGISTERED'), '诊断应包含 MCP_REGISTERED')
    assert(Array.isArray(status.recentDegradations), '应返回 recentDegradations 字段')

    step('通过：webctl ' + status.webctl.version + '，工具 ' + String(status.webctl.toolCount) + '，已注册 ' + String(status.webctlMcp.registeredToolCount))
    return 0
  } finally {
    if (child !== null) {
      child.kill('SIGTERM')
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 1500))
      if (child.exitCode === null) child.kill('SIGKILL')
    }
    if (options.keep) step('保留临时目录：' + tempRoot)
    else await rm(tempRoot, { recursive: true, force: true })
  }
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    process.stderr.write('[e2e] 失败：' + (error instanceof Error ? error.message : String(error)) + '\n')
    process.exit(1)
  })
