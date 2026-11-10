/**
 * dsh-webctl 宿主半边（第一片）：解析 webctl 可执行文件并暴露只读诊断接口。
 *
 * 工具接入与状态合成在后续 PR 补齐；本文件不 import 任何 @deepseek-ai/* 包。
 */
import { json, queryParam, withErrors } from './src/host/http.mjs'
import { probeWebctl } from './src/host/webctl.mjs'

/** 路由前缀。 */
const BASE = '/api/dsh-webctl'

/**
 * 把行配置归一化；缺省值与类型错误都兜住。
 * @param {unknown} raw - 行配置。
 * @returns {object} 归一化配置。
 */
export function normalizeConfig(raw) {
  const config = raw !== null && typeof raw === 'object' ? raw : {}
  const playwright = config.playwright !== null && typeof config.playwright === 'object' ? config.playwright : {}
  const command = typeof config.command === 'string' && config.command.trim() !== '' ? config.command.trim() : 'webctl'
  const args = Array.isArray(config.args) && config.args.every((item) => typeof item === 'string') ? config.args.slice() : ['mcp']
  const timeoutMs = Number.isFinite(config.timeoutMs) && config.timeoutMs > 0 ? config.timeoutMs : 8000
  const cacheTtlMs = Number.isFinite(config.cacheTtlMs) && config.cacheTtlMs >= 0 ? config.cacheTtlMs : 5000
  const searchDirs = Array.isArray(playwright.searchDirs)
    ? playwright.searchDirs.filter((item) => typeof item === 'string' && item.trim() !== '')
    : []
  return {
    command,
    args,
    timeoutMs,
    cacheTtlMs,
    serverName: typeof config.serverName === 'string' && config.serverName !== '' ? config.serverName : 'webctl',
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
  try {
    ctx.logger?.info?.('[dsh-webctl] 已加载：webctl 命令 ' + resolved.command)
  } catch {
    // 日志不可用不影响功能。
  }
  ctx.inject(['connection'], (scoped) => {
    scoped.effect(() => scoped.connection.fetch.register({
      path: BASE + '/status',
      methods: ['GET'],
      requestBody: 'buffered',
      fetch: withErrors(async (request) => {
        const refresh = queryParam(request, 'refresh') === '1'
        const webctl = await probeWebctl({ command: resolved.command, timeoutMs: resolved.timeoutMs })
        return json(200, {
          ok: true,
          checkedAt: new Date().toISOString(),
          refresh,
          webctl,
          diagnostics: webctl.state === 'ready'
            ? [{ level: 'ok', code: 'WEBCTL_READY', message: 'webctl ' + webctl.version + ' 可用：' + webctl.resolvedPath }]
            : [{ level: 'error', code: webctl.error?.code ?? 'WEBCTL_ERROR', message: webctl.error?.message ?? 'webctl 探测失败', hint: webctl.error?.hint }],
        })
      }),
    }), 'dsh-webctl: status 路由')
  })
}
