/**
 * dsh-webctl 宿主半边：
 * - 注册 /api/dsh-webctl/status 诊断接口（webctl 可执行文件、版本、caps、MCP 握手、Playwright）；
 * - 启动后预热一次状态缓存，让设置页首次打开就有数据；
 * - 不 import 任何 @deepseek-ai/* 包，只用 Node 内置模块与本仓库相对路径。
 *
 * 18 个 webctl 工具由官方 @deepseek-ai/dsh-mcp-client 行（mcp-client-webctl）注册，
 * 本插件不重复实现工具，只负责诊断与展示。
 */
import { DegradationLog } from './src/host/degradations.mjs'
import { json, queryParam, withErrors } from './src/host/http.mjs'
import { StatusService } from './src/host/status.mjs'

/** 路由前缀。 */
const BASE = '/api/dsh-webctl'

/** 预热延迟：等宿主把 connection 等服务挂好。 */
const WARMUP_DELAY_MS = 2500

/**
 * 把行配置归一化；缺省值与类型错误都兜住，配置错误不应让插件挂掉。
 * @param {unknown} raw - 行配置。
 * @returns {object} 归一化配置。
 */
export function normalizeConfig(raw) {
  const config = raw !== null && typeof raw === 'object' ? raw : {}
  const playwright = config.playwright !== null && typeof config.playwright === 'object' ? config.playwright : {}
  const command = typeof config.command === 'string' && config.command.trim() !== '' ? config.command.trim() : 'webctl'
  const args = Array.isArray(config.args) && config.args.every((item) => typeof item === 'string')
    ? config.args.slice()
    : ['mcp']
  const timeoutMs = Number.isFinite(config.timeoutMs) && config.timeoutMs > 0 ? config.timeoutMs : 8000
  const cacheTtlMs = Number.isFinite(config.cacheTtlMs) && config.cacheTtlMs >= 0 ? config.cacheTtlMs : 5000
  const searchDirs = Array.isArray(playwright.searchDirs)
    ? playwright.searchDirs.filter((item) => typeof item === 'string' && item.trim() !== '')
    : []
  const fallbackTool = typeof config.fallbackTool === 'string' ? config.fallbackTool.trim() : ''
  return {
    command,
    args,
    timeoutMs,
    cacheTtlMs,
    serverName: typeof config.serverName === 'string' && config.serverName !== '' ? config.serverName : 'webctl',
    fallbackTool,
    playwright: { searchDirs, launchSmoke: playwright.launchSmoke === true },
  }
}

/**
 * 挂载宿主半边。
 * @param {object} ctx - 宿主插件上下文。
 * @param {unknown} [config] - 行配置。
 * @returns {void}
 */
export function apply(ctx, config) {
  const resolved = normalizeConfig(config)
  const degradations = new DegradationLog()
  const status = new StatusService(resolved, {
    getTools: () => ctx.get('tools'),
    getDegradations: () => degradations.list(),
  })

  // 只观测 webctl 工具结果里的降级信封与 fallback_hint；不改写结果、不发起额外调用。
  ctx.on('tools/result', (exec, result) => {
    degradations.recordToolResult(exec, result)
  })
  try {
    ctx.logger?.info?.(`[dsh-webctl] 已加载：webctl 命令 ${resolved.command}，serverName=${resolved.serverName}`)
  } catch {
    // 日志不可用不影响功能。
  }

  const warmup = setTimeout(() => {
    status.get({ refresh: true }).catch((error) => {
      try {
        ctx.logger?.warn?.(`[dsh-webctl] 预热状态失败：${error instanceof Error ? error.message : String(error)}`)
      } catch {
        // 忽略日志失败。
      }
    })
  }, WARMUP_DELAY_MS)
  warmup.unref?.()
  ctx.effect(() => () => clearTimeout(warmup), 'dsh-webctl: 预热定时器')

  ctx.inject(['connection'], (scoped) => {
    scoped.effect(() => scoped.connection.fetch.register({
      path: `${BASE}/status`,
      methods: ['GET'],
      requestBody: 'buffered',
      fetch: withErrors(async (request) => {
        const refresh = queryParam(request, 'refresh') === '1'
        const snapshot = await status.get({ refresh })
        return json(200, snapshot)
      }),
    }), 'dsh-webctl: status 路由')

    scoped.effect(() => scoped.connection.fetch.register({
      path: `${BASE}/config`,
      methods: ['GET'],
      requestBody: 'buffered',
      fetch: withErrors(async () => json(200, {
        ok: true,
        config: {
          command: resolved.command,
          args: resolved.args,
          timeoutMs: resolved.timeoutMs,
          cacheTtlMs: resolved.cacheTtlMs,
          serverName: resolved.serverName,
          fallbackTool: resolved.fallbackTool,
          playwright: resolved.playwright,
        },
      })),
    }), 'dsh-webctl: config 路由')
  })
}