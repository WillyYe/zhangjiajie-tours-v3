// 预览锚点完备性验证器（Loop 工程：自动门槛，替代人工校验）
// 读取各模块字段声明中的 pv:{mode,anchor}，核对每个 anchor 是否真实存在于对应渲染器源码中
// （卡片 DOM 的 id:'x'、iframe 模板的 id="x"、以及逐条动态 id="x-${i}" 的 x- 前缀）。
// 零依赖、零网络、零 PAT，可直接 `node tests/preview-anchor-test.mjs` 运行。
import { readFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;

// 每个模块：
//   declFiles = 含 pv 字段声明的源文件（可多个，例如 schema 抽到独立文件）
//   renderers = 产出预览锚点的源码（可多个：模块自身 + 渲染 helper + 模板）
const MODULES = [
  {
    name: 'hotels',
    declFiles: [ROOT + 'admin/modules/hotels.js'],
    renderers: [ROOT + 'admin/modules/hotels.js', ROOT + 'templates/hotel-detail.html'],
  },
  {
    name: 'tours',
    declFiles: [ROOT + 'admin/modules/tours.js'],
    renderers: [ROOT + 'admin/modules/tours.js', ROOT + 'admin/modules/tours-render.js', ROOT + 'templates/tour-detail.html'],
  },
  {
    name: 'topAttractions',
    declFiles: [ROOT + 'admin/modules/top-attractions.js'],
    renderers: [ROOT + 'admin/modules/top-attractions.js', ROOT + 'admin/modules/top-attractions-render.js'],
  },
  {
    name: 'attractions',
    declFiles: [ROOT + 'admin/modules/spot-core.js', ROOT + 'admin/modules/spot-refs.js'],
    renderers: [ROOT + 'admin/modules/spot-core.js', ROOT + 'templates/attraction-page.html', ROOT + 'templates/experience-page.html'],
  },
  {
    name: 'experiences',
    declFiles: [ROOT + 'admin/modules/spot-core.js', ROOT + 'admin/modules/spot-refs.js'],
    renderers: [ROOT + 'admin/modules/spot-core.js', ROOT + 'templates/attraction-page.html', ROOT + 'templates/experience-page.html'],
  },
  {
    name: 'homeTourCards',
    declFiles: [ROOT + 'admin/modules/home-tour-cards.js'],
    renderers: [ROOT + 'admin/modules/home-tour-cards.js', ROOT + 'admin/modules/home-tour-cards-render.js'],
  },
];

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// 提取声明文件中的 pv 声明；支持静态 anchor:'x' 与动态 anchor:'x-' + expr（expr 可含 .字段）
function extractPv(src) {
  const out = [];
  // 注意：动态锚点的表达式可能是 `it.slug` / `it.id` / `i` / `it.id + '-card'`，
  // 故用 [^}]+（不含右花括号）吞掉整个 `+ 表达式`，避免被 .slug 这种后缀截断。
  const re = /pv:\s*\{\s*mode:\s*['"]([^'"]+)['"]\s*,\s*anchor:\s*['"]([A-Za-z0-9_/-]+)['"](\s*\+\s*[^}]+)?\s*\}/g;
  let m;
  while ((m = re.exec(src))) {
    const [, mode, anchor, dyn] = m;
    out.push({ mode, anchor, dynamic: !!dyn });
  }
  return out;
}

// 在渲染器源码中确认锚点存在：静态精确匹配，或动态前缀匹配（id="pre-" / id:'pre-'）
function anchorExists(rendererSrc, anchor, dynamic) {
  if (!dynamic) {
    const exact = new RegExp('id\\s*[:=]\\s*["\']' + escRe(anchor) + '["\']', 'm');
    if (exact.test(rendererSrc)) return true;
  } else {
    // 动态锚点：源码形如 id="room-${i}" 或 id="tour-${c.id}-card"，前缀为 anchor（含结尾 '-'）
    const pre = new RegExp('id\\s*[:=]\\s*["\']' + escRe(anchor), 'm');
    if (pre.test(rendererSrc)) return true;
  }
  return false;
}

let failures = 0;
const lines = [];
for (const mod of MODULES) {
  let declSrc = '';
  for (const p of mod.declFiles) {
    try {
      declSrc += '\n' + readFileSync(p, 'utf8');
    } catch (e) {
      lines.push(`✗ [${mod.name}] 无法读取声明文件: ${p}`);
      failures++;
    }
  }
  const rendererSrcs = mod.renderers.map((p) => {
    try { return readFileSync(p, 'utf8'); } catch { return ''; }
  });
  const pvs = extractPv(declSrc);
  if (!pvs.length) {
    lines.push(`· [${mod.name}] 未发现 pv 声明（跳过）`);
    continue;
  }
  for (const { mode, anchor, dynamic } of pvs) {
    const found = rendererSrcs.some((rs) => anchorExists(rs, anchor, dynamic));
    const tag = dynamic ? `${anchor}<i>` : anchor;
    if (found) {
      lines.push(`  ✓ [${mod.name}] ${mode} → ${tag}`);
    } else {
      lines.push(`  ✗ [${mod.name}] ${mode} → ${tag}  未在渲染器中找到对应 id`);
      failures++;
    }
  }
}

console.log('预览锚点完备性验证');
console.log('='.repeat(48));
for (const l of lines) console.log(l);
console.log('='.repeat(48));
if (failures) {
  console.log(`结果：FAIL（${failures} 处锚点缺失）`);
  process.exit(1);
} else {
  console.log('结果：PASS（所有 pv 声明的锚点均已落地）');
}
