/**
 * HTTP 小工具：JSON 响应与错误归一化。状态接口只读，无需请求体解析。
 */

/** 响应头。 */
const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
}

/**
 * 构造 JSON 响应。
 * @param {number} status - HTTP 状态码。
 * @param {unknown} body - 可序列化对象。
 * @returns {Response} 响应。
 */
export function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })
}

/**
 * 读取查询参数。
 * @param {Request} request - 请求。
 * @param {string} name - 参数名。
 * @returns {string|undefined} 值。
 */
export function queryParam(request, name) {
  const value = new URL(request.url).searchParams.get(name)
  return value === null ? undefined : value
}

/**
 * 包装处理函数：异常也返回 JSON，不让宿主路由看到未捕获错误。
 * @param {(request: Request) => Promise<Response>} handler - 处理函数。
 * @returns {(request: Request) => Promise<Response>} 包装后的处理函数。
 */
export function withErrors(handler) {
  return async (request) => {
    try {
      return await handler(request)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return json(500, { ok: false, error: { code: 'INTERNAL', message } })
    }
  }
}
