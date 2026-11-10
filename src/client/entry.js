/**
 * 插件入口：注册 locale 词典与设置页分区。
 *
 * 本文件是 factory 的最后一段，返回插件对象；前面的部件共享同一作用域。
 * 完整状态面板在后续 PR 提供；这里先渲染占位文案，保证 slot 已接线、状态接口可用。
 */
return {
  inject: ['slots', 'locale'],
  apply(ctx) {
    ctx.effect(() => ctx.locale.register(NS, { zh: ZH, en: EN }), 'dsh-webctl: 设置页词典')
    const t = ctx.locale.bind(NS)

    ctx.slots.inject('settings.section', () => ctx.slots.register({
      name: 'settings.section',
      id: 'dsh-webctl',
      order: 70,
      locale: NS,
      label: () => t('settings.title'),
    }, () => h('div', null, t('settings.loading'))))
  },
}
