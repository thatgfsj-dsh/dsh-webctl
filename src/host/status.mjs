/**
 * 状态快照：把 webctl 探测、MCP 握手探测与 Playwright 探测合成为设置页要显示的一份数据。
 *
 * 带短 TTL 缓存并对并发的相同请求合并；refresh 强制重算。
 */
import { probeMcpServer } from './mcp-probe.mjs'
import { probePlaywright } from './playwright.mjs'
import { probeWebctl } from './webctl.mjs'

/** 缓存有效期（毫秒）。 */
const DEFAULT_CACHE_TTL_MS = 5000

/**
 * 解析 WEBCTL_FALLBACK_TOOL=<名字>:<工具名> 形式的配置。
 * @param {unknown} raw - 配置值。
 * @returns {{raw: string, name: string, tool: string, valid: boolean}|null} 解析结果；空配置返回 null。
 */
export function parseFallbackTool(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') return null
  const value = raw.trim()
  const index = value.indexOf(':')
  if (index <= 0 || index === value.length - 1) return { raw: value, name: '', tool: '', valid: false }
  const name = value.slice(0, index).trim()
  const tool = value.slice(index + 1).trim()
  const valid = name !== '' && tool !== '' && /^[A-Za-z0-9_.-]+$/.test(name) && /^[A-Za-z0-9_.-]+$/.test(tool)
  return { raw: value, name, tool, valid }
}

/**
 * 状态服务。
 */
export class StatusService {
  /**
   * @param {object} config - 归一化后的插件配置。
   * @param {object} [deps] - 可选依赖。
   * @param {() => object|undefined} [deps.getTools] - 读取宿主 tools 服务的函数。
   * @param {() => object[]} [deps.getDegradations] - 读取最近降级记录的函数。
   */
  constructor(config, deps = {}) {
    this.config = config
    this.getTools = deps.getTools ?? null
    this.getDegradations = deps.getDegradations ?? null
    /** @type {{at: number, value: object}|null} */
    this.cache = null
    /** @type {Promise<object>|null} */
    this.inflight = null
  }

  /**
   * 读取状态；命中缓存直接返回。
   * @param {object} [options] - 选项。
   * @param {boolean} [options.refresh] - 忽略缓存。
   * @returns {Promise<object>} 状态。
   */
  async get(options = {}) {
    const refresh = options.refresh === true
    const now = Date.now()
    if (!refresh && this.cache !== null && now - this.cache.at < this.config.cacheTtlMs) {
      return { ...this.cache.value, cached: true }
    }
    if (this.inflight !== null) {
      const shared = await this.inflight
      return { ...shared, cached: true }
    }
    this.inflight = this.compute()
    try {
      const value = await this.inflight
      this.cache = { at: Date.now(), value }
      return { ...value, cached: false }
    } finally {
      this.inflight = null
    }
  }

  /**
   * 真正执行所有探测。
   * @returns {Promise<object>} 状态。
   */
  async compute() {
    const startedAt = Date.now()
    const { command, args, timeoutMs, playwright, fallbackTool } = this.config
    const declared = parseFallbackTool(fallbackTool)
    // 只有格式合法时才把声明注入探测环境：用来预览 webctl 会怎么报告回退能力。
    const probeEnv = declared !== null && declared.valid
      ? { ...process.env, WEBCTL_FALLBACK_TOOL: declared.raw }
      : process.env
    const webctl = await probeWebctl({ command, timeoutMs, env: probeEnv })
    let mcp = { state: 'skipped', serverInfo: null, protocolVersion: null, tools: [], error: null }
    if (webctl.state === 'ready' && webctl.resolvedPath !== null) {
      mcp = await probeMcpServer({ command: webctl.resolvedPath, args, timeoutMs, env: process.env })
    }
    const playwrightStatus = await probePlaywright({
      env: process.env,
      searchDirs: playwright.searchDirs,
      launchSmoke: playwright.launchSmoke,
      timeoutMs,
    })
    return composeStatus({
      webctl,
      mcp,
      playwright: playwrightStatus,
      registeredTools: this.listRegisteredTools(),
      degradations: this.listDegradations(),
      config: this.config,
      durationMs: Date.now() - startedAt,
    })
  }

  /**
   * 读取最近降级记录（没有观测者时返回空数组）。
   * @returns {object[]} 记录。
   */
  listDegradations() {
    if (this.getDegradations === null) return []
    try {
      const records = this.getDegradations()
      return Array.isArray(records) ? records.slice(0, 20) : []
    } catch {
      return []
    }
  }

  /**
   * 从宿主的 tools 服务枚举已注册的 webctl 工具（mcp__webctl__*）。
   * 这是「DSH 里工具到底出没出现」的真实信号，取不到就返回 null，不伪造。
   * @returns {string[]|null} 工具名；服务不可用时 null。
   */
  listRegisteredTools() {
    if (this.getTools === null) return null
    try {
      const tools = this.getTools()
      if (tools === undefined || tools === null || typeof tools.definitions !== 'function') return null
      const definitions = tools.definitions()
      const names = definitions
        .map((definition) => (definition !== null && typeof definition === 'object' ? definition.name : undefined))
        .filter((name) => typeof name === 'string' && name.startsWith('mcp__'))
      return names
    } catch {
      return null
    }
  }
}

/**
 * 合成最终状态与诊断列表。
 * @param {object} input - 各探测结果。
 * @returns {object} 状态。
 */
export function composeStatus(input) {
  const { webctl, mcp, playwright, registeredTools, degradations, config, durationMs } = input
  const declaredFallback = parseFallbackTool(config.fallbackTool)
  const reportedFallback = webctl.caps?.fallbackCapability ?? null
  const capsTools = webctl.caps?.tools?.map((tool) => tool.name) ?? []
  const mcpTools = Array.isArray(mcp.tools) ? mcp.tools : []
  const diagnostics = []

  if (webctl.state === 'ready') {
    diagnostics.push({ level: 'ok', code: 'WEBCTL_READY', message: 'webctl ' + webctl.version + ' 可用：' + webctl.resolvedPath })
  } else if (webctl.state === 'missing') {
    diagnostics.push({
      level: 'error',
      code: 'WEBCTL_MISSING',
      message: '没有找到 webctl 可执行文件，18 个 webctl 工具不会出现。',
      hint: '安装 webctl（https://github.com/Thatgfsj/webctl/releases），或在 profile 补丁里把 mcp-client-webctl 的 command 指向绝对路径。',
    })
  } else {
    diagnostics.push({
      level: 'error',
      code: webctl.error?.code ?? 'WEBCTL_ERROR',
      message: webctl.error?.message ?? 'webctl 探测失败',
      hint: webctl.error?.hint,
    })
  }

  if (mcp.state === 'ready') {
    diagnostics.push({
      level: 'ok',
      code: 'MCP_READY',
      message: 'webctl MCP 握手成功，tools/list 返回 ' + mcpTools.length + ' 个工具。',
    })
    const missing = capsTools.filter((name) => !mcpTools.includes(name))
    const extra = mcpTools.filter((name) => !capsTools.includes(name))
    if (missing.length > 0) {
      diagnostics.push({ level: 'warn', code: 'MCP_TOOL_DRIFT', message: 'caps 声明了但 tools/list 未出现的工具：' + missing.join(', ') })
    }
    if (extra.length > 0) {
      diagnostics.push({ level: 'warn', code: 'MCP_TOOL_DRIFT', message: 'tools/list 多出的工具：' + extra.join(', ') })
    }
  } else if (mcp.state === 'error') {
    diagnostics.push({
      level: 'error',
      code: mcp.error?.code ?? 'MCP_ERROR',
      message: 'webctl MCP 握手失败：' + (mcp.error?.message ?? '未知错误'),
      hint: '运行 webctl mcp --list-tools 手工确认；DSH 的 mcp-client 行需要同一份可执行文件。',
    })
  }

  if (Array.isArray(registeredTools)) {
    if (registeredTools.length === 0) {
      diagnostics.push({ level: 'warn', code: 'MCP_NOT_REGISTERED', message: '宿主里还没有任何 mcp__ 工具注册；mcp-client 行可能没连上。' })
    } else {
      diagnostics.push({ level: 'ok', code: 'MCP_REGISTERED', message: '宿主已注册 ' + registeredTools.length + ' 个 mcp__ 工具。' })
    }
  }

  if (declaredFallback !== null && !declaredFallback.valid) {
    diagnostics.push({
      level: 'warn',
      code: 'FALLBACK_TOOL_INVALID',
      message: 'fallbackTool 格式无效：' + declaredFallback.raw,
      hint: '应为 <名字>:<工具名>，例如 playwright:playwright_browser_snapshot（两侧只允许字母、数字、下划线、点、连字符）。',
    })
  } else if (declaredFallback !== null && webctl.state === 'ready') {
    if (reportedFallback === null) {
      diagnostics.push({
        level: 'warn',
        code: 'FALLBACK_TOOL_NOT_REPORTED',
        message: '已配置 fallbackTool，但 webctl caps 未报告 fallback_capability。',
        hint: '确认 webctl >= 0.2.3；若版本过旧，声明不会生效，也不会影响其他能力。',
      })
    } else {
      diagnostics.push({
        level: 'ok',
        code: 'FALLBACK_TOOL_ACTIVE',
        message: 'webctl 已识别回退声明：' + (reportedFallback.name ?? '') + ' → ' + (reportedFallback.tool ?? ''),
      })
    }
  }

  const fallbackPreview = {
    configured: declaredFallback !== null,
    valid: declaredFallback === null ? null : declaredFallback.valid,
    name: declaredFallback?.name ?? null,
    tool: declaredFallback?.tool ?? null,
    reported: reportedFallback,
    active: declaredFallback !== null && declaredFallback.valid && reportedFallback !== null,
  }

  const recent = Array.isArray(degradations) ? degradations.slice(0, 10) : []
  const fallbackRecords = recent.filter((record) => record !== null && typeof record === 'object' && record.fallbackHint !== null && record.fallbackHint.playwrightSuitable === true)
  const fallbackReadiness = {
    recentDegradations: recent.length,
    playwrightSuitableSeen: fallbackRecords.length > 0,
    playwrightReady: playwright.state === 'ready',
    advice: fallbackRecords.length === 0
      ? null
      : playwright.state === 'ready'
        ? '最近有适合 Playwright 的降级；回退工具可用，可按 webctl 的 next_steps 继续。'
        : '最近有适合 Playwright 的降级，但本机未就绪：安装 Playwright（含浏览器）后再回退，或继续使用 embedded_data / 已启用的 js_render。',
  }
  if (fallbackRecords.length > 0 && playwright.state !== 'ready') {
    diagnostics.push({
      level: 'warn',
      code: 'PLAYWRIGHT_FALLBACK_UNAVAILABLE',
      message: '最近 ' + fallbackRecords.length + ' 次降级建议 Playwright 回退，但 Playwright 未就绪（当前 ' + playwright.state + '）。',
      hint: '先试 embedded_data；仍拿不到内容时再安装 Playwright。不要因为缺 Playwright 放弃 webctl 的静态能力。',
    })
  }

  if (playwright.state === 'ready') {
    diagnostics.push({ level: 'ok', code: 'PLAYWRIGHT_READY', message: 'Playwright 回退通道可用。' })
  } else if (playwright.state === 'missing') {
    diagnostics.push({
      level: 'warn',
      code: 'PLAYWRIGHT_MISSING',
      message: '没有检测到 Playwright；这不会影响 webctl 的静态能力。',
      hint: '只有 JS 渲染页需要回退时才有必要安装 Playwright。',
    })
  }

  return {
    ok: true,
    checkedAt: new Date().toISOString(),
    cached: false,
    durationMs,
    webctl: {
      state: webctl.state,
      command: config.command,
      resolvedPath: webctl.resolvedPath,
      version: webctl.version,
      tools: capsTools,
      toolCount: capsTools.length,
      fallbackCapability: reportedFallback,
      fallbackPreview,
      error: webctl.error,
    },
    webctlMcp: {
      serverName: config.serverName,
      state: mcp.state,
      serverInfo: mcp.serverInfo,
      protocolVersion: mcp.protocolVersion,
      tools: mcpTools,
      toolCount: mcpTools.length,
      registeredTools,
      registeredToolCount: registeredTools === null ? null : registeredTools.length,
      error: mcp.error,
    },
    playwright,
    recentDegradations: recent,
    fallbackReadiness,
    diagnostics,
  }
}

export { DEFAULT_CACHE_TTL_MS }