/**
 * webctl 发现与能力探测：解析可执行文件、读版本、读 `caps --json`。
 *
 * 只做只读探测，不联网、不写盘；所有子进程都受超时与输出上限约束。
 */
import { accessSync, constants, statSync } from 'node:fs'
import { delimiter, isAbsolute, join } from 'node:path'
import { runCommand } from './proc.mjs'

/** webctl 缺少时的诊断码。 */
export const WEBCTL_MISSING = 'WEBCTL_MISSING'

/** 可执行文件是否可运行。 */
function isExecutableFile(candidate, platform = process.platform) {
  try {
    const stat = statSync(candidate)
    if (!stat.isFile()) return false
    if (platform === 'win32') return true
    accessSync(candidate, constants.X_OK)
    return true
  } catch {
    return false
  }
}

/**
 * 解析命令对应的可执行文件路径。
 * @param {string} command - 命令名或路径。
 * @param {NodeJS.ProcessEnv} [env] - 环境变量（PATH/PATHEXT）。
 * @param {string} [platform] - 平台标识（测试用）。
 * @returns {string|null} 绝对路径；找不到返回 null。
 */
export function resolveExecutable(command, env = process.env, platform = process.platform) {
  if (typeof command !== 'string' || command.trim() === '') return null
  const trimmed = command.trim()
  const hasSeparator = trimmed.includes('/') || (platform === 'win32' && trimmed.includes('\\'))
  if (hasSeparator || isAbsolute(trimmed)) {
    return isExecutableFile(trimmed, platform) ? trimmed : null
  }
  const pathValue = env.PATH ?? env.Path ?? ''
  const extensions = platform === 'win32'
    ? (env.PATHEXT ?? '.EXE;.CMD;.BAT;.COM').split(';').filter(Boolean)
    : ['']
  for (const directory of pathValue.split(delimiter)) {
    if (!directory) continue
    for (const extension of extensions) {
      const candidate = join(directory, trimmed + extension)
      if (isExecutableFile(candidate, platform)) return candidate
    }
  }
  return null
}

/**
 * 解析 `--version` 输出里的版本号。
 * @param {string} stdout - 标准输出。
 * @returns {string|null} 版本号。
 */
export function parseVersion(stdout) {
  const match = /\b(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\b/.exec(stdout)
  return match === null ? null : match[1]
}

/**
 * 把 caps 信封压成状态页需要的形状。
 * @param {unknown} payload - 解析后的 JSON。
 * @returns {object|null} 归一化能力；格式不符返回 null。
 */
export function normalizeCaps(payload) {
  if (payload === null || typeof payload !== 'object') return null
  const envelope = /** @type {{ ok?: unknown, data?: unknown }} */ (payload)
  if (envelope.ok !== true || envelope.data === null || typeof envelope.data !== 'object') return null
  const data = /** @type {Record<string, unknown>} */ (envelope.data)
  const tools = Array.isArray(data.tools)
    ? data.tools
      .filter((item) => item !== null && typeof item === 'object')
      .map((item) => {
        const tool = /** @type {Record<string, unknown>} */ (item)
        return { name: String(tool.name ?? ''), state: String(tool.state ?? 'unknown') }
      })
      .filter((tool) => tool.name !== '')
    : []
  const fallback = data.fallback_capability ?? data.fallbackCapability ?? null
  return {
    version: typeof data.version === 'string' ? data.version : null,
    tools,
    fallbackCapability: fallback === null || typeof fallback !== 'object' ? null : fallback,
  }
}

/**
 * 探测 webctl 可执行文件与能力。
 * @param {object} options - 选项。
 * @param {string} options.command - 配置里的命令。
 * @param {number} [options.timeoutMs] - 单次探测超时。
 * @param {NodeJS.ProcessEnv} [options.env] - 环境变量。
 * @param {string} [options.cwd] - 工作目录。
 * @returns {Promise<object>} 探测结果。
 */
export async function probeWebctl(options) {
  const { command, timeoutMs = 8000, env = process.env, cwd } = options
  const resolvedPath = resolveExecutable(command, env)
  if (resolvedPath === null) {
    return {
      state: 'missing',
      command,
      resolvedPath: null,
      version: null,
      caps: null,
      error: {
        code: WEBCTL_MISSING,
        message: `找不到 webctl 可执行文件：${command}`,
        hint: '安装 webctl，或在 profile 的 cordis.patch.yml 里把 mcp-client-webctl 的 command 改成绝对路径。',
      },
    }
  }

  const versionRun = await runCommand(resolvedPath, ['--version'], { timeoutMs, env, cwd })
  if (versionRun.spawnError !== undefined) {
    return {
      state: 'error',
      command,
      resolvedPath,
      version: null,
      caps: null,
      error: { code: 'WEBCTL_SPAWN_FAILED', message: versionRun.spawnError },
    }
  }
  const version = parseVersion(versionRun.stdout)
  if (!versionRun.ok || version === null) {
    return {
      state: 'error',
      command,
      resolvedPath,
      version: null,
      caps: null,
      error: {
        code: 'WEBCTL_VERSION_FAILED',
        message: versionRun.timedOut ? 'webctl --version 超时' : 'webctl --version 未返回可识别的版本号',
        detail: trimDetail(versionRun.stderr || versionRun.stdout),
      },
    }
  }

  const capsRun = await runCommand(resolvedPath, ['caps', '--json'], { timeoutMs, env, cwd })
  let caps = null
  if (capsRun.ok) {
    try {
      caps = normalizeCaps(JSON.parse(capsRun.stdout))
    } catch {
      caps = null
    }
  }
  if (caps === null) {
    return {
      state: 'error',
      command,
      resolvedPath,
      version,
      caps: null,
      error: {
        code: 'WEBCTL_CAPS_FAILED',
        message: capsRun.timedOut ? 'webctl caps --json 超时' : 'webctl caps --json 返回无法解析的内容',
        detail: trimDetail(capsRun.stderr || capsRun.stdout),
      },
    }
  }

  return { state: 'ready', command, resolvedPath, version, caps, error: null }
}

/**
 * 截断诊断用文本，避免把大段输出塞进状态页。
 * @param {string} text - 原文。
 * @param {number} [limit] - 上限字符数。
 * @returns {string} 截断后的文本。
 */
export function trimDetail(text, limit = 400) {
  const normalized = String(text ?? '').trim()
  return normalized.length <= limit ? normalized : `${normalized.slice(0, limit)}…`
}
