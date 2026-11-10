/**
 * dsh-webctl 设置页客户端：常量、词典、数据归一化与共享样式。
 *
 * 本文件是 src/client 下的一个部件，由 scripts/build-client.mjs 拼接进 client.js；
 * 所有部件共享同一个 factory 作用域，因此这里不写 import/export。
 */

/** 客户端 locale 命名空间。 */
const NS = 'webctlStatus'

/** 宿主状态接口。 */
const API = '/api/dsh-webctl'

/** 中文词典。 */
const ZH = {
  'settings.title': 'webctl 状态',
  'settings.description': '检查 webctl、18 个 MCP 工具与 Playwright 回退通道是否就绪。',
  'settings.refresh': '刷新',
  'settings.refreshing': '正在刷新…',
  'settings.loading': '正在探测环境…',
  'settings.loadFailed': '读取状态失败：{detail}',
  'settings.retry': '重试',
  'settings.lastChecked': '最后检查：{time}',
  'settings.notCheckedYet': '尚未检查',
  'settings.cached': '缓存结果',
  'settings.live': '实时探测',
  'settings.duration': '耗时 {ms} ms',
  'settings.httpFailed': 'HTTP {status}',
  'settings.badResponse': '响应格式不正确',
  'state.ready': '就绪',
  'state.missing': '未安装',
  'state.error': '异常',
  'state.skipped': '已跳过',
  'state.notChecked': '未检查',
  'state.partial': '部分可用',
  'state.unknown': '未知',
  'common.unknown': '未知',
  'common.yes': '是',
  'common.no': '否',
  'common.errorCode': '错误码',
  'common.errorMessage': '错误信息',
  'common.hint': '提示',
  'common.status': '状态',
  'common.result': '结果',
  'common.listSeparator': '、',
  'webctl.title': 'webctl',
  'webctl.command': '命令',
  'webctl.path': '解析路径',
  'webctl.version': '版本',
  'webctl.tools': 'caps 工具数',
  'webctl.fallback': '回退能力',
  'webctl.pathMissing': '未解析到可执行文件',
  'webctl.toolCount': '{n} 个',
  'mcp.title': 'MCP 握手',
  'mcp.state': '握手状态',
  'mcp.server': '服务信息',
  'mcp.protocol': '协议版本',
  'mcp.tools': 'tools/list 工具数',
  'mcp.registered': 'DSH 已注册',
  'playwright.title': 'Playwright（回退通道）',
  'playwright.package': '包状态',
  'playwright.packageFound': '已找到',
  'playwright.packageMissing': '未找到',
  'playwright.name': '包名',
  'playwright.version': '版本',
  'playwright.path': '路径',
  'playwright.searchedDirs': '搜索目录',
  'playwright.browsers': '浏览器缓存',
  'playwright.browsersPath': '缓存路径',
  'playwright.browsersExists': '目录存在',
  'playwright.browsersEmpty': '未检测到已安装浏览器',
  'playwright.fallback': 'WEBCTL_FALLBACK_TOOL',
  'playwright.fallbackDeclared': '已声明（{tool}）',
  'playwright.fallbackDeclaredNoTool': '已声明',
  'playwright.fallbackMissing': '未声明',
  'playwright.launchSmoke': '启动冒烟',
  'playwright.smoke.disabled': '未启用',
  'playwright.smoke.untested': '未测试',
  'playwright.smoke.passed': '通过',
  'playwright.smoke.failed': '失败',
  'diagnostics.title': '诊断',
  'diagnostics.count': '{n} 条',
  'diagnostics.empty': '暂无诊断信息',
  'tools.summary': '工具清单（webctl {webctl} / MCP {mcp}）',
  'tools.webctl': 'webctl caps',
  'tools.mcp': 'MCP tools/list',
  'tools.empty': '没有工具',
  'tools.missingInMcp': '（MCP 未返回）',
  'tools.registered': 'DSH 已注册工具',
  'tools.registeredEmpty': '宿主尚未注册 mcp__ 工具',
  'tools.summaryRegistered': '工具清单（webctl {webctl} / MCP {mcp} / 已注册 {registered}）',
  'level.ok': '正常',
  'level.warn': '警告',
  'level.error': '错误',
}

/** 英文词典。 */
const EN = {
  'settings.title': 'webctl status',
  'settings.description': 'Checks whether webctl, its 18 MCP tools and the Playwright fallback are ready.',
  'settings.refresh': 'Refresh',
  'settings.refreshing': 'Refreshing…',
  'settings.loading': 'Probing the environment…',
  'settings.loadFailed': 'Failed to load status: {detail}',
  'settings.retry': 'Retry',
  'settings.lastChecked': 'Last checked: {time}',
  'settings.notCheckedYet': 'Not checked yet',
  'settings.cached': 'Cached result',
  'settings.live': 'Live probe',
  'settings.duration': 'Took {ms} ms',
  'settings.httpFailed': 'HTTP {status}',
  'settings.badResponse': 'Unexpected response format',
  'state.ready': 'Ready',
  'state.missing': 'Missing',
  'state.error': 'Error',
  'state.skipped': 'Skipped',
  'state.notChecked': 'Not checked',
  'state.partial': 'Partial',
  'state.unknown': 'Unknown',
  'common.unknown': 'Unknown',
  'common.yes': 'Yes',
  'common.no': 'No',
  'common.errorCode': 'Error code',
  'common.errorMessage': 'Message',
  'common.hint': 'Hint',
  'common.status': 'Status',
  'common.result': 'Result',
  'common.listSeparator': ', ',
  'webctl.title': 'webctl',
  'webctl.command': 'Command',
  'webctl.path': 'Resolved path',
  'webctl.version': 'Version',
  'webctl.tools': 'caps tool count',
  'webctl.fallback': 'Fallback capability',
  'webctl.pathMissing': 'Executable not resolved',
  'webctl.toolCount': '{n}',
  'mcp.title': 'MCP handshake',
  'mcp.state': 'Handshake state',
  'mcp.server': 'Server info',
  'mcp.protocol': 'Protocol version',
  'mcp.tools': 'tools/list tool count',
  'mcp.registered': 'Registered in DSH',
  'playwright.title': 'Playwright (fallback)',
  'playwright.package': 'Package',
  'playwright.packageFound': 'Found',
  'playwright.packageMissing': 'Not found',
  'playwright.name': 'Name',
  'playwright.version': 'Version',
  'playwright.path': 'Path',
  'playwright.searchedDirs': 'Searched dirs',
  'playwright.browsers': 'Browser cache',
  'playwright.browsersPath': 'Cache path',
  'playwright.browsersExists': 'Directory exists',
  'playwright.browsersEmpty': 'No installed browser detected',
  'playwright.fallback': 'WEBCTL_FALLBACK_TOOL',
  'playwright.fallbackDeclared': 'Declared ({tool})',
  'playwright.fallbackDeclaredNoTool': 'Declared',
  'playwright.fallbackMissing': 'Not declared',
  'playwright.launchSmoke': 'Launch smoke',
  'playwright.smoke.disabled': 'Disabled',
  'playwright.smoke.untested': 'Not tested',
  'playwright.smoke.passed': 'Passed',
  'playwright.smoke.failed': 'Failed',
  'diagnostics.title': 'Diagnostics',
  'diagnostics.count': '{n}',
  'diagnostics.empty': 'No diagnostics',
  'tools.summary': 'Tools (webctl {webctl} / MCP {mcp})',
  'tools.webctl': 'webctl caps',
  'tools.mcp': 'MCP tools/list',
  'tools.empty': 'No tools',
  'tools.missingInMcp': '(missing from MCP)',
  'tools.registered': 'Registered in DSH',
  'tools.registeredEmpty': 'No mcp__ tools registered yet',
  'tools.summaryRegistered': 'Tools (webctl {webctl} / MCP {mcp} / registered {registered})',
  'level.ok': 'OK',
  'level.warn': 'Warning',
  'level.error': 'Error',
}

/** 状态对应的文案键。 */
const STATE_KEYS = {
  ready: 'state.ready',
  missing: 'state.missing',
  error: 'state.error',
  skipped: 'state.skipped',
  'not-checked': 'state.notChecked',
  partial: 'state.partial',
  unknown: 'state.unknown',
}

/** 状态对应的徽标色调。 */
const STATE_TONES = {
  ready: 'ok',
  missing: 'error',
  error: 'error',
  partial: 'warn',
}

/** 主题样式：全部走 --dsw-alias-* token，不写死颜色。 */
const styles = {
  root: { display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '860px' },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' },
  title: { margin: 0, fontSize: '16px', fontWeight: 600, lineHeight: 1.5, color: 'var(--dsw-alias-label-primary)' },
  description: { margin: '4px 0 0', fontSize: '12px', lineHeight: 1.6, color: 'var(--dsw-alias-label-tertiary)' },
  button: {
    padding: '5px 12px',
    borderRadius: '8px',
    border: '1px solid var(--dsw-alias-border-l1)',
    background: 'transparent',
    color: 'var(--dsw-alias-label-primary)',
    fontSize: '12px',
    lineHeight: 1.6,
    cursor: 'pointer',
  },
  buttonDisabled: { opacity: 0.5, cursor: 'not-allowed' },
  statusLine: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--dsw-alias-label-tertiary)' },
  panel: {
    padding: '12px 14px',
    borderRadius: '10px',
    border: '1px solid var(--dsw-alias-border-l1)',
    background: 'var(--dsw-alias-settings-card-fill, var(--dsw-alias-bg-layer-2))',
  },
  panelHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' },
  panelTitle: { margin: 0, fontSize: '13px', fontWeight: 600, lineHeight: 1.6, color: 'var(--dsw-alias-label-primary)' },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '1px 8px',
    borderRadius: '999px',
    border: '1px solid var(--dsw-alias-border-l2)',
    fontSize: '11px',
    lineHeight: 1.7,
    color: 'var(--dsw-alias-label-secondary)',
    whiteSpace: 'nowrap',
  },
  badgeOk: { color: 'var(--dsw-alias-state-success-primary)', borderColor: 'var(--dsw-alias-state-success-primary)' },
  badgeWarn: { color: 'var(--dsw-alias-state-warn-primary)', borderColor: 'var(--dsw-alias-state-warn-primary)' },
  badgeError: { color: 'var(--dsw-alias-state-error-primary)', borderColor: 'var(--dsw-alias-state-error-primary)' },
  fieldRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(96px, 128px) minmax(0, 1fr)',
    gap: '3px 10px',
    marginTop: '10px',
    fontSize: '12px',
    lineHeight: 1.7,
  },
  fieldLabel: { color: 'var(--dsw-alias-label-tertiary)' },
  fieldValue: { color: 'var(--dsw-alias-label-primary)', wordBreak: 'break-word' },
  mono: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: '11.5px' },
  subPanel: { marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--dsw-alias-border-l1)' },
  subHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' },
  subTitle: { margin: 0, fontSize: '12.5px', fontWeight: 600, color: 'var(--dsw-alias-label-primary)' },
  hint: { margin: '8px 0 0', fontSize: '12px', lineHeight: 1.6, color: 'var(--dsw-alias-label-tertiary)' },
  errorBox: { marginTop: '10px', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--dsw-alias-state-error-primary)' },
  errorText: {
    margin: 0,
    fontSize: '12px',
    lineHeight: 1.6,
    color: 'var(--dsw-alias-state-error-primary)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  errorRow: { margin: '4px 0 0', fontSize: '12px', lineHeight: 1.6, color: 'var(--dsw-alias-label-secondary)', wordBreak: 'break-word' },
  errorHint: { margin: '4px 0 0', fontSize: '12px', lineHeight: 1.6, color: 'var(--dsw-alias-label-tertiary)', wordBreak: 'break-word' },
  errorActions: { display: 'flex', justifyContent: 'flex-end', marginTop: '8px' },
  diagList: { display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' },
  diagItem: {
    display: 'flex',
    gap: '8px',
    padding: '8px 10px',
    borderRadius: '8px',
    border: '1px solid var(--dsw-alias-border-l1)',
    borderLeftWidth: '3px',
  },
  diagOk: { borderLeftColor: 'var(--dsw-alias-state-success-primary)' },
  diagWarn: { borderLeftColor: 'var(--dsw-alias-state-warn-primary)' },
  diagError: { borderLeftColor: 'var(--dsw-alias-state-error-primary)' },
  diagHead: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px', minWidth: '52px' },
  diagLevel: { fontSize: '11px', fontWeight: 600, lineHeight: 1.6 },
  diagCode: { fontSize: '10.5px', lineHeight: 1.5, color: 'var(--dsw-alias-label-tertiary)', wordBreak: 'break-all' },
  diagBody: { minWidth: 0, flex: '1 1 auto' },
  diagMessage: { fontSize: '12px', lineHeight: 1.6, color: 'var(--dsw-alias-label-primary)', wordBreak: 'break-word' },
  diagHint: { marginTop: '2px', fontSize: '11.5px', lineHeight: 1.6, color: 'var(--dsw-alias-label-tertiary)', wordBreak: 'break-word' },
  levelOk: { color: 'var(--dsw-alias-state-success-primary)' },
  levelWarn: { color: 'var(--dsw-alias-state-warn-primary)' },
  levelError: { color: 'var(--dsw-alias-state-error-primary)' },
  details: {
    padding: '10px 14px',
    borderRadius: '10px',
    border: '1px solid var(--dsw-alias-border-l1)',
    background: 'var(--dsw-alias-settings-card-fill, var(--dsw-alias-bg-layer-2))',
  },
  summary: { cursor: 'pointer', fontSize: '13px', fontWeight: 600, lineHeight: 1.6, color: 'var(--dsw-alias-label-primary)' },
  toolsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginTop: '10px' },
  toolColumnTitle: { fontSize: '12px', fontWeight: 600, lineHeight: 1.6, color: 'var(--dsw-alias-label-secondary)' },
  toolList: { margin: '6px 0 0', padding: '0 0 0 18px', fontSize: '11.5px', lineHeight: 1.8, color: 'var(--dsw-alias-label-secondary)' },
  toolMissing: { marginLeft: '6px', fontSize: '11px', color: 'var(--dsw-alias-state-warn-primary)' },
  browserList: { margin: '6px 0 0', padding: '0 0 0 18px', fontSize: '12px', lineHeight: 1.7, color: 'var(--dsw-alias-label-secondary)' },
}

/**
 * 安全地当对象读：数组、null、原始值一律退化为空对象。
 * @param {unknown} value - 任意值。
 * @returns {Record<string, unknown>} 对象。
 */
function asRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

/**
 * 判断是否普通对象。
 * @param {unknown} value - 任意值。
 * @returns {boolean} 是否对象。
 */
function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * 安全地当字符串读。
 * @param {unknown} value - 任意值。
 * @returns {string} 字符串；非字符串返回空串。
 */
function asString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * 安全地当数组读。
 * @param {unknown} value - 任意值。
 * @returns {unknown[]} 数组；非数组返回空数组。
 */
function asArray(value) {
  return Array.isArray(value) ? value : []
}

/**
 * 安全地当数字读。
 * @param {unknown} value - 任意值。
 * @returns {number|null} 有限数字或 null。
 */
function asNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/**
 * 取可选的字符串：空串归一为 null，方便 UI 判断“缺失”。
 * @param {unknown} value - 任意值。
 * @returns {string|null} 字符串或 null。
 */
function nullableString(value) {
  const text = asString(value)
  return text === '' ? null : text
}

/**
 * 从任意值里抠出可读文本（错误对象、字符串、数字都兜住）。
 * @param {unknown} value - 任意值。
 * @returns {string} 文本；无法判断时返回空串。
 */
function textOf(value) {
  if (typeof value === 'string') return value
  if (value === null || value === undefined) return ''
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (isRecord(value)) {
    const message = asString(value.message)
    if (message !== '') return message
    const code = asString(value.code)
    if (code !== '') return code
    try {
      return JSON.stringify(value)
    } catch {
      return ''
    }
  }
  return ''
}

/**
 * 文案取值：空串回退。
 * @param {unknown} value - 任意值。
 * @param {string} fallback - 回退文案。
 * @returns {string} 文案。
 */
function display(value, fallback) {
  const text = asString(value)
  return text === '' ? fallback : text
}

/**
 * 归一化状态枚举；未知值退化 unknown。
 * @param {unknown} value - 原值。
 * @param {string[]} allowed - 允许的枚举值。
 * @returns {string} 状态。
 */
function normalizeState(value, allowed) {
  return typeof value === 'string' && allowed.includes(value) ? value : 'unknown'
}

/**
 * 归一化诊断级别；未知值按 warn 显示，避免把问题藏起来。
 * @param {unknown} value - 原值。
 * @returns {'ok'|'warn'|'error'} 级别。
 */
function normalizeLevel(value) {
  return value === 'ok' || value === 'warn' || value === 'error' ? value : 'warn'
}

/**
 * 归一化错误对象。
 * @param {unknown} value - 原值。
 * @returns {{code: string, message: string, hint: string}|null} 错误或 null。
 */
function normalizeError(value) {
  if (typeof value === 'string') {
    const text = value.trim()
    return text === '' ? null : { code: '', message: text, hint: '' }
  }
  if (!isRecord(value)) return null
  const code = asString(value.code)
  const message = asString(value.message)
  const hint = asString(value.hint)
  if (code === '' && message === '' && hint === '') return null
  return { code, message, hint }
}

/**
 * 本地时间字符串。
 * @param {string} iso - ISO 时间。
 * @returns {string} 本地时间；无法解析时原样返回，空串返回空串。
 */
function formatTime(iso) {
  const text = asString(iso)
  if (text === '') return ''
  const time = Date.parse(text)
  if (!Number.isFinite(time)) return text
  try {
    return new Date(time).toLocaleString(undefined, { hour12: false })
  } catch {
    return text
  }
}

/**
 * 把接口返回归一化成 UI 能安全消费的形状；缺字段一律给默认值。
 * @param {unknown} raw - 接口返回。
 * @returns {object} 归一化状态。
 */
function normalizeStatus(raw) {
  const source = asRecord(raw)
  const webctl = asRecord(source.webctl)
  const mcp = asRecord(source.webctlMcp)
  const playwright = asRecord(source.playwright)
  const pkg = asRecord(playwright.package)
  const browsers = asRecord(playwright.browsers)
  const fallback = asRecord(playwright.fallback)
  const smoke = asRecord(playwright.launchSmoke)
  const webctlTools = asArray(webctl.tools).filter(item => typeof item === 'string')
  const mcpTools = asArray(mcp.tools).filter(item => typeof item === 'string')
  const registeredTools = Array.isArray(mcp.registeredTools)
    ? mcp.registeredTools.filter(item => typeof item === 'string')
    : null
  return {
    ok: source.ok === true,
    checkedAt: asString(source.checkedAt),
    cached: source.cached === true,
    durationMs: asNumber(source.durationMs),
    webctl: {
      state: normalizeState(webctl.state, ['ready', 'missing', 'error']),
      command: asString(webctl.command),
      resolvedPath: nullableString(webctl.resolvedPath),
      version: nullableString(webctl.version),
      tools: webctlTools,
      toolCount: asNumber(webctl.toolCount) ?? webctlTools.length,
      fallbackCapability: isRecord(webctl.fallbackCapability) ? webctl.fallbackCapability : null,
      error: normalizeError(webctl.error),
    },
    mcp: {
      serverName: asString(mcp.serverName),
      state: normalizeState(mcp.state, ['ready', 'error', 'skipped']),
      serverInfo: isRecord(mcp.serverInfo) ? mcp.serverInfo : null,
      protocolVersion: nullableString(mcp.protocolVersion),
      tools: mcpTools,
      toolCount: asNumber(mcp.toolCount) ?? mcpTools.length,
      registeredTools,
      registeredToolCount: asNumber(mcp.registeredToolCount) ?? (registeredTools === null ? null : registeredTools.length),
      error: normalizeError(mcp.error),
    },
    playwright: {
      state: normalizeState(playwright.state, ['not-checked', 'missing', 'partial', 'ready', 'error']),
      package: {
        found: pkg.found === true,
        name: nullableString(pkg.name),
        version: nullableString(pkg.version),
        path: nullableString(pkg.path),
        searchedDirs: asArray(pkg.searchedDirs).filter(item => typeof item === 'string'),
      },
      browsers: {
        path: nullableString(browsers.path),
        exists: browsers.exists === true,
        entries: asArray(browsers.entries).filter(isRecord).map(item => ({
          name: asString(item.name),
          version: asString(item.version),
        })),
      },
      fallback: {
        declaredInEnv: fallback.declaredInEnv === true,
        toolName: nullableString(fallback.toolName),
      },
      launchSmoke: {
        enabled: smoke.enabled === true,
        tested: smoke.tested === true,
        ok: smoke.ok === true ? true : smoke.ok === false ? false : null,
        error: textOf(smoke.error),
      },
      error: textOf(playwright.error),
    },
    diagnostics: asArray(source.diagnostics).filter(isRecord).map(item => ({
      level: normalizeLevel(item.level),
      code: asString(item.code),
      message: asString(item.message),
      hint: asString(item.hint),
    })),
  }
}

/**
 * 状态文案。
 * @param {(key: string, params?: object) => string} t - 翻译函数。
 * @param {string} state - 状态。
 * @returns {string} 文案。
 */
function stateLabel(t, state) {
  return t(STATE_KEYS[state] ?? 'state.unknown')
}

/**
 * 状态对应的徽标色调。
 * @param {string} state - 状态。
 * @returns {'ok'|'warn'|'error'|'neutral'} 色调。
 */
function stateTone(state) {
  return STATE_TONES[state] ?? 'neutral'
}

/**
 * Playwright 状态色调：这是可选回退通道，缺失只算警告。
 * @param {string} state - 状态。
 * @returns {'ok'|'warn'|'error'|'neutral'} 色调。
 */
function playwrightTone(state) {
  if (state === 'ready') return 'ok'
  if (state === 'missing' || state === 'partial') return 'warn'
  if (state === 'error') return 'error'
  return 'neutral'
}
