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
async function requestStatus(refresh, signal, t) {
  const url = refresh ? `${API}/status?refresh=1` : `${API}/status`
  const response = await fetch(url, {
    method: 'GET',
    signal,
    credentials: 'same-origin',
    headers: { accept: 'application/json' },
  })
  let payload = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }
  if (response.ok !== true) {
    const record = asRecord(payload)
    const failure = asRecord(record.error)
    const fallback = t('settings.httpFailed', { status: response.status })
    throw new Error(display(failure.message, display(record.message, fallback)))
  }
  if (!isRecord(payload)) throw new Error(t('settings.badResponse'))
  if (payload.ok !== true) {
    const failure = asRecord(payload.error)
    throw new Error(display(failure.message, display(failure.code, t('settings.badResponse'))))
  }
  return payload
}

/**
 * 状态徽标（文字 + 彩色边框，不写死颜色）。
 * @param {{tone?: string, text: string}} props - 属性。
 * @returns {object} 元素。
 */
function Badge({ tone, text }) {
  let toneStyle = null
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
function InfoGrid({ rows }) {
  const visible = rows.filter(row => row !== null && row !== undefined
    && row.value !== null && row.value !== undefined && row.value !== '')
  if (visible.length === 0) return null
  const children = []
  visible.forEach((row, index) => {
    children.push(h('div', { key: `label-${index}`, style: styles.fieldLabel }, row.label))
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
function ErrorLines({ error, t }) {
  if (error === null) return null
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
function Panel({ title, badge, children }) {
  return h('div', { style: styles.panel },
    h('div', { style: styles.panelHeader },
      h('h3', { style: styles.panelTitle }, title),
      badge === undefined ? null : badge,
    ),
    children,
  )
}

/**
 * 顶部状态行：最后检查时间、缓存/实时、耗时。
 * @param {{status: object, busy: boolean, t: Function}} props - 属性。
 * @returns {object} 元素。
 */
function StatusLine({ status, busy, t }) {
  const time = formatTime(status.checkedAt)
  const parts = []
  parts.push(h('span', { key: 'time' }, time === '' ? t('settings.notCheckedYet') : t('settings.lastChecked', { time })))
  parts.push(h('span', { key: 'sep-1' }, '·'))
  parts.push(h('span', { key: 'mode' }, status.cached ? t('settings.cached') : t('settings.live')))
  if (status.durationMs !== null) {
    parts.push(h('span', { key: 'sep-2' }, '·'))
    parts.push(h('span', { key: 'duration' }, t('settings.duration', { ms: status.durationMs })))
  }
  if (busy) {
    parts.push(h('span', { key: 'sep-3' }, '·'))
    parts.push(h('span', { key: 'busy' }, t('settings.refreshing')))
  }
  return h('div', { style: styles.statusLine, role: 'status' }, parts)
}

/**
 * 错误横幅 + 重试按钮。
 * @param {{message: string, onRetry: Function, t: Function}} props - 属性。
 * @returns {object} 元素。
 */
function ErrorBanner({ message, onRetry, t }) {
  return h('div', { style: styles.errorBox, role: 'alert' },
    h('p', { style: styles.errorText }, message),
    h('div', { style: styles.errorActions },
      h('button', { type: 'button', style: styles.button, onClick: onRetry }, t('settings.retry')),
    ),
  )
}

/**
 * 服务信息文案。
 * @param {object|null} info - serverInfo。
 * @param {Function} t - 翻译函数。
 * @returns {string} 文案。
 */
function serverInfoLabel(info, t) {
  if (info === null) return t('common.unknown')
  const text = [asString(info.name), asString(info.version)].filter(part => part !== '').join(' ')
  return text === '' ? t('common.unknown') : text
}

/**
 * 回退声明文案。
 * @param {object} fallback - 归一化 fallback。
 * @param {Function} t - 翻译函数。
 * @returns {string} 文案。
 */
function fallbackLabel(fallback, t) {
  if (!fallback.declaredInEnv) return t('playwright.fallbackMissing')
  return fallback.toolName === null ? t('playwright.fallbackDeclaredNoTool') : t('playwright.fallbackDeclared', { tool: fallback.toolName })
}

/**
 * 启动冒烟文案。
 * @param {object} smoke - 归一化 launchSmoke。
 * @param {Function} t - 翻译函数。
 * @returns {string} 文案。
 */
function smokeLabel(smoke, t) {
  if (!smoke.enabled) return t('playwright.smoke.disabled')
  if (!smoke.tested) return t('playwright.smoke.untested')
  return smoke.ok === true ? t('playwright.smoke.passed') : t('playwright.smoke.failed')
}

/**
 * 浏览器条目文案。
 * @param {{name: string, version: string}} entry - 条目。
 * @param {Function} t - 翻译函数。
 * @returns {string} 文案。
 */
function browserLabel(entry, t) {
  const text = [entry.name, entry.version].filter(part => part !== '').join(' ')
  return text === '' ? t('common.unknown') : text
}

/**
 * webctl 与 MCP 握手信息。
 * @param {{status: object, t: Function}} props - 属性。
 * @returns {object} 元素。
 */
function WebctlPanel({ status, t }) {
  const webctl = status.webctl
  const mcp = status.mcp
  const rows = [
    { label: t('webctl.command'), value: webctl.command === '' ? t('common.unknown') : webctl.command, mono: true },
    { label: t('webctl.path'), value: webctl.resolvedPath === null ? t('webctl.pathMissing') : webctl.resolvedPath, mono: true },
    { label: t('webctl.version'), value: webctl.version === null ? t('common.unknown') : webctl.version, mono: true },
    { label: t('webctl.tools'), value: t('webctl.toolCount', { n: webctl.toolCount }) },
    { label: t('webctl.fallback'), value: webctl.fallbackCapability === null ? t('common.no') : t('common.yes') },
  ]
  const mcpRows = [
    { label: t('mcp.server'), value: serverInfoLabel(mcp.serverInfo, t), mono: true },
    { label: t('mcp.protocol'), value: mcp.protocolVersion === null ? t('common.unknown') : mcp.protocolVersion, mono: true },
    { label: t('mcp.tools'), value: t('webctl.toolCount', { n: mcp.toolCount }) },
    { label: t('mcp.registered'), value: mcp.registeredToolCount === null ? '' : t('webctl.toolCount', { n: mcp.registeredToolCount }) },
  ]
  return h(Panel, {
    title: t('webctl.title'),
    badge: h(Badge, { tone: stateTone(webctl.state), text: stateLabel(t, webctl.state) }),
  },
    h(InfoGrid, { rows }),
    h(ErrorLines, { error: webctl.error, t }),
    h('div', { style: styles.subPanel },
      h('div', { style: styles.subHeader },
        h('h4', { style: styles.subTitle }, t('mcp.title')),
        h(Badge, { tone: stateTone(mcp.state), text: stateLabel(t, mcp.state) }),
      ),
      h(InfoGrid, { rows: mcpRows }),
      h(ErrorLines, { error: mcp.error, t }),
    ),
  )
}

/**
 * Playwright 包、浏览器缓存、回退声明与启动冒烟。
 * @param {{status: object, t: Function}} props - 属性。
 * @returns {object} 元素。
 */
function PlaywrightPanel({ status, t }) {
  const playwright = status.playwright
  const pkg = playwright.package
  const browsers = playwright.browsers
  const smoke = playwright.launchSmoke
  const packageRows = [
    { label: t('playwright.package'), value: pkg.found ? t('playwright.packageFound') : t('playwright.packageMissing') },
    { label: t('playwright.name'), value: pkg.name === null ? t('common.unknown') : pkg.name, mono: true },
    { label: t('playwright.version'), value: pkg.version === null ? t('common.unknown') : pkg.version, mono: true },
    { label: t('playwright.path'), value: pkg.path === null ? t('common.unknown') : pkg.path, mono: true },
    { label: t('playwright.searchedDirs'), value: pkg.searchedDirs.length === 0 ? '' : pkg.searchedDirs.join(t('common.listSeparator')), mono: true },
  ]
  const browserRows = [
    { label: t('playwright.browsersPath'), value: browsers.path === null ? t('common.unknown') : browsers.path, mono: true },
    { label: t('playwright.browsersExists'), value: browsers.exists ? t('common.yes') : t('common.no') },
  ]
  const fallbackRows = [
    { label: t('common.status'), value: fallbackLabel(playwright.fallback, t) },
  ]
  const smokeRows = [
    { label: t('common.result'), value: smokeLabel(smoke, t) },
  ]
  if (smoke.error !== '') smokeRows.push({ label: t('common.errorMessage'), value: smoke.error })
  if (playwright.error !== '') packageRows.push({ label: t('common.errorMessage'), value: playwright.error })
  const browserList = browsers.entries.length === 0
    ? h('p', { style: styles.hint }, t('playwright.browsersEmpty'))
    : h('ul', { style: styles.browserList },
      browsers.entries.map((entry, index) => h('li', { key: `browser-${index}` }, browserLabel(entry, t))),
    )
  return h(Panel, {
    title: t('playwright.title'),
    badge: h(Badge, { tone: playwrightTone(playwright.state), text: stateLabel(t, playwright.state) }),
  },
    h(InfoGrid, { rows: packageRows }),
    h('div', { style: styles.subPanel },
      h('div', { style: styles.subHeader },
        h('h4', { style: styles.subTitle }, t('playwright.browsers')),
        h(Badge, { tone: browsers.exists ? 'ok' : 'neutral', text: browsers.exists ? t('common.yes') : t('common.no') }),
      ),
      h(InfoGrid, { rows: browserRows }),
      browserList,
    ),
    h('div', { style: styles.subPanel },
      h('h4', { style: styles.subTitle }, t('playwright.fallback')),
      h(InfoGrid, { rows: fallbackRows }),
      h('div', { style: styles.subHeader },
        h('h4', { style: styles.subTitle }, t('playwright.launchSmoke')),
        h(Badge, { tone: smoke.enabled ? (smoke.tested ? (smoke.ok === true ? 'ok' : 'error') : 'neutral') : 'neutral', text: smokeLabel(smoke, t) }),
      ),
      h(InfoGrid, { rows: smokeRows }),
    ),
  )
}

/**
 * 诊断列表：按 level 用主题 token 着色。
 * @param {{status: object, t: Function}} props - 属性。
 * @returns {object} 元素。
 */
function DiagnosticsPanel({ status, t }) {
  const items = status.diagnostics
  const hasError = items.some(item => item.level === 'error')
  const hasWarn = items.some(item => item.level === 'warn')
  const tone = hasError ? 'error' : hasWarn ? 'warn' : items.length > 0 ? 'ok' : 'neutral'
  const content = items.length === 0
    ? h('p', { style: styles.hint }, t('diagnostics.empty'))
    : h('div', { style: styles.diagList },
      items.map((item, index) => {
        const itemTone = item.level === 'ok' ? 'ok' : item.level === 'warn' ? 'warn' : 'error'
        const style = { ...styles.diagItem, ...(itemTone === 'ok' ? styles.diagOk : itemTone === 'warn' ? styles.diagWarn : styles.diagError) }
        const levelStyle = itemTone === 'ok' ? styles.levelOk : itemTone === 'warn' ? styles.levelWarn : styles.levelError
        return h('div', { key: `diagnostic-${index}`, style },
          h('div', { style: styles.diagHead },
            h('span', { style: { ...styles.diagLevel, ...levelStyle } }, t(`level.${itemTone}`)),
            item.code === '' ? null : h('span', { style: styles.diagCode }, item.code),
          ),
          h('div', { style: styles.diagBody },
            h('div', { style: styles.diagMessage }, item.message === '' ? t('common.unknown') : item.message),
            item.hint === '' ? null : h('div', { style: styles.diagHint }, item.hint),
          ),
        )
      }),
    )
  return h(Panel, {
    title: t('diagnostics.title'),
    badge: h(Badge, { tone, text: t('diagnostics.count', { n: items.length }) }),
  }, content)
}

/**
 * 可折叠工具清单：webctl caps 与 MCP tools/list 两列。
 * @param {{status: object, t: Function}} props - 属性。
 * @returns {object} 元素。
 */
function ToolsPanel({ status, t }) {
  const webctlTools = status.webctl.tools
  const mcpTools = status.mcp.tools
  const registeredTools = status.mcp.registeredTools
  const mcpSet = new Set(mcpTools)
  const renderList = (tools, markMissing, emptyText) => {
    if (tools.length === 0) return h('p', { style: styles.hint }, emptyText)
    return h('ul', { style: styles.toolList },
      tools.map((name, index) => h('li', { key: `tool-${index}` },
        h('code', { style: styles.mono }, name),
        markMissing && !mcpSet.has(name) ? h('span', { style: styles.toolMissing }, t('tools.missingInMcp')) : null,
      )),
    )
  }
  const columns = [
    [t('tools.webctl'), renderList(webctlTools, true, t('tools.empty'))],
    [t('tools.mcp'), renderList(mcpTools, false, t('tools.empty'))],
  ]
  if (registeredTools !== null) {
    columns.push([t('tools.registered'), renderList(registeredTools, false, t('tools.registeredEmpty'))])
  }
  const summary = registeredTools === null
    ? t('tools.summary', { webctl: webctlTools.length, mcp: mcpTools.length })
    : t('tools.summaryRegistered', { webctl: webctlTools.length, mcp: mcpTools.length, registered: registeredTools.length })
  return h('details', { style: styles.details },
    h('summary', { style: styles.summary }, summary),
    h('div', { style: styles.toolsGrid },
      columns.map(([title, content], index) => h('div', { key: `column-${index}` },
        h('div', { style: styles.toolColumnTitle }, title),
        content,
      )),
    ),
  )
}

/**
 * 设置页分区主体：自动请求、刷新、错误与四块内容。
 * @param {{t: Function}} props - 属性。
 * @returns {object} 元素。
 */
function WebctlSettingsSection({ t }) {
  const [status, setStatus] = useState(null)
  const [phase, setPhase] = useState('loading')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const aliveRef = useRef(true)
  const abortRef = useRef(null)

  const load = useCallback(async refresh => {
    if (abortRef.current !== null) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setBusy(true)
    try {
      const payload = await requestStatus(refresh === true, controller.signal, t)
      if (!aliveRef.current || abortRef.current !== controller) return
      setStatus(normalizeStatus(payload))
      setPhase('ready')
      setError('')
    } catch (failure) {
      if (failure instanceof Error && failure.name === 'AbortError') return
      if (!aliveRef.current || abortRef.current !== controller) return
      const detail = failure instanceof Error ? failure.message : String(failure)
      setError(t('settings.loadFailed', { detail }))
      setPhase(previous => previous === 'ready' ? 'ready' : 'error')
    } finally {
      if (aliveRef.current && abortRef.current === controller) setBusy(false)
    }
  }, [t])

  useEffect(() => {
    aliveRef.current = true
    void load(false)
    return () => {
      aliveRef.current = false
      if (abortRef.current !== null) {
        abortRef.current.abort()
        abortRef.current = null
      }
    }
  }, [load])

  const refresh = () => { void load(true) }
  const buttonStyle = busy ? { ...styles.button, ...styles.buttonDisabled } : styles.button

  return h('section', { style: styles.root, 'aria-busy': busy ? 'true' : undefined },
    h('div', { style: styles.header },
      h('div', { style: { minWidth: 0 } },
        h('h2', { style: styles.title }, t('settings.title')),
        h('p', { style: styles.description }, t('settings.description')),
      ),
      h('button', {
        type: 'button',
        style: buttonStyle,
        disabled: busy,
        'aria-busy': busy ? 'true' : undefined,
        onClick: refresh,
      }, busy ? t('settings.refreshing') : t('settings.refresh')),
    ),
    status === null ? null : h(StatusLine, { status, busy, t }),
    phase === 'loading' && status === null
      ? h('p', { style: styles.hint, role: 'status' }, t('settings.loading'))
      : null,
    error === ''
      ? null
      : h(ErrorBanner, { message: error, t, onRetry: refresh }),
    status === null
      ? null
      : h(React.Fragment, null,
        h(WebctlPanel, { status, t }),
        h(PlaywrightPanel, { status, t }),
        h(DiagnosticsPanel, { status, t }),
        h(ToolsPanel, { status, t }),
      ),
  )
}