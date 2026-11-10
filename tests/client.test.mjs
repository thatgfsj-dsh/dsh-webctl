/**
 * 客户端 bundle 测试：生成物与源码同步、包声明一致、不引入宿主内部包、locale 元数据齐全。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildClient } from '../scripts/build-client.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

/**
 * 读取仓库内文本文件。
 * @param {string} relative - 相对路径。
 * @returns {Promise<string>} 内容。
 */
const read = (relative) => readFile(join(ROOT, relative), 'utf8')

test('client.js 与 src/client 源码同步', async () => {
  const built = await buildClient()
  const current = await read('client.js')
  assert.equal(current, built, 'client.js 过期：运行 node scripts/build-client.mjs')
})

test('client.js 注册 settings.section，且 id 与包名一致', async () => {
  const client = await read('client.js')
  assert.match(client, /window\.__ModuleLoader__\.load\(/)
  assert.match(client, /id: 'dsh-webctl'/)
  assert.match(client, /'settings\.section'/)
})

test('客户端 bundle 不引用任何 @deepseek-ai 包（避免静默加载失败）', async () => {
  const client = await read('client.js')
  assert.equal(client.includes("require('@deepseek-ai/"), false, '客户端不得 require 宿主内部包')
  assert.equal(client.includes('require("@deepseek-ai/'), false, '客户端不得 require 宿主内部包')
})

test('package.json 的 dsh.client 与 exports 覆盖展示资源', async () => {
  const pkg = JSON.parse(await read('package.json'))
  assert.equal(pkg.dsh.client.platform, 'web')
  assert.equal(pkg.exports['./client'], './client.js')
  assert.equal(pkg.exports['./package.json'], './package.json')
  assert.equal(pkg.exports['./locale/*.json'], './locale/*.json')
  assert.equal(typeof pkg.icon, 'string')
  assert.match(pkg.engines.dsh, /0\.2\./)
})

test('locale 提供 meta.title 与 meta.description', async () => {
  for (const language of ['zh', 'en']) {
    const locale = JSON.parse(await read('locale/' + language + '.json'))
    assert.equal(typeof locale.meta.title, 'string')
    assert.ok(locale.meta.title.length > 0)
    assert.equal(typeof locale.meta.description, 'string')
  }
})

test('图标是包内 SVG 且体积在宿主上限内', async () => {
  const icon = await read('icon.svg')
  assert.match(icon, /<svg/)
  assert.ok(Buffer.byteLength(icon) < 256 * 1024)
})