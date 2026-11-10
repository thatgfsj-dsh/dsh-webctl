/**
 * 降级观测与回退就绪判断的离线测试。
 *
 * 用合成的 webctl 信封覆盖：actionable / fallback_hint 提取、记录筛选、环缓冲上限、
 * 以及状态合成里 PLAYWRIGHT_FALLBACK_UNAVAILABLE 的触发条件。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DegradationLog, extractWebctlEnvelope, isNoteworthy, summarizeDegradation } from '../src/host/degradations.mjs'
import { composeStatus } from '../src/host/status.mjs'

/**
 * 构造一个 webctl 降级信封（文本块形式，模拟 MCP 返回）。
 * @param {object} [overrides] - 覆盖字段。
 * @returns {object} 工具结果值。
 */
function envelopeValue(overrides = {}) {
  const envelope = {
    ok: true,
    data: {},
    error: '',
    code: 'DEGRADED',
    meta: {
      engine: 'builtin',
      trust: 'untrusted_page_content',
      degraded_from: 'js-render',
      actionable: {
        reason: 'no-server-rendered-content',
        detected: ['visible text: 0 chars', 'script tags: 3'],
        next_steps: ['embedded_data'],
        fallback_hint: {
          playwright_suitable: true,
          signals: ['#root empty', 'script[src*=chunk]'],
          embedded_data_tried: true,
          js_engine_suitable: false,
        },
      },
    },
    ...overrides,
  }
  return { content: [{ type: 'text', text: JSON.stringify(envelope) }] }
}

test('extractWebctlEnvelope 从文本块与 structuredContent 提取信封', () => {
  const fromText = extractWebctlEnvelope(envelopeValue())
  assert.equal(fromText?.code, 'DEGRADED')
  const fromStructured = extractWebctlEnvelope({ content: [], structuredContent: { ok: true, code: 'OK', meta: {} } })
  assert.equal(fromStructured?.code, 'OK')
  assert.equal(extractWebctlEnvelope({ content: [{ type: 'text', text: 'not json' }] }), null)
  assert.equal(extractWebctlEnvelope(null), null)
})

test('summarizeDegradation 保留可行动信息但不含页面内容', () => {
  const record = summarizeDegradation({ tool: 'mcp__webctl__fetch', envelope: extractWebctlEnvelope(envelopeValue()), at: 123 })
  assert.equal(record.tool, 'mcp__webctl__fetch')
  assert.equal(record.code, 'DEGRADED')
  assert.equal(record.degradedFrom, 'js-render')
  assert.equal(record.reason, 'no-server-rendered-content')
  assert.deepEqual(record.nextSteps, ['embedded_data'])
  assert.equal(record.fallbackHint?.playwrightSuitable, true)
  assert.equal(record.fallbackHint?.embeddedDataTried, true)
  assert.equal(JSON.stringify(record).includes('visible text'), true)
  assert.equal(record.at, 123)
})

test('recordToolResult 只记 webctl 的降级结果', () => {
  const log = new DegradationLog(3)
  const ok = log.recordToolResult({ name: 'mcp__webctl__fetch' }, { isError: false, value: envelopeValue({ code: 'OK', meta: {} }) })
  assert.equal(ok, null)
  const nonMcp = log.recordToolResult({ name: 'bash' }, { isError: false, value: envelopeValue() })
  assert.equal(nonMcp, null)
  const failed = log.recordToolResult({ name: 'mcp__webctl__fetch' }, { isError: true })
  assert.equal(failed, null)
  const recorded = log.recordToolResult({ name: 'mcp__webctl__fetch' }, { isError: false, value: envelopeValue() })
  assert.equal(recorded?.code, 'DEGRADED')
  assert.equal(log.list().length, 1)
  // 环缓冲上限生效，且最新在前。
  for (let index = 0; index < 5; index += 1) log.recordToolResult({ name: 'mcp__webctl__extract' }, { isError: false, value: envelopeValue() })
  assert.equal(log.list().length, 3)
  assert.equal(isNoteworthy(summarizeDegradation({ tool: 'x', envelope: { ok: true, code: 'OK', meta: {} } })), false)
})

/**
 * 合成状态输入。
 * @param {object} options - 选项。
 * @returns {object} composeStatus 输入。
 */
function statusInput({ playwrightState, degradations }) {
  return {
    webctl: { state: 'ready', command: 'webctl', resolvedPath: '/usr/bin/webctl', version: '0.2.3', caps: { version: '0.2.3', tools: [{ name: 'fetch', state: 'available' }], fallbackCapability: null }, error: null },
    mcp: { state: 'ready', serverInfo: { name: 'webctl', version: '0.2.3' }, protocolVersion: '2025-06-18', tools: ['fetch'], error: null },
    playwright: { state: playwrightState, package: { found: playwrightState !== 'missing', name: null, version: null, path: null, searchedDirs: [] }, browsers: { path: null, exists: false, entries: [] }, fallback: { declaredInEnv: false, toolName: null }, launchSmoke: { enabled: false, tested: false, ok: null, error: null }, error: null },
    registeredTools: ['mcp__webctl__fetch'],
    degradations,
    config: { command: 'webctl', serverName: 'webctl' },
    durationMs: 10,
  }
}

test('状态合成：适合回退但 Playwright 缺失时给出警告', () => {
  const record = summarizeDegradation({ tool: 'mcp__webctl__fetch', envelope: extractWebctlEnvelope(envelopeValue()) })
  const status = composeStatus(statusInput({ playwrightState: 'missing', degradations: [record] }))
  const codes = status.diagnostics.map((item) => item.code)
  assert.ok(codes.includes('PLAYWRIGHT_FALLBACK_UNAVAILABLE'))
  assert.equal(status.fallbackReadiness.playwrightSuitableSeen, true)
  assert.equal(status.fallbackReadiness.playwrightReady, false)
  assert.equal(status.recentDegradations.length, 1)
  assert.equal(status.recentDegradations[0].tool, 'mcp__webctl__fetch')
})

test('状态合成：Playwright 就绪时不再警告，并给出可继续的建议', () => {
  const record = summarizeDegradation({ tool: 'mcp__webctl__fetch', envelope: extractWebctlEnvelope(envelopeValue()) })
  const status = composeStatus(statusInput({ playwrightState: 'ready', degradations: [record] }))
  const codes = status.diagnostics.map((item) => item.code)
  assert.equal(codes.includes('PLAYWRIGHT_FALLBACK_UNAVAILABLE'), false)
  assert.equal(status.fallbackReadiness.playwrightReady, true)
  assert.match(status.fallbackReadiness.advice, /继续/)
})
