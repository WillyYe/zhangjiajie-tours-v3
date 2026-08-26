// spot-refs.js — 景点 / 体验详情页的纯数据层（无浏览器依赖）
//
// 把 spot-core 的 SCHEMA 与「图片引用检查」抽到这里，达成两个目的：
//   1. spot-core.js 与单测 tests/spot-imglib-delete-loop.mjs 共用同一份 SCHEMA 与检查逻辑（单一真源）。
//   2. 本文件零浏览器依赖（不 import github.js / DOM），可在 Node 下直接 import 跑单测。
//
// 图片库删除前的「引用检查」是防破图的主防线：删除某张 webp 前，扫描整个模块所有景点/体验的
// 所有 type:'image' 字段（heroImg / heroBgImg / highlights[].img / gallery[].img / related[].img），
// 若被任一字段引用则拦截删除并点名引用方。schema 驱动 → 未来 SCHEMA 新增图片字段会自动纳入检查。

// ---------- 字段骨架（attractions 与 experiences 共用）----------
// type: text | textarea | image | checkbox | json | list | object
export const SCHEMA = [
  { key: 'file', label: '文件名 file', type: 'text', tip: '生成页面的文件名，一般不动' },
  { key: 'slug', label: 'Slug（URL 路径）', type: 'text', tip: '地址栏路径，谨慎修改' },
  { key: 'title', label: 'SEO 标题 title', type: 'text', tip: '浏览器标签 / 分享卡片标题' },
  { key: 'metaDesc', label: 'Meta Description', type: 'textarea', tip: '搜索摘要，150 字内' },
  { key: 'canonical', label: 'Canonical URL', type: 'text', tip: '规范链接，一般不动' },
  { key: 'breadcrumb', label: '面包屑 breadcrumb', type: 'text', pv: { mode: 'detail', anchor: 'hero' } },
  { key: 'h1', label: 'H1 主标题', type: 'text', pv: { mode: 'detail', anchor: 'hero' } },
  { key: 'subtitle', label: '副标题 subtitle', type: 'text', pv: { mode: 'detail', anchor: 'hero' } },
  { key: 'heroImg', label: 'Hero 主图', type: 'image', tip: '根目录 images/<name>.webp', pv: { mode: 'detail', anchor: 'heroImg' } },
  { key: 'heroImgAlt', label: 'Hero Alt', type: 'text', pv: { mode: 'detail', anchor: 'heroImg' } },
  { key: 'heroBgImg', label: 'Hero 背景图', type: 'image', pv: { mode: 'detail', anchor: 'hero' } },
  { key: 'heroIntro', label: 'Hero 导语', type: 'textarea', pv: { mode: 'detail', anchor: 'hero' } },
  { key: 'tldr', label: '摘要 TL;DR', type: 'textarea', pv: { mode: 'detail', anchor: 'tldr' } },
  { key: 'introH2', label: '导语 H2', type: 'text', pv: { mode: 'detail', anchor: 'intro' } },
  { key: 'introParas', label: '导语段落', type: 'list', of: { type: 'textarea' }, tip: '多条段落', pv: { mode: 'detail', anchor: 'intro' } },
  { key: 'highlightsIntro', label: '亮点导语', type: 'text', pv: { mode: 'detail', anchor: 'highlights' } },
  { key: 'highlights', label: '亮点 Highlights', type: 'list', pv: { mode: 'detail', anchor: 'highlights' }, of: { type: 'object', fields: [
    { key: 'img', label: '图片', type: 'image' },
    { key: 'alt', label: 'Alt', type: 'text' },
    { key: 'title', label: '标题', type: 'text' },
    { key: 'sub', label: '副标', type: 'text' },
    { key: 'desc', label: '描述', type: 'textarea' },
  ] } },
  { key: 'routesIntro', label: '路线导语', type: 'text', pv: { mode: 'detail', anchor: 'routes' } },
  { key: 'routes', label: '路线 Routes', type: 'list', pv: { mode: 'detail', anchor: 'routes' }, of: { type: 'object', fields: [
    { key: 'icon', label: '图标', type: 'text' },
    { key: 'title', label: '标题', type: 'text' },
    { key: 'sub', label: '副标', type: 'text' },
    { key: 'steps', label: '步骤', type: 'list', of: { type: 'object', fields: [
      { key: 'strong', label: '强调', type: 'text' },
      { key: 'text', label: '说明', type: 'textarea' },
    ] } },
  ] } },
  { key: 'bestTime', label: '最佳时间 Best Time', type: 'object', pv: { mode: 'detail', anchor: 'best-time' }, fields: [
    { key: 'cards', label: '时间卡片', type: 'list', of: { type: 'object', fields: [
      { key: 'icon', label: '图标', type: 'text' },
      { key: 'period', label: '时段', type: 'text' },
      { key: 'desc', label: '说明', type: 'textarea' },
    ] } },
    { key: 'note', label: '备注', type: 'textarea' },
  ] },
  { key: 'tips', label: '贴士 Tips', type: 'list', pv: { mode: 'detail', anchor: 'tips' }, of: { type: 'object', fields: [
    { key: 'icon', label: '图标', type: 'text' },
    { key: 'title', label: '标题', type: 'text' },
    { key: 'desc', label: '描述', type: 'textarea' },
  ] } },
  { key: 'gettingThere', label: '到达方式', type: 'list', pv: { mode: 'detail', anchor: 'getting-there' }, of: { type: 'object', fields: [
    { key: 'strong', label: '强调', type: 'text' },
    { key: 'text', label: '说明', type: 'textarea' },
  ] } },
  { key: 'tickets', label: '票务 Tickets', type: 'list', pv: { mode: 'detail', anchor: 'tickets' }, of: { type: 'object', fields: [
    { key: 'item', label: '项目', type: 'text' },
    { key: 'detail', label: '说明', type: 'textarea' },
  ] } },
  { key: 'facts', label: '事实 Facts', type: 'list', pv: { mode: 'detail', anchor: 'facts' }, of: { type: 'object', fields: [
    { key: 'label', label: '标签', type: 'text' },
    { key: 'value', label: '值', type: 'text' },
  ] } },
  { key: 'localTip', label: '本地贴士', type: 'textarea', pv: { mode: 'detail', anchor: 'local-tip' } },
  { key: 'galleryTitle', label: '画廊标题', type: 'text', pv: { mode: 'detail', anchor: 'gallery' } },
  { key: 'gallery', label: '画廊 Gallery', type: 'list', pv: { mode: 'detail', anchor: 'gallery' }, of: { type: 'object', fields: [
    { key: 'img', label: '图片', type: 'image' },
    { key: 'alt', label: 'Alt', type: 'text' },
  ] } },
  { key: 'faqs', label: 'FAQ', type: 'list', pv: { mode: 'detail', anchor: 'faq' }, of: { type: 'object', fields: [
    { key: 'q', label: '问题', type: 'textarea' },
    { key: 'a', label: '答案', type: 'textarea' },
  ] } },
  { key: 'related', label: '相关推荐 Related', type: 'list', pv: { mode: 'detail', anchor: 'related' }, of: { type: 'object', fields: [
    { key: 'slug', label: 'Slug', type: 'text' },
    { key: 'img', label: '图片', type: 'image' },
    { key: 'alt', label: 'Alt', type: 'text' },
    { key: 'title', label: '标题', type: 'text' },
    { key: 'sub', label: '副标', type: 'text' },
  ] } },
  { key: 'geo', label: '地理坐标 Geo', type: 'object', fields: [
    { key: 'lat', label: '纬度 lat', type: 'text' },
    { key: 'lng', label: '经度 lng', type: 'text' },
  ] },
  { key: 'jsonld', label: '结构化数据 JSON-LD', type: 'json', tip: '机器可读 SEO 数据，谨慎修改' },
  { key: 'hidden', label: '隐藏（前台不生成该详情页）', type: 'checkbox', tip: '勾选后前台不生成、相关推荐也过滤掉它' },
];

const EXT_RE = /\.(webp|jpg|jpeg|avif|png)$/i;
function normImage(s) {
  return String(s == null ? '' : s).replace(EXT_RE, '');
}

// 纯函数：按 schema 递归收集某对象所有 type:'image' 字段的 { path, value }
// 支持 object（fields 嵌套）与 list（of: image | of: object）两种容器。
function collectImageFields(schema, obj, prefix) {
  const out = [];
  if (!Array.isArray(schema) || !obj || typeof obj !== 'object') return out;
  for (const f of schema) {
    if (!f || !f.key) continue;
    const val = obj[f.key];
    if (f.type === 'image') {
      if (val) out.push({ path: prefix + f.key, value: val });
    } else if (f.type === 'object' && f.fields) {
      out.push(...collectImageFields(f.fields, val, prefix + f.key + '.'));
    } else if (f.type === 'list' && Array.isArray(val)) {
      const sub = f.of || {};
      val.forEach((item, i) => {
        if (sub.type === 'image') {
          if (item) out.push({ path: `${prefix}${f.key}[${i}]`, value: item });
        } else if (sub.type === 'object' && sub.fields) {
          out.push(...collectImageFields(sub.fields, item, `${prefix}${f.key}[${i}].`));
        }
      });
    }
  }
  return out;
}

// 纯函数：查找 name 被哪些 spot 的哪些图片字段引用（扩展名归一化，避免 heroImg 带 .webp 漏检）
// 返回示例：['天门山（heroImg）', '天门山（gallery[0].img）']
export function findSpotImageReferences(spots, name) {
  const target = normImage(name);
  if (!target) return [];
  const refs = [];
  for (const spot of spots || []) {
    if (!spot || typeof spot !== 'object') continue;
    const title = spot.h1 || spot.title || spot.slug || '(未命名)';
    for (const { path, value } of collectImageFields(SCHEMA, spot, '')) {
      if (normImage(value) === target) refs.push(`${title}（${path}）`);
    }
  }
  return refs;
}
