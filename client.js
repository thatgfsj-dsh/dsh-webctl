/**
* 本文件由 scripts/build-client.mjs 从 src/client/*.js 自动生成，请勿直接修改；这是生成物，请勿手改。
* 修改请改 src/client/ 下的源码，然后运行：node scripts/build-client.mjs
*/
window.__ModuleLoader__.load({ id: 'dsh-webctl', factory(require) { const React = require('react')
const h = React.createElement
const { useCallback, useEffect, useRef, useState } = React
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
const ZH = { 'settings.title': 'webctl 状态', 'settings.description': '检查 webctl、18 个 MCP 工具与 Playwright 回退通道是否就绪。', 'settings.refresh': '刷新', 'settings.refreshing': '正在刷新…', 'settings.loading': '正在探测环境…',
'settings.loadFailed': '读取状态失败：{detail}', 'settings.retry': '重试', 'settings.lastChecked': '最后检查：{time}', 'settings.notCheckedYet': '尚未检查', 'settings.cached': '缓存结果', 'settings.live': '实时探测',
'settings.duration': '耗时 {ms} ms', 'settings.httpFailed': 'HTTP {status}', 'settings.badResponse': '响应格式不正确', 'state.ready': '就绪', 'state.missing': '未安装', 'state.error': '异常', 'state.skipped': '已跳过',
'state.notChecked': '未检查', 'state.partial': '部分可用', 'state.unknown': '未知', 'common.unknown': '未知', 'common.yes': '是', 'common.no': '否', 'common.errorCode': '错误码', 'common.errorMessage': '错误信息', 'common.hint': '提示',
'common.status': '状态', 'common.result': '结果', 'common.listSeparator': '、', 'webctl.title': 'webctl', 'webctl.command': '命令', 'webctl.path': '解析路径', 'webctl.version': '版本', 'webctl.tools': 'caps 工具数',
'webctl.fallback': '回退能力', 'webctl.pathMissing': '未解析到可执行文件', 'webctl.toolCount': '{n} 个', 'mcp.title': 'MCP 握手', 'mcp.state': '握手状态', 'mcp.server': '服务信息', 'mcp.protocol': '协议版本', 'mcp.tools': 'tools/list 工具数',
'mcp.registered': 'DSH 已注册', 'playwright.title': 'Playwright（回退通道）', 'playwright.package': '包状态', 'playwright.packageFound': '已找到', 'playwright.packageMissing': '未找到', 'playwright.name': '包名', 'playwright.version': '版本',
'playwright.path': '路径', 'playwright.searchedDirs': '搜索目录', 'playwright.browsers': '浏览器缓存', 'playwright.browsersPath': '缓存路径', 'playwright.browsersExists': '目录存在', 'playwright.browsersEmpty': '未检测到已安装浏览器',
'playwright.fallback': 'WEBCTL_FALLBACK_TOOL', 'playwright.fallbackDeclared': '已声明（{tool}）', 'playwright.fallbackDeclaredNoTool': '已声明', 'playwright.fallbackMissing': '未声明', 'playwright.launchSmoke': '启动冒烟',
'playwright.smoke.disabled': '未启用', 'playwright.smoke.untested': '未测试', 'playwright.smoke.passed': '通过', 'playwright.smoke.failed': '失败', 'diagnostics.title': '诊断', 'diagnostics.count': '{n} 条',
'diagnostics.empty': '暂无诊断信息', 'tools.summary': '工具清单（webctl {webctl} / MCP {mcp}）', 'tools.webctl': 'webctl caps', 'tools.mcp': 'MCP tools/list', 'tools.empty': '没有工具', 'tools.missingInMcp': '（MCP 未返回）',
'tools.registered': 'DSH 已注册工具', 'tools.registeredEmpty': '宿主尚未注册 mcp__ 工具', 'tools.summaryRegistered': '工具清单（webctl {webctl} / MCP {mcp} / 已注册 {registered}）', 'level.ok': '正常', 'degradation.title': '最近降级与回退',
'degradation.empty': '还没有观察到 webctl 降级（只记录带 actionable / fallback_hint 的结果）', 'degradation.count': '{n} 条', 'degradation.nextSteps': '建议下一步', 'degradation.playwrightSuitable': '适合 Playwright 回退',
'degradation.notSuitable': '不适合 Playwright 回退', 'degradation.signals': '信号', 'degradation.tool': '工具', 'level.warn': '警告', 'level.error': '错误', }
/** 英文词典。 */
const EN = { 'settings.title': 'webctl status', 'settings.description': 'Checks whether webctl, its 18 MCP tools and the Playwright fallback are ready.', 'settings.refresh': 'Refresh',
'settings.refreshing': 'Refreshing…', 'settings.loading': 'Probing the environment…', 'settings.loadFailed': 'Failed to load status: {detail}', 'settings.retry': 'Retry', 'settings.lastChecked': 'Last checked: {time}',
'settings.notCheckedYet': 'Not checked yet', 'settings.cached': 'Cached result', 'settings.live': 'Live probe', 'settings.duration': 'Took {ms} ms', 'settings.httpFailed': 'HTTP {status}',
'settings.badResponse': 'Unexpected response format', 'state.ready': 'Ready', 'state.missing': 'Missing', 'state.error': 'Error', 'state.skipped': 'Skipped', 'state.notChecked': 'Not checked', 'state.partial': 'Partial',
'state.unknown': 'Unknown', 'common.unknown': 'Unknown', 'common.yes': 'Yes', 'common.no': 'No', 'common.errorCode': 'Error code', 'common.errorMessage': 'Message', 'common.hint': 'Hint', 'common.status': 'Status',
'common.result': 'Result', 'common.listSeparator': ', ', 'webctl.title': 'webctl', 'webctl.command': 'Command', 'webctl.path': 'Resolved path', 'webctl.version': 'Version', 'webctl.tools': 'caps tool count',
'webctl.fallback': 'Fallback capability', 'webctl.pathMissing': 'Executable not resolved', 'webctl.toolCount': '{n}', 'mcp.title': 'MCP handshake', 'mcp.state': 'Handshake state', 'mcp.server': 'Server info',
'mcp.protocol': 'Protocol version', 'mcp.tools': 'tools/list tool count', 'mcp.registered': 'Registered in DSH', 'playwright.title': 'Playwright (fallback)', 'playwright.package': 'Package',
'playwright.packageFound': 'Found', 'playwright.packageMissing': 'Not found', 'playwright.name': 'Name', 'playwright.version': 'Version', 'playwright.path': 'Path', 'playwright.searchedDirs': 'Searched dirs',
'playwright.browsers': 'Browser cache', 'playwright.browsersPath': 'Cache path', 'playwright.browsersExists': 'Directory exists', 'playwright.browsersEmpty': 'No installed browser detected',
'playwright.fallback': 'WEBCTL_FALLBACK_TOOL', 'playwright.fallbackDeclared': 'Declared ({tool})', 'playwright.fallbackDeclaredNoTool': 'Declared', 'playwright.fallbackMissing': 'Not declared',
'playwright.launchSmoke': 'Launch smoke', 'playwright.smoke.disabled': 'Disabled', 'playwright.smoke.untested': 'Not tested', 'playwright.smoke.passed': 'Passed', 'playwright.smoke.failed': 'Failed',
'diagnostics.title': 'Diagnostics', 'diagnostics.count': '{n}', 'diagnostics.empty': 'No diagnostics', 'tools.summary': 'Tools (webctl {webctl} / MCP {mcp})', 'tools.webctl': 'webctl caps', 'tools.mcp': 'MCP tools/list',
'tools.empty': 'No tools', 'tools.missingInMcp': '(missing from MCP)', 'tools.registered': 'Registered in DSH', 'tools.registeredEmpty': 'No mcp__ tools registered yet',
'tools.summaryRegistered': 'Tools (webctl {webctl} / MCP {mcp} / registered {registered})', 'level.ok': 'OK', 'degradation.title': 'Recent degradations and fallback',
'degradation.empty': 'No webctl degradation observed yet (only results with actionable / fallback_hint are recorded)', 'degradation.count': '{n} record(s)', 'degradation.nextSteps': 'Next steps',
'degradation.playwrightSuitable': 'Playwright fallback suitable', 'degradation.notSuitable': 'Playwright fallback not suitable', 'degradation.signals': 'Signals', 'degradation.tool': 'Tool', 'level.warn': 'Warning',
'level.error': 'Error', }
/** 状态对应的文案键。 */
const STATE_KEYS = { ready: 'state.ready', missing: 'state.missing', error: 'state.error', skipped: 'state.skipped', 'not-checked': 'state.notChecked', partial: 'state.partial', unknown: 'state.unknown', }
/** 状态对应的徽标色调。 */
const STATE_TONES = { ready: 'ok', missing: 'error', error: 'error', partial: 'warn', }
/** 主题样式：全部走 --dsw-alias-* token，不写死颜色。 */
const styles = { root: { display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '860px' }, header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' },
title: { margin: 0, fontSize: '16px', fontWeight: 600, lineHeight: 1.5, color: 'var(--dsw-alias-label-primary)' },
description: { margin: '4px 0 0', fontSize: '12px', lineHeight: 1.6, color: 'var(--dsw-alias-label-tertiary)' }, button: { padding: '5px 12px', borderRadius: '8px', border: '1px solid var(--dsw-alias-border-l1)',
background: 'transparent', color: 'var(--dsw-alias-label-primary)', fontSize: '12px', lineHeight: 1.6, cursor: 'pointer', }, buttonDisabled: { opacity: 0.5, cursor: 'not-allowed' },
statusLine: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--dsw-alias-label-tertiary)' }, panel: { padding: '12px 14px', borderRadius: '10px',
border: '1px solid var(--dsw-alias-border-l1)', background: 'var(--dsw-alias-settings-card-fill, var(--dsw-alias-bg-layer-2))', },
panelHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' },
panelTitle: { margin: 0, fontSize: '13px', fontWeight: 600, lineHeight: 1.6, color: 'var(--dsw-alias-label-primary)' }, badge: { display: 'inline-flex', alignItems: 'center', padding: '1px 8px', borderRadius: '999px',
border: '1px solid var(--dsw-alias-border-l2)', fontSize: '11px', lineHeight: 1.7, color: 'var(--dsw-alias-label-secondary)', whiteSpace: 'nowrap', },
badgeOk: { color: 'var(--dsw-alias-state-success-primary)', borderColor: 'var(--dsw-alias-state-success-primary)' },
badgeWarn: { color: 'var(--dsw-alias-state-warn-primary)', borderColor: 'var(--dsw-alias-state-warn-primary)' },
badgeError: { color: 'var(--dsw-alias-state-error-primary)', borderColor: 'var(--dsw-alias-state-error-primary)' }, fieldRow: { display: 'grid', gridTemplateColumns: 'minmax(96px, 128px) minmax(0, 1fr)', gap: '3px 10px',
marginTop: '10px', fontSize: '12px', lineHeight: 1.7, }, fieldLabel: { color: 'var(--dsw-alias-label-tertiary)' }, fieldValue: { color: 'var(--dsw-alias-label-primary)', wordBreak: 'break-word' },
mono: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: '11.5px' }, subPanel: { marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--dsw-alias-border-l1)' },
subHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }, subTitle: { margin: 0, fontSize: '12.5px', fontWeight: 600, color: 'var(--dsw-alias-label-primary)' },
hint: { margin: '8px 0 0', fontSize: '12px', lineHeight: 1.6, color: 'var(--dsw-alias-label-tertiary)' },
errorBox: { marginTop: '10px', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--dsw-alias-state-error-primary)' }, errorText: { margin: 0, fontSize: '12px', lineHeight: 1.6,
color: 'var(--dsw-alias-state-error-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', },
errorRow: { margin: '4px 0 0', fontSize: '12px', lineHeight: 1.6, color: 'var(--dsw-alias-label-secondary)', wordBreak: 'break-word' },
errorHint: { margin: '4px 0 0', fontSize: '12px', lineHeight: 1.6, color: 'var(--dsw-alias-label-tertiary)', wordBreak: 'break-word' }, errorActions: { display: 'flex', justifyContent: 'flex-end', marginTop: '8px' },
diagList: { display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }, diagItem: { display: 'flex', gap: '8px', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--dsw-alias-border-l1)',
borderLeftWidth: '3px', }, diagOk: { borderLeftColor: 'var(--dsw-alias-state-success-primary)' }, diagWarn: { borderLeftColor: 'var(--dsw-alias-state-warn-primary)' },
diagError: { borderLeftColor: 'var(--dsw-alias-state-error-primary)' }, diagHead: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px', minWidth: '52px' },
diagLevel: { fontSize: '11px', fontWeight: 600, lineHeight: 1.6 }, diagCode: { fontSize: '10.5px', lineHeight: 1.5, color: 'var(--dsw-alias-label-tertiary)', wordBreak: 'break-all' },
diagBody: { minWidth: 0, flex: '1 1 auto' }, diagMessage: { fontSize: '12px', lineHeight: 1.6, color: 'var(--dsw-alias-label-primary)', wordBreak: 'break-word' },
diagHint: { marginTop: '2px', fontSize: '11.5px', lineHeight: 1.6, color: 'var(--dsw-alias-label-tertiary)', wordBreak: 'break-word' }, levelOk: { color: 'var(--dsw-alias-state-success-primary)' },
levelWarn: { color: 'var(--dsw-alias-state-warn-primary)' }, levelError: { color: 'var(--dsw-alias-state-error-primary)' }, details: { padding: '10px 14px', borderRadius: '10px',
border: '1px solid var(--dsw-alias-border-l1)', background: 'var(--dsw-alias-settings-card-fill, var(--dsw-alias-bg-layer-2))', },
summary: { cursor: 'pointer', fontSize: '13px', fontWeight: 600, lineHeight: 1.6, color: 'var(--dsw-alias-label-primary)' },
toolsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginTop: '10px' },
toolColumnTitle: { fontSize: '12px', fontWeight: 600, lineHeight: 1.6, color: 'var(--dsw-alias-label-secondary)' },
toolList: { margin: '6px 0 0', padding: '0 0 0 18px', fontSize: '11.5px', lineHeight: 1.8, color: 'var(--dsw-alias-label-secondary)' },
toolMissing: { marginLeft: '6px', fontSize: '11px', color: 'var(--dsw-alias-state-warn-primary)' },
browserList: { margin: '6px 0 0', padding: '0 0 0 18px', fontSize: '12px', lineHeight: 1.7, color: 'var(--dsw-alias-label-secondary)' }, }
/**
* 安全地当对象读：数组、null、原始值一律退化为空对象。
* @param {unknown} value - 任意值。
* @returns {Record<string, unknown>} 对象。
*/
function asRecord(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {}
}
/**
* 判断是否普通对象。
* @param {unknown} value - 任意值。
* @returns {boolean} 是否对象。
*/
function isRecord(value) { return value !== null && typeof value === 'object' && !Array.isArray(value)
}
/**
* 安全地当字符串读。
* @param {unknown} value - 任意值。
* @returns {string} 字符串；非字符串返回空串。
*/
function asString(value) { return typeof value === 'string' ? value.trim() : ''
}
/**
* 安全地当数组读。
* @param {unknown} value - 任意值。
* @returns {unknown[]} 数组；非数组返回空数组。
*/
function asArray(value) { return Array.isArray(value) ? value : []
}
/**
* 安全地当数字读。
* @param {unknown} value - 任意值。
* @returns {number|null} 有限数字或 null。
*/
function asNumber(value) { return typeof value === 'number' && Number.isFinite(value) ? value : null
}
/**
* 取可选的字符串：空串归一为 null，方便 UI 判断“缺失”。
* @param {unknown} value - 任意值。
* @returns {string|null} 字符串或 null。
*/
function nullableString(value) { const text = asString(value)
return text === '' ? null : text
}
/**
* 从任意值里抠出可读文本（错误对象、字符串、数字都兜住）。
* @param {unknown} value - 任意值。
* @returns {string} 文本；无法判断时返回空串。
*/
function textOf(value) { if (typeof value === 'string') return value
if (value === null || value === undefined) return ''
if (typeof value === 'number' || typeof value === 'boolean') return String(value)
if (isRecord(value)) { const message = asString(value.message)
if (message !== '') return message
const code = asString(value.code)
if (code !== '') return code
try { return JSON.stringify(value)
} catch { return ''
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
function display(value, fallback) { const text = asString(value)
return text === '' ? fallback : text
}
/**
* 归一化状态枚举；未知值退化 unknown。
* @param {unknown} value - 原值。
* @param {string[]} allowed - 允许的枚举值。
* @returns {string} 状态。
*/
function normalizeState(value, allowed) { return typeof value === 'string' && allowed.includes(value) ? value : 'unknown'
}
/**
* 归一化诊断级别；未知值按 warn 显示，避免把问题藏起来。
* @param {unknown} value - 原值。
* @returns {'ok'|'warn'|'error'} 级别。
*/
function normalizeLevel(value) { return value === 'ok' || value === 'warn' || value === 'error' ? value : 'warn'
}
/**
* 归一化错误对象。
* @param {unknown} value - 原值。
* @returns {{code: string, message: string, hint: string}|null} 错误或 null。
*/
function normalizeError(value) { if (typeof value === 'string') { const text = value.trim()
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
function formatTime(iso) { const text = asString(iso)
if (text === '') return ''
const time = Date.parse(text)
if (!Number.isFinite(time)) return text
try { return new Date(time).toLocaleString(undefined, { hour12: false })
} catch { return text
}
}
/**
* 把接口返回归一化成 UI 能安全消费的形状；缺字段一律给默认值。
* @param {unknown} raw - 接口返回。
* @returns {object} 归一化状态。
*/
function normalizeStatus(raw) { const source = asRecord(raw)
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
const readinessSource = asRecord(source.fallbackReadiness)
const degradations = asArray(source.recentDegradations).filter(isRecord).map(item => { const hint = isRecord(item.fallbackHint) ? item.fallbackHint : null
return { at: asNumber(item.at), tool: asString(item.tool), code: nullableString(item.code), degradedFrom: nullableString(item.degradedFrom), error: nullableString(item.error), reason: nullableString(item.reason),
detected: asArray(item.detected).filter(value => typeof value === 'string'), nextSteps: asArray(item.nextSteps).filter(value => typeof value === 'string'), fallbackHint: hint === null
? null
: { playwrightSuitable: hint.playwrightSuitable === true, signals: asArray(hint.signals).filter(value => typeof value === 'string'), embeddedDataTried: hint.embeddedDataTried === true,
jsEngineSuitable: hint.jsEngineSuitable === true, }, }
})
return { ok: source.ok === true, checkedAt: asString(source.checkedAt), cached: source.cached === true, durationMs: asNumber(source.durationMs), webctl: {
state: normalizeState(webctl.state, ['ready', 'missing', 'error']), command: asString(webctl.command), resolvedPath: nullableString(webctl.resolvedPath), version: nullableString(webctl.version), tools: webctlTools,
toolCount: asNumber(webctl.toolCount) ?? webctlTools.length, fallbackCapability: isRecord(webctl.fallbackCapability) ? webctl.fallbackCapability : null, error: normalizeError(webctl.error), }, mcp: {
serverName: asString(mcp.serverName), state: normalizeState(mcp.state, ['ready', 'error', 'skipped']), serverInfo: isRecord(mcp.serverInfo) ? mcp.serverInfo : null, protocolVersion: nullableString(mcp.protocolVersion),
tools: mcpTools, toolCount: asNumber(mcp.toolCount) ?? mcpTools.length, registeredTools, registeredToolCount: asNumber(mcp.registeredToolCount) ?? (registeredTools === null ? null : registeredTools.length),
error: normalizeError(mcp.error), }, playwright: { state: normalizeState(playwright.state, ['not-checked', 'missing', 'partial', 'ready', 'error']), package: { found: pkg.found === true, name: nullableString(pkg.name),
version: nullableString(pkg.version), path: nullableString(pkg.path), searchedDirs: asArray(pkg.searchedDirs).filter(item => typeof item === 'string'), }, browsers: { path: nullableString(browsers.path),
exists: browsers.exists === true, entries: asArray(browsers.entries).filter(isRecord).map(item => ({ name: asString(item.name), version: asString(item.version), })), }, fallback: {
declaredInEnv: fallback.declaredInEnv === true, toolName: nullableString(fallback.toolName), }, launchSmoke: { enabled: smoke.enabled === true, tested: smoke.tested === true,
ok: smoke.ok === true ? true : smoke.ok === false ? false : null, error: textOf(smoke.error), }, error: textOf(playwright.error), }, recentDegradations: degradations, fallbackReadiness: {
recentDegradations: asNumber(readinessSource.recentDegradations) ?? degradations.length, playwrightSuitableSeen: readinessSource.playwrightSuitableSeen === true, playwrightReady: readinessSource.playwrightReady === true,
advice: asString(readinessSource.advice), }, diagnostics: asArray(source.diagnostics).filter(isRecord).map(item => ({ level: normalizeLevel(item.level), code: asString(item.code), message: asString(item.message),
hint: asString(item.hint), })), }
}
/**
* 状态文案。
* @param {(key: string, params?: object) => string} t - 翻译函数。
* @param {string} state - 状态。
* @returns {string} 文案。
*/
function stateLabel(t, state) { return t(STATE_KEYS[state] ?? 'state.unknown')
}
/**
* 状态对应的徽标色调。
* @param {string} state - 状态。
* @returns {'ok'|'warn'|'error'|'neutral'} 色调。
*/
function stateTone(state) { return STATE_TONES[state] ?? 'neutral'
}
/**
* Playwright 状态色调：这是可选回退通道，缺失只算警告。
* @param {string} state - 状态。
* @returns {'ok'|'warn'|'error'|'neutral'} 色调。
*/
function playwrightTone(state) { if (state === 'ready') return 'ok'
if (state === 'missing' || state === 'partial') return 'warn'
if (state === 'error') return 'error'
return 'neutral'
}
/**
* dsh-webctl 设置页 UI：settings.section 插槽里的状态面板。
*
* 只依赖平台模块表里的 react，用 React.createElement 手写元素；
* 不 import 任何 @deepseek-ai/dsh-client-* 包，样式只用主题 token。
*/
/**
* 请求状态接口。
* @param {boolean} refresh - 是否强刷。
* @param {AbortSignal} signal - 中止信号。
* @param {(key: string, params?: object) => string} t - 翻译函数。
* @returns {Promise<object>} 接口返回。
*/
async function requestStatus(refresh, signal, t) { const url = refresh ? `${API}/status?refresh=1` : `${API}/status`
const response = await fetch(url, { method: 'GET', signal, credentials: 'same-origin', headers: { accept: 'application/json' }, })
let payload = null
try { payload = await response.json()
} catch { payload = null
}
if (response.ok !== true) { const record = asRecord(payload)
const failure = asRecord(record.error)
const fallback = t('settings.httpFailed', { status: response.status })
throw new Error(display(failure.message, display(record.message, fallback)))
}
if (!isRecord(payload)) throw new Error(t('settings.badResponse'))
if (payload.ok !== true) { const failure = asRecord(payload.error)
throw new Error(display(failure.message, display(failure.code, t('settings.badResponse'))))
}
return payload
}
/**
* 状态徽标（文字 + 彩色边框，不写死颜色）。
* @param {{tone?: string, text: string}} props - 属性。
* @returns {object} 元素。
*/
function Badge({ tone, text }) { let toneStyle = null
if (tone === 'ok') toneStyle = styles.badgeOk
else if (tone === 'warn') toneStyle = styles.badgeWarn
else if (tone === 'error') toneStyle = styles.badgeError
return h('span', { style: toneStyle === null ? styles.badge : { ...styles.badge, ...toneStyle } }, text)
}
/**
* 两列信息网格：值为空的整行不渲染。
* @param {{rows: Array<{label: string, value: unknown, mono?: boolean}>}} props - 属性。
* @returns {object|null} 元素。
*/
function InfoGrid({ rows }) { const visible = rows.filter(row => row !== null && row !== undefined
&& row.value !== null && row.value !== undefined && row.value !== '')
if (visible.length === 0) return null
const children = []
visible.forEach((row, index) => { children.push(h('div', { key: `label-${index}`, style: styles.fieldLabel }, row.label))
const valueStyle = row.mono === true ? { ...styles.fieldValue, ...styles.mono } : styles.fieldValue
children.push(h('div', { key: `value-${index}`, style: valueStyle }, row.value))
})
return h('div', { style: styles.fieldRow }, children)
}
/**
* 错误详情：错误码、信息与提示。
* @param {{error: object|null, t: Function}} props - 属性。
* @returns {object|null} 元素。
*/
function ErrorLines({ error, t }) { if (error === null) return null
const lines = []
if (error.code !== '') lines.push(h('div', { key: 'code', style: styles.errorRow }, `${t('common.errorCode')}：${error.code}`))
if (error.message !== '') lines.push(h('div', { key: 'message', style: styles.errorRow }, error.message))
if (error.hint !== '') lines.push(h('div', { key: 'hint', style: styles.errorHint }, `${t('common.hint')}：${error.hint}`))
if (lines.length === 0) return null
return h('div', { style: styles.errorBox }, lines)
}
/**
* 分区外壳。
* @param {{title: string, badge?: object|null, children?: unknown}} props - 属性。
* @returns {object} 元素。
*/
function Panel({ title, badge, children }) { return h('div', { style: styles.panel }, h('div', { style: styles.panelHeader }, h('h3', { style: styles.panelTitle }, title), badge === undefined ? null : badge, ), children,
)
}
/**
* 顶部状态行：最后检查时间、缓存/实时、耗时。
* @param {{status: object, busy: boolean, t: Function}} props - 属性。
* @returns {object} 元素。
*/
function StatusLine({ status, busy, t }) { const time = formatTime(status.checkedAt)
const parts = []
parts.push(h('span', { key: 'time' }, time === '' ? t('settings.notCheckedYet') : t('settings.lastChecked', { time })))
parts.push(h('span', { key: 'sep-1' }, '·'))
parts.push(h('span', { key: 'mode' }, status.cached ? t('settings.cached') : t('settings.live')))
if (status.durationMs !== null) { parts.push(h('span', { key: 'sep-2' }, '·'))
parts.push(h('span', { key: 'duration' }, t('settings.duration', { ms: status.durationMs })))
}
if (busy) { parts.push(h('span', { key: 'sep-3' }, '·'))
parts.push(h('span', { key: 'busy' }, t('settings.refreshing')))
}
return h('div', { style: styles.statusLine, role: 'status' }, parts)
}
/**
* 错误横幅 + 重试按钮。
* @param {{message: string, onRetry: Function, t: Function}} props - 属性。
* @returns {object} 元素。
*/
function ErrorBanner({ message, onRetry, t }) { return h('div', { style: styles.errorBox, role: 'alert' }, h('p', { style: styles.errorText }, message), h('div', { style: styles.errorActions },
h('button', { type: 'button', style: styles.button, onClick: onRetry }, t('settings.retry')), ), )
}
/**
* 服务信息文案。
* @param {object|null} info - serverInfo。
* @param {Function} t - 翻译函数。
* @returns {string} 文案。
*/
function serverInfoLabel(info, t) { if (info === null) return t('common.unknown')
const text = [asString(info.name), asString(info.version)].filter(part => part !== '').join(' ')
return text === '' ? t('common.unknown') : text
}
/**
* 回退声明文案。
* @param {object} fallback - 归一化 fallback。
* @param {Function} t - 翻译函数。
* @returns {string} 文案。
*/
function fallbackLabel(fallback, t) { if (!fallback.declaredInEnv) return t('playwright.fallbackMissing')
return fallback.toolName === null ? t('playwright.fallbackDeclaredNoTool') : t('playwright.fallbackDeclared', { tool: fallback.toolName })
}
/**
* 启动冒烟文案。
* @param {object} smoke - 归一化 launchSmoke。
* @param {Function} t - 翻译函数。
* @returns {string} 文案。
*/
function smokeLabel(smoke, t) { if (!smoke.enabled) return t('playwright.smoke.disabled')
if (!smoke.tested) return t('playwright.smoke.untested')
return smoke.ok === true ? t('playwright.smoke.passed') : t('playwright.smoke.failed')
}
/**
* 浏览器条目文案。
* @param {{name: string, version: string}} entry - 条目。
* @param {Function} t - 翻译函数。
* @returns {string} 文案。
*/
function browserLabel(entry, t) { const text = [entry.name, entry.version].filter(part => part !== '').join(' ')
return text === '' ? t('common.unknown') : text
}
/**
* webctl 与 MCP 握手信息。
* @param {{status: object, t: Function}} props - 属性。
* @returns {object} 元素。
*/
function WebctlPanel({ status, t }) { const webctl = status.webctl
const mcp = status.mcp
const rows = [ { label: t('webctl.command'), value: webctl.command === '' ? t('common.unknown') : webctl.command, mono: true },
{ label: t('webctl.path'), value: webctl.resolvedPath === null ? t('webctl.pathMissing') : webctl.resolvedPath, mono: true },
{ label: t('webctl.version'), value: webctl.version === null ? t('common.unknown') : webctl.version, mono: true }, { label: t('webctl.tools'), value: t('webctl.toolCount', { n: webctl.toolCount }) },
{ label: t('webctl.fallback'), value: webctl.fallbackCapability === null ? t('common.no') : t('common.yes') }, ]
const mcpRows = [ { label: t('mcp.server'), value: serverInfoLabel(mcp.serverInfo, t), mono: true },
{ label: t('mcp.protocol'), value: mcp.protocolVersion === null ? t('common.unknown') : mcp.protocolVersion, mono: true }, { label: t('mcp.tools'), value: t('webctl.toolCount', { n: mcp.toolCount }) },
{ label: t('mcp.registered'), value: mcp.registeredToolCount === null ? '' : t('webctl.toolCount', { n: mcp.registeredToolCount }) }, ]
return h(Panel, { title: t('webctl.title'), badge: h(Badge, { tone: stateTone(webctl.state), text: stateLabel(t, webctl.state) }), }, h(InfoGrid, { rows }), h(ErrorLines, { error: webctl.error, t }),
h('div', { style: styles.subPanel }, h('div', { style: styles.subHeader }, h('h4', { style: styles.subTitle }, t('mcp.title')), h(Badge, { tone: stateTone(mcp.state), text: stateLabel(t, mcp.state) }), ),
h(InfoGrid, { rows: mcpRows }), h(ErrorLines, { error: mcp.error, t }), ), )
}
/**
* Playwright 包、浏览器缓存、回退声明与启动冒烟。
* @param {{status: object, t: Function}} props - 属性。
* @returns {object} 元素。
*/
function PlaywrightPanel({ status, t }) { const playwright = status.playwright
const pkg = playwright.package
const browsers = playwright.browsers
const smoke = playwright.launchSmoke
const packageRows = [ { label: t('playwright.package'), value: pkg.found ? t('playwright.packageFound') : t('playwright.packageMissing') },
{ label: t('playwright.name'), value: pkg.name === null ? t('common.unknown') : pkg.name, mono: true }, { label: t('playwright.version'), value: pkg.version === null ? t('common.unknown') : pkg.version, mono: true },
{ label: t('playwright.path'), value: pkg.path === null ? t('common.unknown') : pkg.path, mono: true },
{ label: t('playwright.searchedDirs'), value: pkg.searchedDirs.length === 0 ? '' : pkg.searchedDirs.join(t('common.listSeparator')), mono: true }, ]
const browserRows = [ { label: t('playwright.browsersPath'), value: browsers.path === null ? t('common.unknown') : browsers.path, mono: true },
{ label: t('playwright.browsersExists'), value: browsers.exists ? t('common.yes') : t('common.no') }, ]
const fallbackRows = [ { label: t('common.status'), value: fallbackLabel(playwright.fallback, t) }, ]
const smokeRows = [ { label: t('common.result'), value: smokeLabel(smoke, t) }, ]
if (smoke.error !== '') smokeRows.push({ label: t('common.errorMessage'), value: smoke.error })
if (playwright.error !== '') packageRows.push({ label: t('common.errorMessage'), value: playwright.error })
const browserList = browsers.entries.length === 0
? h('p', { style: styles.hint }, t('playwright.browsersEmpty'))
: h('ul', { style: styles.browserList }, browsers.entries.map((entry, index) => h('li', { key: `browser-${index}` }, browserLabel(entry, t))), )
return h(Panel, { title: t('playwright.title'), badge: h(Badge, { tone: playwrightTone(playwright.state), text: stateLabel(t, playwright.state) }), }, h(InfoGrid, { rows: packageRows }),
h('div', { style: styles.subPanel }, h('div', { style: styles.subHeader }, h('h4', { style: styles.subTitle }, t('playwright.browsers')),
h(Badge, { tone: browsers.exists ? 'ok' : 'neutral', text: browsers.exists ? t('common.yes') : t('common.no') }), ), h(InfoGrid, { rows: browserRows }), browserList, ), h('div', { style: styles.subPanel },
h('h4', { style: styles.subTitle }, t('playwright.fallback')), h(InfoGrid, { rows: fallbackRows }), h('div', { style: styles.subHeader }, h('h4', { style: styles.subTitle }, t('playwright.launchSmoke')),
h(Badge, { tone: smoke.enabled ? (smoke.tested ? (smoke.ok === true ? 'ok' : 'error') : 'neutral') : 'neutral', text: smokeLabel(smoke, t) }), ), h(InfoGrid, { rows: smokeRows }), ), )
}
/**
* 最近降级与回退建议：把 webctl 的 actionable / fallback_hint 变成可读的下一步。
* @param {{status: object, t: Function}} props - 属性。
* @returns {object} 元素。
*/
function DegradationPanel({ status, t }) { const records = status.recentDegradations
const readiness = status.fallbackReadiness
const tone = records.length === 0
? 'neutral'
: readiness.playwrightSuitableSeen
? (readiness.playwrightReady ? 'ok' : 'warn')
: 'neutral'
const content = records.length === 0
? h('p', { style: styles.hint }, t('degradation.empty'))
: h('div', { style: styles.diagList }, records.map((record, index) => { const hint = record.fallbackHint
const parts = []
if (record.reason !== null) parts.push(h('div', { key: 'reason', style: styles.diagMessage }, record.reason))
if (record.nextSteps.length > 0) { parts.push(h('div', { key: 'next', style: styles.diagHint }, t('degradation.nextSteps') + '：' + record.nextSteps.join(' / ')))
}
if (hint !== null) { const verdict = hint.playwrightSuitable ? t('degradation.playwrightSuitable') : t('degradation.notSuitable')
const signals = hint.signals.length > 0 ? '（' + hint.signals.join('; ') + '）' : ''
parts.push(h('div', { key: 'hint', style: styles.diagHint }, verdict + signals))
}
return h('div', { key: 'degradation-' + index, style: styles.diagItem }, h('div', { style: styles.diagHead }, h('span', { style: styles.diagCode }, record.tool),
record.code === null ? null : h('span', { style: styles.diagCode }, record.code), record.degradedFrom === null ? null : h('span', { style: styles.diagHint }, record.degradedFrom),
record.at === null ? null : h('span', { style: styles.diagHint }, new Date(record.at).toLocaleTimeString()), ), h('div', { style: styles.diagBody }, parts), )
}), )
return h(Panel, { title: t('degradation.title'), badge: h(Badge, { tone, text: t('degradation.count', { n: records.length }) }), }, readiness.advice === '' ? null : h('p', { style: styles.hint }, readiness.advice),
content)
}
/**
* 诊断列表：按 level 用主题 token 着色。
* @param {{status: object, t: Function}} props - 属性。
* @returns {object} 元素。
*/
function DiagnosticsPanel({ status, t }) { const items = status.diagnostics
const hasError = items.some(item => item.level === 'error')
const hasWarn = items.some(item => item.level === 'warn')
const tone = hasError ? 'error' : hasWarn ? 'warn' : items.length > 0 ? 'ok' : 'neutral'
const content = items.length === 0
? h('p', { style: styles.hint }, t('diagnostics.empty'))
: h('div', { style: styles.diagList }, items.map((item, index) => { const itemTone = item.level === 'ok' ? 'ok' : item.level === 'warn' ? 'warn' : 'error'
const style = { ...styles.diagItem, ...(itemTone === 'ok' ? styles.diagOk : itemTone === 'warn' ? styles.diagWarn : styles.diagError) }
const levelStyle = itemTone === 'ok' ? styles.levelOk : itemTone === 'warn' ? styles.levelWarn : styles.levelError
return h('div', { key: `diagnostic-${index}`, style }, h('div', { style: styles.diagHead }, h('span', { style: { ...styles.diagLevel, ...levelStyle } }, t(`level.${itemTone}`)),
item.code === '' ? null : h('span', { style: styles.diagCode }, item.code), ), h('div', { style: styles.diagBody }, h('div', { style: styles.diagMessage }, item.message === '' ? t('common.unknown') : item.message),
item.hint === '' ? null : h('div', { style: styles.diagHint }, item.hint), ), )
}), )
return h(Panel, { title: t('diagnostics.title'), badge: h(Badge, { tone, text: t('diagnostics.count', { n: items.length }) }), }, content)
}
/**
* 可折叠工具清单：webctl caps 与 MCP tools/list 两列。
* @param {{status: object, t: Function}} props - 属性。
* @returns {object} 元素。
*/
function ToolsPanel({ status, t }) { const webctlTools = status.webctl.tools
const mcpTools = status.mcp.tools
const registeredTools = status.mcp.registeredTools
const mcpSet = new Set(mcpTools)
const renderList = (tools, markMissing, emptyText) => { if (tools.length === 0) return h('p', { style: styles.hint }, emptyText)
return h('ul', { style: styles.toolList }, tools.map((name, index) => h('li', { key: `tool-${index}` }, h('code', { style: styles.mono }, name),
markMissing && !mcpSet.has(name) ? h('span', { style: styles.toolMissing }, t('tools.missingInMcp')) : null, )), )
}
const columns = [ [t('tools.webctl'), renderList(webctlTools, true, t('tools.empty'))], [t('tools.mcp'), renderList(mcpTools, false, t('tools.empty'))], ]
if (registeredTools !== null) { columns.push([t('tools.registered'), renderList(registeredTools, false, t('tools.registeredEmpty'))])
}
const summary = registeredTools === null
? t('tools.summary', { webctl: webctlTools.length, mcp: mcpTools.length })
: t('tools.summaryRegistered', { webctl: webctlTools.length, mcp: mcpTools.length, registered: registeredTools.length })
return h('details', { style: styles.details }, h('summary', { style: styles.summary }, summary), h('div', { style: styles.toolsGrid }, columns.map(([title, content], index) => h('div', { key: `column-${index}` },
h('div', { style: styles.toolColumnTitle }, title), content, )), ), )
}
/**
* 设置页分区主体：自动请求、刷新、错误与四块内容。
* @param {{t: Function}} props - 属性。
* @returns {object} 元素。
*/
function WebctlSettingsSection({ t }) { const [status, setStatus] = useState(null)
const [phase, setPhase] = useState('loading')
const [error, setError] = useState('')
const [busy, setBusy] = useState(false)
const aliveRef = useRef(true)
const abortRef = useRef(null)
const load = useCallback(async refresh => { if (abortRef.current !== null) abortRef.current.abort()
const controller = new AbortController()
abortRef.current = controller
setBusy(true)
try { const payload = await requestStatus(refresh === true, controller.signal, t)
if (!aliveRef.current || abortRef.current !== controller) return
setStatus(normalizeStatus(payload))
setPhase('ready')
setError('')
} catch (failure) { if (failure instanceof Error && failure.name === 'AbortError') return
if (!aliveRef.current || abortRef.current !== controller) return
const detail = failure instanceof Error ? failure.message : String(failure)
setError(t('settings.loadFailed', { detail }))
setPhase(previous => previous === 'ready' ? 'ready' : 'error')
} finally { if (aliveRef.current && abortRef.current === controller) setBusy(false)
}
}, [t])
useEffect(() => { aliveRef.current = true
void load(false)
return () => { aliveRef.current = false
if (abortRef.current !== null) { abortRef.current.abort()
abortRef.current = null
}
}
}, [load])
const refresh = () => { void load(true) }
const buttonStyle = busy ? { ...styles.button, ...styles.buttonDisabled } : styles.button
return h('section', { style: styles.root, 'aria-busy': busy ? 'true' : undefined }, h('div', { style: styles.header }, h('div', { style: { minWidth: 0 } }, h('h2', { style: styles.title }, t('settings.title')),
h('p', { style: styles.description }, t('settings.description')), ), h('button', { type: 'button', style: buttonStyle, disabled: busy, 'aria-busy': busy ? 'true' : undefined, onClick: refresh,
}, busy ? t('settings.refreshing') : t('settings.refresh')), ), status === null ? null : h(StatusLine, { status, busy, t }), phase === 'loading' && status === null
? h('p', { style: styles.hint, role: 'status' }, t('settings.loading'))
: null, error === ''
? null
: h(ErrorBanner, { message: error, t, onRetry: refresh }), status === null
? null
: h(React.Fragment, null, h(WebctlPanel, { status, t }), h(PlaywrightPanel, { status, t }), h(DegradationPanel, { status, t }), h(DiagnosticsPanel, { status, t }), h(ToolsPanel, { status, t }), ), )
}
/**
* 插件入口：注册 locale 词典与设置页分区。
*
* 本文件是 factory 的最后一段，返回插件对象；前面的部件共享同一作用域。
*/
return { inject: ['slots', 'locale'], apply(ctx) { ctx.effect(() => ctx.locale.register(NS, { zh: ZH, en: EN }), 'dsh-webctl: 设置页词典')
const t = ctx.locale.bind(NS)
ctx.slots.inject('settings.section', () => ctx.slots.register({ name: 'settings.section', id: 'dsh-webctl', order: 70, locale: NS, label: () => t('settings.title'), }, () => h(WebctlSettingsSection, { t })))
}, }
}, })
