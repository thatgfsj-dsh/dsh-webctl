/**
 * 设置页状态面板（占位）：完整面板在后续 PR 提供。
 *
 * 保留同名组件，使 scripts/build-client.mjs 的部件顺序稳定、client.js 始终可构建。
 */

/**
 * 渲染占位提示。
 * @param {{t: (key: string, params?: object) => string}} props - 翻译函数。
 * @returns {object} 元素。
 */
function WebctlSettingsSection({ t }) {
  return h('div', null, t('settings.loading'))
}
