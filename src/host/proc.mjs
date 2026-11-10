import { spawn } from 'node:child_process'

/**
 * 受控子进程执行：只用 spawn（shell=false），带超时、输出字节上限与错误归一化。
 *
 * 不执行 shell 字符串，避免命令注入；调用方传 argv 数组。
 */

/** 默认单次探测超时（毫秒）。 */
export const DEFAULT_TIMEOUT_MS = 8000

/** 默认每路输出上限（字节）；超出后截断并标记。 */
export const DEFAULT_MAX_OUTPUT_BYTES = 256 * 1024

/**
 * 归一化的进程执行结果。
 * @typedef {object} RunResult
 * @property {boolean} ok - 退出码为 0 且未超时。
 * @property {number|null} code - 退出码。
 * @property {string|null} signal - 终止信号。
 * @property {boolean} timedOut - 是否因超时被终止。
 * @property {string} stdout - 标准输出（可能被截断）。
 * @property {string} stderr - 标准错误（可能被截断）。
 * @property {string} [spawnError] - 无法启动时的错误文案。
 */

/**
 * 追加受上限约束的文本。
 * @param {string} current - 已有内容。
 * @param {Buffer} chunk - 新数据块。
 * @param {number} maxBytes - 上限。
 * @returns {string} 追加后的内容（含截断标记）。
 */
function appendBounded(current, chunk, maxBytes) {
  if (current.length >= maxBytes) return current
  const text = chunk.toString('utf8')
  if (current.length + text.length <= maxBytes) return current + text
  return current + text.slice(0, maxBytes - current.length) + '\n[输出已截断]'
}

/**
 * 执行一个命令并收集输出。
 * @param {string} command - 可执行文件路径或命令名。
 * @param {string[]} [args] - 参数数组。
 * @param {object} [options] - 选项。
 * @param {number} [options.timeoutMs] - 超时毫秒。
 * @param {NodeJS.ProcessEnv} [options.env] - 子进程环境。
 * @param {string} [options.cwd] - 工作目录。
 * @param {string} [options.input] - 写入 stdin 的内容（写完即关闭）。
 * @param {number} [options.maxOutputBytes] - 每路输出上限。
 * @returns {Promise<RunResult>} 执行结果。
 */
export function runCommand(command, args = [], options = {}) {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    env = process.env,
    cwd,
    input,
    maxOutputBytes = DEFAULT_MAX_OUTPUT_BYTES,
  } = options

  return new Promise((resolve) => {
    let child
    try {
      child = spawn(command, args, {
        stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
        env,
        cwd,
        windowsHide: true,
        shell: false,
      })
    } catch (error) {
      resolve(failureResult(error))
      return
    }

    let stdout = ''
    let stderr = ''
    let settled = false
    let timedOut = false

    /** 结束并返回结果（幂等）。 */
    const finish = (extra = {}) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({
        ok: extra.ok ?? false,
        code: extra.code ?? null,
        signal: extra.signal ?? null,
        timedOut,
        stdout,
        stderr,
        ...(extra.spawnError === undefined ? {} : { spawnError: extra.spawnError }),
      })
    }

    const timer = setTimeout(() => {
      timedOut = true
      try {
        child.kill('SIGKILL')
      } catch {
        // 进程可能已退出。
      }
    }, timeoutMs)

    child.stdout?.on('data', (chunk) => {
      stdout = appendBounded(stdout, chunk, maxOutputBytes)
    })
    child.stderr?.on('data', (chunk) => {
      stderr = appendBounded(stderr, chunk, maxOutputBytes)
    })
    child.on('error', (error) => {
      finish({ ok: false, spawnError: errorMessage(error) })
    })
    child.on('close', (code, signal) => {
      finish({ ok: code === 0 && !timedOut, code, signal })
    })

    if (input !== undefined && child.stdin) {
      child.stdin.on('error', () => {})
      child.stdin.end(input)
    }
  })
}

/**
 * 把任意错误转成可读文案。
 * @param {unknown} error - 错误对象。
 * @returns {string} 文案。
 */
export function errorMessage(error) {
  if (error instanceof Error) return error.message
  return String(error)
}

/**
 * 启动失败时的结果对象。
 * @param {unknown} error - 错误。
 * @returns {RunResult} 结果。
 */
function failureResult(error) {
  return {
    ok: false,
    code: null,
    signal: null,
    timedOut: false,
    stdout: '',
    stderr: '',
    spawnError: errorMessage(error),
  }
}