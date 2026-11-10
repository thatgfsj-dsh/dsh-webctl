/**
 * 真实工具调用集成测试（需要 `WEBCTL_BIN=/path/to/webctl`，否则跳过）。
 *
 * 目的：证明“插件看到的结果就是 webctl 的原始信封”。用最小 MCP 客户端离线调用
 * 无网络依赖的工具（extract/search/links/tables/forms/embedded_data/json_query/caps/doc_text），
 * 再用插件的 extractWebctlEnvelope / summarizeDegradation 解析真实结果。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DegradationLog, extractWebctlEnvelope, summarizeDegradation } from '../src/host/degradations.mjs'

const BIN = process.env.WEBCTL_BIN
const skip = BIN === undefined || BIN === '' ? '未设置 WEBCTL_BIN' : false

/** 示例静态页面（含链接、表格、表单、JSON-LD）。 */
const SAMPLE_HTML = [
  '<!doctype html><html><head><title>示例</title>',
  '<script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","headline":"Demo"}</script>',
  '</head><body>',
  '<h1>Hello webctl</h1>',
  '<a href="/docs" rel="next">文档</a>',
  '<table><thead><tr><th>name</th><th>value</th></tr></thead><tbody><tr><td>alpha</td><td>1</td></tr></tbody></table>',
  '<form action="/submit" method="post"><input name="q" value="x"><input type="submit"></form>',
  '</body></html>',
].join('')

/** SPA 空壳页：没有服务端渲染内容，应显式降级。 */
const SHELL_HTML = '<!doctype html><html><body><div id="root"></div><script src="/chunk.js"></script></body></html>'

/**
 * 最小 MCP stdio 客户端：initialize + tools/call。
 */
class McpClient {
  /**
   * @param {string} command - 可执行文件。
   * @param {object} [options] - 选项。
   * @param {NodeJS.ProcessEnv} [options.env] - 子进程环境。
   */
  constructor(command, options = {}) {
    this.command = command
    this.env = options.env
    this.child = null
    this.buffer = ''
    this.nextId = 1
    this.pending = new Map()
  }

  /**
   * 启动并完成初始化。
   * @returns {Promise<void>} 完成。
   */
  async start() {
    this.child = spawn(this.command, ['mcp'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      ...(this.env === undefined ? {} : { env: this.env }),
    })
    this.child.stdout.on('data', (chunk) => {
      this.buffer += chunk.toString('utf8')
      for (;;) {
        const index = this.buffer.indexOf('\n')
        if (index < 0) break
        const line = this.buffer.slice(0, index).trim()
        this.buffer = this.buffer.slice(index + 1)
        if (line === '') continue
        let message
        try {
          message = JSON.parse(line)
        } catch {
          continue
        }
        const pending = this.pending.get(message.id)
        if (pending !== undefined) {
          this.pending.delete(message.id)
          pending(message)
        }
      }
    })
    await this.request('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'dsh-webctl-test', version: '0.0.0' },
    })
    this.notify('notifications/initialized', {})
  }

  /**
   * 发送请求并等待响应。
   * @param {string} method - 方法。
   * @param {object} params - 参数。
   * @returns {Promise<object>} 响应。
   */
  request(method, params) {
    const id = this.nextId
    this.nextId += 1
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error('MCP 请求超时：' + method))
      }, 15000)
      this.pending.set(id, (message) => {
        clearTimeout(timer)
        if (message.error !== undefined) reject(new Error('MCP 错误：' + JSON.stringify(message.error)))
        else resolve(message.result)
      })
      this.child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
    })
  }

  /**
   * 发送通知。
   * @param {string} method - 方法。
   * @param {object} params - 参数。
   * @returns {void}
   */
  notify(method, params) {
    this.child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n')
  }

  /**
   * 调用一个工具并返回原始 CallToolResult。
   * @param {string} name - 工具名。
   * @param {object} args - 参数。
   * @returns {Promise<object>} 结果。
   */
  async call(name, args) {
    return await this.request('tools/call', { name, arguments: args })
  }

  /**
   * 关闭进程。
   * @returns {Promise<void>} 完成。
   */
  async close() {
    if (this.child !== null) {
      this.child.kill('SIGKILL')
      this.child = null
    }
  }
}

/**
 * 断言一个成功响应的 webctl 信封可被插件解析。
 * @param {object} result - CallToolResult。
 * @returns {object} 信封。
 */
function envelopeOf(result) {
  assert.notEqual(result.isError, true, '工具不应返回 isError')
  const envelope = extractWebctlEnvelope(result)
  assert.notEqual(envelope, null, '应能从真实结果里解析出 webctl 信封')
  return envelope
}

test('真实工具调用：离线工具结果都能被插件解析且语义保留', { skip }, async (t) => {
  const client = new McpClient(BIN)
  await client.start()
  t.after(() => client.close())

  const caps = envelopeOf(await client.call('caps', {}))
  assert.equal(caps.ok, true)
  assert.ok(Array.isArray(caps.data.tools) && caps.data.tools.length >= 15, 'caps 应报告工具面')

  const extract = envelopeOf(await client.call('extract', { html: SAMPLE_HTML, selector: 'h1' }))
  assert.equal(extract.ok, true)
  assert.match(JSON.stringify(extract.data), /Hello webctl/)

  const search = envelopeOf(await client.call('search', { html: SAMPLE_HTML, query: 'alpha' }))
  assert.equal(search.ok, true)
  assert.match(JSON.stringify(search.data), /alpha/)

  const links = envelopeOf(await client.call('links', { html: SAMPLE_HTML, base: 'https://example.com/' }))
  assert.equal(links.ok, true)
  assert.match(JSON.stringify(links.data), /example\.com\/docs/)

  const tables = envelopeOf(await client.call('tables', { html: SAMPLE_HTML }))
  assert.equal(tables.ok, true)
  assert.match(JSON.stringify(tables.data), /alpha/)

  const forms = envelopeOf(await client.call('forms', { html: SAMPLE_HTML, base: 'https://example.com/' }))
  assert.equal(forms.ok, true)
  assert.ok(JSON.stringify(forms.data).includes('/submit'), '表单 action 应保留')

  const embedded = envelopeOf(await client.call('embedded_data', { html: SAMPLE_HTML }))
  assert.equal(embedded.ok, true)
  assert.match(JSON.stringify(embedded.data), /headline/)

  // 上游表达式需要 $ 前缀（实测：a.b[1] 会 PARSE；$.a.b[1] 才 OK）。
  const jsonQuery = envelopeOf(await client.call('json_query', { json: '{"a":{"b":[1,2]}}', expression: '$.a.b[1]' }))
  assert.equal(jsonQuery.ok, true)
  assert.equal(jsonQuery.data?.value, 2)

  const session = envelopeOf(await client.call('session', { action: 'list' }))
  assert.equal(session.ok, true)
  assert.ok(Array.isArray(session.data?.sessions), 'session list 应返回数组')
})

test('真实结果：内联 HTML 空壳不触发降级（降级检测在取回路径，记录仍可解析）', { skip }, async (t) => {
  const client = new McpClient(BIN)
  await client.start()
  t.after(() => client.close())

  // 上游语义：extract 传 html 时不做“JS 空壳页”判定（那是 fetch/extract-by-url 的降级路径）；
  // 这里锁定该行为，避免插件误以为内联 HTML 会出现 DEGRADED。
  const result = await client.call('extract', { html: SHELL_HTML, selector: 'body' })
  const envelope = envelopeOf(result)
  assert.equal(envelope.code, 'OK')
  assert.equal(envelope.meta?.trust, 'untrusted_page_content')
  const record = summarizeDegradation({ tool: 'mcp__webctl__extract', envelope })
  assert.equal(record.code, 'OK')
  assert.equal(record.fallbackHint, null)
})

test('真实工具调用：doc_text 读取本地 HTML 文件', { skip }, async (t) => {
  const client = new McpClient(BIN)
  await client.start()
  t.after(() => client.close())
  const dir = await mkdtemp(join(tmpdir(), 'dsh-webctl-doc-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const file = join(dir, 'doc.html')
  await writeFile(file, '<html><body><p>文档正文 TOKEN-123</p></body></html>')
  const envelope = envelopeOf(await client.call('doc_text', { path: file }))
  assert.equal(envelope.ok, true)
  assert.match(JSON.stringify(envelope.data), /TOKEN-123/)
})
/**
 * 起一个只服务两张页面的本地 HTTP 站点（不访问外网）。
 * @returns {Promise<{base: string, close: () => Promise<void>}>} 地址与关闭函数。
 */
async function startFixtureSite() {
  const server = createServer((request, response) => {
    const path = new URL(request.url, 'http://x').pathname
    if (path === '/shell') {
      response.writeHead(200, { 'content-type': 'text/html' })
      response.end('<!doctype html><html><body><div id="root"></div><script src="/chunk.js"></script></body></html>')
      return
    }
    if (path === '/static') {
      response.writeHead(200, { 'content-type': 'text/html' })
      response.end('<html><body><h1>Static OK</h1><p>hello</p></body></html>')
      return
    }
    if (path.startsWith('/page/')) {
      const n = Number(path.slice('/page/'.length))
      const next = n < 3 ? '/page/' + String(n + 1) : null
      response.writeHead(200, { 'content-type': 'text/html' })
      response.end('<html><body><h1>Page ' + String(n) + '</h1>' + (next === null ? '' : '<a rel="next" href="' + next + '">next</a>') + '</body></html>')
      return
    }
    if (path === '/form') {
      response.writeHead(200, { 'content-type': 'text/html', 'set-cookie': 'sid=SUPERSECRET; Path=/' })
      response.end('<html><body><form action="/submit" method="post"><input name="q" value="x"><input type="submit"></form></body></html>')
      return
    }
    if (path === '/submit' && request.method === 'POST') {
      response.writeHead(200, { 'content-type': 'text/html' })
      response.end('<html><body><h1>submitted ok</h1></body></html>')
      return
    }
    if (path === '/file.bin') {
      response.writeHead(200, { 'content-type': 'application/octet-stream' })
      response.end(Buffer.from([1, 2, 3, 4, 5]))
      return
    }
    if (path === '/robots.txt') {
      response.writeHead(200, { 'content-type': 'text/plain' })
      response.end('User-agent: *\nDisallow: /private\nSitemap: http://127.0.0.1/sitemap.xml\n')
      return
    }
    if (path === '/slow') {
      setTimeout(() => {
        response.writeHead(200, { 'content-type': 'text/html' })
        response.end('<html><body>slow</body></html>')
      }, 3000)
      return
    }
    if (path === '/big') {
      response.writeHead(200, { 'content-type': 'text/html' })
      response.end('<html><body>' + 'x'.repeat(50000) + '</body></html>')
      return
    }
    response.writeHead(404)
    response.end('not found')
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  const base = 'http://127.0.0.1:' + address.port
  return { base, close: () => new Promise((resolve) => server.close(() => resolve())) }
}

test('真实降级链路：本地 JS 空壳页的 fetch 产生 DEGRADED 并被插件记录', { skip }, async (t) => {
  const site = await startFixtureSite()
  t.after(() => site.close())
  const client = new McpClient(BIN)
  await client.start()
  t.after(() => client.close())

  const staticResult = await client.call('fetch', { url: site.base + '/static' })
  const staticEnvelope = envelopeOf(staticResult)
  assert.equal(staticEnvelope.code, 'OK', '静态页应成功')
  assert.equal(staticEnvelope.meta?.trust, 'untrusted_page_content')

  const shellResult = await client.call('fetch', { url: site.base + '/shell' })
  const shellEnvelope = envelopeOf(shellResult)
  assert.equal(shellEnvelope.code, 'DEGRADED', 'JS 空壳页应显式降级')
  assert.equal(shellEnvelope.meta?.degraded_from, 'js-render')
  assert.equal(typeof shellEnvelope.meta?.actionable?.reason, 'string')
  assert.ok(Array.isArray(shellEnvelope.meta?.actionable?.next_steps))

  // 走插件真实路径：tools/result -> DegradationLog
  const log = new DegradationLog()
  const record = log.recordToolResult({ name: 'mcp__webctl__fetch' }, { isError: false, value: shellResult })
  assert.notEqual(record, null, '降级结果应被记录')
  assert.equal(record.code, 'DEGRADED')
  assert.equal(record.degradedFrom, 'js-render')
  assert.ok(record.reason !== null)
  assert.deepEqual(record.nextSteps, shellEnvelope.meta?.actionable?.next_steps ?? [])
})

test('真实降级链路：按 URL 的 extract 零命中也是 DEGRADED', { skip }, async (t) => {
  const site = await startFixtureSite()
  t.after(() => site.close())
  const client = new McpClient(BIN)
  await client.start()
  t.after(() => client.close())

  const result = await client.call('extract', { url: site.base + '/shell', selector: 'h1' })
  const envelope = envelopeOf(result)
  assert.equal(envelope.code, 'DEGRADED')
  assert.equal(envelope.meta?.degraded_from, 'js-render')
  assert.equal(envelope.data?.observed_matches, 0)
})
test('真实会话工具：临时状态目录下 save/load/clear 且不产生降级记录', { skip }, async (t) => {
  const state = await mkdtemp(join(tmpdir(), 'dsh-webctl-session-'))
  t.after(() => rm(state, { recursive: true, force: true }))
  const client = new McpClient(BIN, { env: { ...process.env, WEBCTL_STATE_DIR: state } })
  await client.start()
  t.after(() => client.close())

  const log = new DegradationLog()
  const record = (name, args) => client.call(name, args).then((result) => {
    log.recordToolResult({ name: 'mcp__webctl__' + name }, { isError: false, value: result })
    return envelopeOf(result)
  })

  const list = await record('session', { action: 'list' })
  assert.equal(list.ok, true)
  assert.deepEqual(list.data.sessions, [])

  const save = await record('session', { action: 'save', name: 'e2e' })
  assert.equal(save.ok, true)
  assert.equal(typeof save.data.path, 'string')
  assert.ok(save.data.path.startsWith(state), '会话文件应落在临时状态目录内')
  const saved = await stat(save.data.path)
  assert.equal(saved.mode & 0o777, 0o600, '会话文件应为 0600')

  const load = await record('session', { action: 'load', name: 'e2e' })
  assert.equal(load.ok, true)
  assert.deepEqual(load.data.cookies, [])

  const clear = await record('session', { action: 'clear', name: 'e2e' })
  assert.equal(clear.ok, true)
  assert.equal(clear.data.removed, true)

  // 这些都是干净的 OK 信封，不应进入降级记录（避免把会话数据留在内存里）。
  assert.equal(log.list().length, 0)
})
test('真实 A 批：paginate / fill_form / download / robots', { skip }, async (t) => {
  const site = await startFixtureSite()
  t.after(() => site.close())
  const client = new McpClient(BIN)
  await client.start()
  t.after(() => client.close())

  const pages = envelopeOf(await client.call('paginate', { url: site.base + '/page/1', max_pages: 5 }))
  assert.equal(pages.ok, true)
  assert.equal(pages.data.pages.length, 3, '应跟随 rel=next 翻到第 3 页')
  assert.equal(pages.data.pages[2].next, null)

  const submitted = envelopeOf(await client.call('fill_form', {
    url: site.base + '/form',
    fields: { q: 'hello' },
  }))
  assert.equal(submitted.ok, true)
  assert.equal(submitted.data.status, 200)
  assert.match(JSON.stringify(submitted.data.html), /submitted ok/)

  // 上游语义：octet-stream 走 download 会显式 UNSUPPORTED（不是静默成功）。
  const downloaded = envelopeOf(await client.call('download', { url: site.base + '/file.bin' }))
  assert.equal(downloaded.code, 'UNSUPPORTED')
  assert.equal(downloaded.meta?.actionable?.reason, 'content-not-text')
  assert.ok(Array.isArray(downloaded.meta?.actionable?.next_steps))

  const robots = envelopeOf(await client.call('robots', { url: site.base + '/page/1' }))
  assert.equal(robots.ok, true)
  assert.equal(robots.data.available, true)
  assert.ok(robots.data.rules.wildcard.rules.some((rule) => rule[1] === '/private'))
  assert.ok(robots.data.rules.sitemaps.length >= 1)
})

test('真实 A 批：信封故障码 TIMEOUT / LIMIT 与导出确认 BLOCKED', { skip }, async (t) => {
  const site = await startFixtureSite()
  t.after(() => site.close())
  const state = await mkdtemp(join(tmpdir(), 'dsh-webctl-cookie-'))
  t.after(() => rm(state, { recursive: true, force: true }))
  const client = new McpClient(BIN, { env: { ...process.env, WEBCTL_STATE_DIR: state } })
  await client.start()
  t.after(() => client.close())

  const timeout = envelopeOf(await client.call('fetch', { url: site.base + '/slow', timeout_ms: 500 }))
  assert.equal(timeout.ok, false)
  assert.equal(timeout.code, 'TIMEOUT')

  const limited = envelopeOf(await client.call('fetch', { url: site.base + '/big', max_bytes: 100 }))
  assert.equal(limited.code, 'LIMIT')
  assert.equal(limited.data.content.truncated, true)

  // cookies 需要会话目录存在；先保存默认会话再导出。
  const saved = envelopeOf(await client.call('session', { action: 'save', name: 'default' }))
  assert.equal(saved.ok, true)
  const view = envelopeOf(await client.call('cookies', { action: 'view' }))
  assert.equal(view.ok, true)
  assert.equal(view.data.count, 0)
  assert.equal(JSON.stringify(view.data).includes('SUPERSECRET'), false, '查看结果不应出现 cookie 值')

  const denied = envelopeOf(await client.call('cookies', { action: 'export' }))
  assert.equal(denied.ok, false)
  assert.equal(denied.code, 'BLOCKED', '导出必须显式确认')

  const exported = envelopeOf(await client.call('cookies', { action: 'export', yes: true }))
  assert.equal(exported.ok, true)
  assert.equal(exported.data.values, '<redacted-in-response>', '响应里的值必须脱敏')
  assert.equal(typeof exported.data.saved_to, 'string')
  const info = await stat(exported.data.saved_to)
  assert.equal(info.mode & 0o777, 0o600, '导出文件应为 0600')
  const fileText = await readFile(exported.data.saved_to, 'utf8')
  const parsed = JSON.parse(fileText)
  assert.equal(parsed.version, 1)
  assert.equal(Array.isArray(parsed.cookies), true)
})
