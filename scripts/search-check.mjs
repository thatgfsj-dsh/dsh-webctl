/**
 * 低频联网自检（#10）：对 web_search 的真实引擎做少量请求，只输出统计与字段名，不落任何结果内容。
 *
 * 设计约束（对齐 webctl ADR-0008）：真站数据不入库；本脚本不写文件、不打印 URL/标题/snippet。
 *
 * 用法：node scripts/search-check.mjs --webctl /path/to/webctl --query "..." --engines bing,baidu,360 --pause 6000
 * 退出码：0 完成；1 失败；2 跳过（缺 webctl）。
 */
import { spawn, spawnSync } from 'node:child_process'
import { isAbsolute } from 'node:path'

/**
 * 解析参数。
 * @param {string[]} argv - 参数。
 * @returns {{webctl: string, query: string, engines: string[], pauseMs: number}} 选项。
 */
function parseArgs(argv) {
  const options = { webctl: 'webctl', query: 'webctl 网页抓取 工具', engines: ['bing', 'baidu', '360'], pauseMs: 6000 }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const value = argv[index + 1]
    if (arg === '--webctl' && value !== undefined) { options.webctl = value; index += 1 }
    else if (arg === '--query' && value !== undefined) { options.query = value; index += 1 }
    else if (arg === '--engines' && value !== undefined) { options.engines = value.split(',').map((item) => item.trim()).filter(Boolean); index += 1 }
    else if (arg === '--pause' && value !== undefined) { options.pauseMs = Number(value); index += 1 }
  }
  return options
}

/**
 * 主流程。
 * @returns {Promise<number>} 退出码。
 */
async function main() {
  const options = parseArgs(process.argv.slice(2))
  const webctlPath = isAbsolute(options.webctl) ? options.webctl : (spawnSync('which', [options.webctl], { encoding: 'utf8' }).stdout || '').trim()
  if (webctlPath === '') {
    process.stdout.write('[search] 跳过：找不到 webctl\n')
    return 2
  }
  process.stdout.write('[search] 使用 ' + webctlPath + '，查询词长度 ' + String(options.query.length) + '\n')

  const child = spawn(webctlPath, ['mcp'], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
  let buffer = ''
  const pending = new Map()
  let nextId = 1
  child.stdout.on('data', (chunk) => {
    buffer += chunk.toString('utf8')
    for (;;) {
      const index = buffer.indexOf('\n')
      if (index < 0) break
      const line = buffer.slice(0, index).trim()
      buffer = buffer.slice(index + 1)
      if (line === '') continue
      let message
      try { message = JSON.parse(line) } catch { continue }
      const callback = pending.get(message.id)
      if (callback !== undefined) { pending.delete(message.id); callback(message) }
    }
  })
  const request = (method, params) => new Promise((resolve, reject) => {
    const id = nextId
    nextId += 1
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('MCP 超时：' + method)) }, 90000)
    pending.set(id, (message) => {
      clearTimeout(timer)
      if (message.error !== undefined) reject(new Error(JSON.stringify(message.error)))
      else resolve(message.result)
    })
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
  })

  try {
    await request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'dsh-webctl-search-check', version: '0.0.0' } })
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n')

    for (const engine of options.engines) {
      const result = await request('tools/call', {
        name: 'web_search',
        arguments: { query: options.query, engines: [engine], max_results: 5, page: 1 },
      })
      const text = (result.content ?? []).filter((item) => item.type === 'text').map((item) => item.text).join('')
      let envelope = null
      try { envelope = JSON.parse(text) } catch { envelope = null }
      if (envelope === null) {
        process.stdout.write('[' + engine + '] 非 JSON 响应（长度 ' + String(text.length) + '）\n')
      } else {
        const data = envelope.data ?? {}
        const results = Array.isArray(data.results) ? data.results : []
        const engineStatus = Array.isArray(data.engines) ? data.engines.map((item) => item.engine + ':' + item.state) : []
        const keys = Object.keys(data).sort().join(',')
        process.stdout.write('[' + engine + '] code=' + String(envelope.code) + ' ok=' + String(envelope.ok) + ' results=' + String(results.length) + ' engines=' + engineStatus.join('|') + ' dataKeys=' + keys + '\n')
        process.stdout.write('         actionable=' + JSON.stringify(envelope.meta?.actionable ?? null).slice(0, 200) + '\n')
      }
      await new Promise((resolve) => setTimeout(resolve, options.pauseMs))
    }
    return 0
  } finally {
    child.kill('SIGKILL')
  }
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    process.stderr.write('[search] 失败：' + (error instanceof Error ? error.message : String(error)) + '\n')
    process.exit(1)
  })
