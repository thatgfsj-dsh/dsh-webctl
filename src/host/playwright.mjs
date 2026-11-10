/**
 * Playwright 环境探测（回退通道，不是 webctl 的依赖）。
 *
 * 默认只做被动检查：找已安装的 playwright 包与浏览器缓存目录，不执行用户代码、
 * 不下载浏览器、不启动浏览器。启动冒烟必须由配置显式开启。
 *
 * 本文件在后续 PR 补齐检测逻辑；当前为占位实现，返回 not-checked 状态。
 */

/**
 * 探测 Playwright 环境。
 * @param {object} options - 选项。
 * @param {NodeJS.ProcessEnv} [options.env] - 环境变量。
 * @param {string[]} [options.searchDirs] - 额外搜索目录。
 * @param {boolean} [options.launchSmoke] - 是否做启动冒烟（默认 false）。
 * @returns {Promise<object>} 探测结果。
 */
export async function probePlaywright(options = {}) {
  const env = options.env ?? process.env
  const declared = parseFallbackDeclaration(env.WEBCTL_FALLBACK_TOOL)
  return {
    state: 'not-checked',
    package: { found: false, name: null, version: null, path: null, searchedDirs: [] },
    browsers: { path: null, exists: false, entries: [] },
    fallback: { declaredInEnv: declared !== null, toolName: declared?.toolName ?? null },
    launchSmoke: { enabled: options.launchSmoke === true, tested: false, ok: null, error: null },
    error: null,
  }
}

/**
 * 解析 WEBCTL_FALLBACK_TOOL=<名字>:<工具名>。
 * @param {string|undefined} value - 环境变量值。
 * @returns {{name: string, toolName: string}|null} 解析结果。
 */
export function parseFallbackDeclaration(value) {
  if (typeof value !== 'string' || value.trim() === '') return null
  const index = value.indexOf(':')
  if (index <= 0 || index === value.length - 1) return null
  return { name: value.slice(0, index), toolName: value.slice(index + 1) }
}
