/**
 * 一次性的 MCP stdio 握手探测：起一个 `webctl mcp` 子进程，发 initialize 与 tools/list，
 * 拿到真实工具清单后立即关闭。
 *
 * 这是「DSH 里的 mcp-client 行是否真能连上」的端到端健康信号；探测本身不改状态、
 * 不调用任何工具，且严格遵守 begin → initialize → initialized → tools/list → close。
 */
import { spawn } from 'node:child_process'

/** 探测用的 MCP 协议版本（服务端会协商回自己的版本）。 */
const PROTOCOL_VERSION = '2025-06-18'

/** 单次响应等待上限（毫秒）。 */
const DEFAULT_TIMEOUT_MS = 8000

/** tools/list 分页上限，防止异常服务端无限翻页。 */
const MAX_PAGES = 10

/**
 * 探测一个 stdio MCP 服务。
 * @param {object} options - 选项。
 * @param {string} options.command - 已解析的可执行文件路径。
 * @param {string[]} [options.args] - 启动参数，默认 ["mcp"]。
 * @param {number} [options.timeoutMs] - 总超时。
 * @param {NodeJS.ProcessEnv} [options.env] - 环境变量。
 * @param {string} [options.cwd] - 工作目录。
 * @returns {Promise<object>} 探测结果：state=ready 时带 serverInfo/protocolVersion/tools。
 */
export function probeMcpServer(options) {
  const { command, args = ['mcp'], timeoutMs = DEFAULT_TIMEOUT_MS, env = process.env, cwd } = options
  return new Promise((resolve) => {
    let child
    try {
      child = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env,
        cwd,
        windowsHide: true,
        shell: false,
      })
    } catch (error) {
      resolve(errorResult('MCP_SPAWN_FAILED', messageOf(error)))
      return
    }

    let buffer = ''
    let stderr = ''
    let settled = false
    let serverInfo = null
    let protocolVersion = null
    let nextId = 2
    const tools = []
    let pages = 0

    /** 结束探测并清理子进程（幂等）。 */
    const finish = (result) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try {
        child.stdin?.end()
      } catch {
        // 管道可能已关闭。
      }
      try {
        child.kill('SIGKILL')
      } catch {
        // 进程可能已退出。
      }
      resolve({ ...result, stderr: stderr.slice(0, 400) })
    }

    const timer = setTimeout(() => {
      finish(errorResult('MCP_TIMEOUT', `MCP 握手超时（${timeoutMs}ms）`))
    }, timeoutMs)

    /** 发送一条 JSON-RPC 消息。 */
    const send = (message) => {
      try {
        child.stdin?.write(`${JSON.stringify(message)}\n`)
      } catch (error) {
        finish(errorResult('MCP_WRITE_FAILED', messageOf(error)))
      }
    }

    /** 请求工具清单（支持分页）。 */
    const requestTools = (cursor) => {
      pages += 1
      if (pages > MAX_PAGES) {
        finish(errorResult('MCP_PAGINATION', 'tools/list 分页次数超限'))
        return
      }
      send({
        jsonrpc: '2.0',
        id: nextId,
        method: 'tools/list',
        params: cursor === undefined ? {} : { cursor },
      })
    }

    /** 处理一条完整的 JSON-RPC 消息。 */
    const handleMessage = (message) => {
      if (message === null || typeof message !== 'object') return
      const payload = /** @type {Record<string, unknown>} */ (message)
      if (payload.id === 1) {
        const result = payload.result
        if (result !== null && typeof result === 'object') {
          serverInfo = /** @type {Record<string, unknown>} */ (result).serverInfo ?? null
          protocolVersion = /** @type {Record<string, unknown>} */ (result).protocolVersion ?? null
          send({ jsonrpc: '2.0', method: 'notifications/initialized' })
          requestTools(undefined)
        } else {
          finish(errorResult('MCP_INITIALIZE_FAILED', JSON.stringify(payload.error ?? null)))
        }
        return
      }
      if (typeof payload.id !== 'number' || payload.id < 2) return
      const result = payload.result
      if (result === null || typeof result !== 'object') {
        finish(errorResult('MCP_LIST_FAILED', JSON.stringify(payload.error ?? null)))
        return
      }
      const page = /** @type {Record<string, unknown>} */ (result)
      if (Array.isArray(page.tools)) {
        for (const item of page.tools) {
          if (item !== null && typeof item === 'object' && typeof item.name === 'string') tools.push(item.name)
        }
      }
      const cursor = page.nextCursor
      if (typeof cursor === 'string' && cursor !== '') {
        nextId += 1
        requestTools(cursor)
        return
      }
      finish({ state: 'ready', serverInfo, protocolVersion, tools, error: null })
    }

    child.stdout?.on('data', (chunk) => {
      buffer += chunk.toString('utf8')
      for (;;) {
        const index = buffer.indexOf('\n')
        if (index < 0) break
        const line = buffer.slice(0, index).trim()
        buffer = buffer.slice(index + 1)
        if (line === '') continue
        let message
        try {
          message = JSON.parse(line)
        } catch {
          continue
        }
        handleMessage(message)
        if (settled) return
      }
    })
    child.stderr?.on('data', (chunk) => {
      if (stderr.length < 2000) stderr += chunk.toString('utf8')
    })
    child.on('error', (error) => {
      finish(errorResult('MCP_SPAWN_FAILED', messageOf(error)))
    })
    child.on('close', (code) => {
      finish(errorResult('MCP_CLOSED', `webctl mcp 在握手完成前退出（code=${String(code)}）`))
    })

    send({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: 'dsh-webctl', version: '0.1.0' },
      },
    })
  })
}

/**
 * 构造失败结果。
 * @param {string} code - 诊断码。
 * @param {string} message - 可读信息。
 * @returns {object} 结果。
 */
function errorResult(code, message) {
  return { state: 'error', serverInfo: null, protocolVersion: null, tools: [], error: { code, message } }
}

/**
 * 错误转文案。
 * @param {unknown} error - 错误。
 * @returns {string} 文案。
 */
function messageOf(error) {
  return error instanceof Error ? error.message : String(error)
}