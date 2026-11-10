/**
 * 插件入口：注册 locale 词典与设置页分区。
 *
 * 本文件是 factory 的最后一段，返回插件对象；前面的部件共享同一作用域。
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
    }, () => h(WebctlSettingsSection, { t })))
  },
}