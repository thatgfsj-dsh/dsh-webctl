/**
 * webctl 降级观测：从工具结果里提取 webctl 信封，记录最近的可行动降级与 fallback_hint。
 *
 * 只做只读观测：不改写结果、不触发额外调用；记录里不含页面内容、cookie 或凭据。
 */

/** 默认保留条数。 */
export const MAX_RECORDS = 20

/**
 * 把任意值安全转成字符串数组。
 * @param {unknown} value - 原值。
 * @param {number} limit - 最多保留条数。
 * @returns {string[]} 字符串数组。
 */
function stringArray(value, limit = 8) {
  if (!Array.isArray(value)) return []
  return value
    .filter((item) => typeof item === 'string' && item.trim() !== '')
    .slice(0, limit)
    .map((item) => item.slice(0, 300))
}

/**
 * 安全取一个字符串字段。
 * @param {unknown} value - 原值。
 * @param {number} [limit] - 截断长度。
 * @returns {string|null} 字符串或 null。
 */
function stringField(value, limit = 300) {
  if (typeof value !== 'string' || value.trim() === '') return null
  return value.slice(0, limit)
}

/**
 * 从 MCP 工具值里找 webctl 信封：既有 content 文本块，也接受 structuredContent。
 * @param {unknown} value - 工具执行结果值（{content, structuredContent}）。
 * @returns {object|null} 信封对象。
 */
export function extractWebctlEnvelope(value) {
  if (value === null || typeof value !== 'object') return null
  const record = /** @type {Record<string, unknown>} */ (value)
  const structured = record.structuredContent
  if (isEnvelope(structured)) return structured
  const content = record.content
  if (!Array.isArray(content)) return null
  for (const block of content) {
    if (block === null || typeof block !== 'object') continue
    const item = /** @type {Record<string, unknown>} */ (block)
    if (item.type !== 'text' || typeof item.text !== 'string') continue
    let parsed
    try {
      parsed = JSON.parse(item.text)
    } catch {
      continue
    }
    if (isEnvelope(parsed)) return parsed
  }
  return null
}

/**
 * 判断一个值是否是 webctl 信封。
 * @param {unknown} value - 原值。
 * @returns {boolean} 是否信封。
 */
function isEnvelope(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const record = /** @type {Record<string, unknown>} */ (value)
  return typeof record.ok === 'boolean' && (typeof record.code === 'string' || (record.meta !== null && typeof record.meta === 'object'))
}

/**
 * 把信封压成一条供状态页展示的降级记录。
 * @param {object} input - 输入。
 * @param {string} input.tool - 工具公开名。
 * @param {object} input.envelope - webctl 信封。
 * @param {number} [input.at] - 时间戳。
 * @returns {object} 记录。
 */
export function summarizeDegradation(input) {
  const envelope = /** @type {Record<string, unknown>} */ (input.envelope)
  const meta = envelope.meta !== null && typeof envelope.meta === 'object' ? /** @type {Record<string, unknown>} */ (envelope.meta) : {}
  const actionable = meta.actionable !== null && typeof meta.actionable === 'object' ? /** @type {Record<string, unknown>} */ (meta.actionable) : {}
  const hintSource = actionable.fallback_hint ?? meta.fallback_hint
  const hint = hintSource !== null && hintSource !== undefined && typeof hintSource === 'object'
    ? /** @type {Record<string, unknown>} */ (hintSource)
    : null
  return {
    at: typeof input.at === 'number' ? input.at : Date.now(),
    tool: input.tool,
    code: stringField(envelope.code, 64),
    degradedFrom: stringField(meta.degraded_from, 64),
    error: stringField(envelope.error, 200),
    reason: stringField(actionable.reason, 120),
    detected: stringArray(actionable.detected, 5),
    nextSteps: stringArray(actionable.next_steps, 5),
    fallbackHint: hint === null
      ? null
      : {
        playwrightSuitable: hint.playwright_suitable === true,
        signals: stringArray(hint.signals, 5),
        embeddedDataTried: hint.embedded_data_tried === true,
        jsEngineSuitable: hint.js_engine_suitable === true,
      },
  }
}

/**
 * 该记录是否值得保留（成功且无任何降级信号的不记）。
 * @param {object} record - 记录。
 * @returns {boolean} 是否保留。
 */
export function isNoteworthy(record) {
  return (record.code !== null && record.code !== 'OK')
    || record.degradedFrom !== null
    || record.reason !== null
    || (record.nextSteps !== null && record.nextSteps.length > 0)
    || record.fallbackHint !== null
}

/**
 * 最近降级环缓冲。
 */
export class DegradationLog {
  /**
   * @param {number} [limit] - 最多保留条数。
   */
  constructor(limit = MAX_RECORDS) {
    this.limit = limit
    /** @type {object[]} */
    this.records = []
  }

  /**
   * 记录一条。
   * @param {object} record - 记录。
   * @returns {void}
   */
  push(record) {
    this.records.unshift(record)
    if (this.records.length > this.limit) this.records.length = this.limit
  }

  /**
   * 从一次工具结果中提取并记录（非 webctl 工具、失败结果、无降级信号都不记）。
   * @param {object|undefined} exec - 工具执行信息（含 name）。
   * @param {object|undefined} result - 工具结果（含 isError/value）。
   * @returns {object|null} 记录或 null。
   */
  recordToolResult(exec, result) {
    try {
      const name = exec !== null && typeof exec === 'object' ? /** @type {Record<string, unknown>} */ (exec).name : undefined
      if (typeof name !== 'string' || !name.startsWith('mcp__')) return null
      if (result === null || typeof result !== 'object') return null
      const outcome = /** @type {Record<string, unknown>} */ (result)
      if (outcome.isError === true) return null
      const envelope = extractWebctlEnvelope(outcome.value)
      if (envelope === null) return null
      const record = summarizeDegradation({ tool: name, envelope })
      if (!isNoteworthy(record)) return null
      this.push(record)
      return record
    } catch {
      return null
    }
  }

  /**
   * 读取当前记录（副本）。
   * @returns {object[]} 记录。
   */
  list() {
    return this.records.slice()
  }

  /**
   * 清空。
   * @returns {void}
   */
  clear() {
    this.records = []
  }
}
