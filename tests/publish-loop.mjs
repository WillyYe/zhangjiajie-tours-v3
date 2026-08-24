// tests/publish-loop.mjs
//
// Verifier for "save-in-admin → production-shows-update" end-to-end loop.
//
// Bug class it guards:
//   后台修改 home-data.mjs（如 hero.bgImg）→ GitHub 写入成功 → 但前端的
//   index.html 仍显示旧值。 原因：.github/workflows/rebuild-hotels.yml 只监听
//   hotels-data.mjs，不监听 home-data.mjs，触发不到 build，index.html 不更新。
//
// Strategy: 用多组断言锁住该闭环：
//   ① 静态门禁：workflow 文件的 paths 必须覆盖所有 *-data.mjs 数据源
//      （hotels / home / attractions / experiences / food / tours / plan-guides /
//       module-index）—— 任一遗漏都会让该模块后台改了前台不变。
//   ② 静态门禁：workflow 必须调用全部 node scripts/build-*.mjs（单一
//      build-hotels.mjs 只覆盖 hotels + home，experiences/tours 等需各自脚本）。
//   ③ 静态门禁：commit 步骤必须 git add 全部产物目录 + index.html。
//   ④ 运行时实证：在 /tmp 副本里改 hero.bgImg → 跑 build → index.html url 必须
//      反映新值。这个是最关键的实证：证明 trigger → build 是真的能工作。
//
// Stop condition: 全部断言过 + 现有 home-loop/preview-loop 等不能退化。

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const WF = path.join(ROOT, '.github/workflows/rebuild-hotels.yml');

let passed = 0, failed = 0;
function ok(msg) { console.log('  \u2713', msg); passed++; }
function bad(msg) { console.error('  \u2717', msg); failed++; }

// ---- ① workflow 文件存在 ----
console.log('[1] workflow 文件存在性');
if (fs.existsSync(WF)) ok('.github/workflows/rebuild-hotels.yml 存在');
else bad('.github/workflows/rebuild-hotels.yml 缺失');

// ---- ② workflow paths 必须覆盖所有数据源 ----
console.log('\n[2] workflow paths 覆盖所有数据源');
const wfText = fs.readFileSync(WF, 'utf8');
// 抽出 paths: 列表里的所有 'xxx.mjs' 路径
const pathMatches = [...wfText.matchAll(/^\s*-\s*'([^']+\.mjs)'\s*$/gm)].map((m) => m[1]);
// 所有数据驱动模块的数据源（后台 admin/app.js 注册表可编辑的 + 其余数据文件）
const requiredDataFiles = [
  'hotels-data.mjs',
  'home-data.mjs',
  'attractions-data.mjs',
  'experiences-data.mjs',
  'food-data.mjs',
  'tours-data.mjs',
  'plan-guides-data.mjs',
  'module-index-data.mjs',
];
for (const df of requiredDataFiles) {
  if (pathMatches.includes(df)) ok(`paths 包含 ${df}`);
  else bad(`paths 缺少 ${df}（遗漏该模块会让后台改动无法触发重建）`);
}

// ---- ③ workflow 必须调全部 node scripts/build-*.mjs ----
console.log('\n[3] workflow 调用全部 build 命令');
const requiredBuilds = [
  'build-hotels.mjs',
  'build-attractions.mjs',
  'build-experiences.mjs',
  'build-food.mjs',
  'build-tours.mjs',
  'build-plan-guides.mjs',
  'build-module-index.mjs',
  'build-top-attractions.mjs',
];
for (const b of requiredBuilds) {
  if (new RegExp('node\\s+scripts/' + b).test(wfText)) ok(`包含 \`node scripts/${b}\``);
  else bad(`未调 \`node scripts/${b}\`（该模块前台不会随数据更新）`);
}

// ---- ④ workflow 提交时必须 add 全部产物目录 + index.html ----
console.log('\n[4] workflow commit 含全部产物目录 + index.html');
const requiredAdds = ['hotels/', 'attractions/', 'experiences/', 'food/', 'tours/', 'plan/', 'index.html'];
for (const a of requiredAdds) {
  if (wfText.includes('git add') && wfText.includes(a)) ok(`commit 步骤 git add 含 ${a}`);
  else bad(`commit 步骤未 add ${a}`);
}

// ---- ⑤ 运行时实证：home-data.mjs 改动 → build 后 index.html 真的更新 ----
console.log('\n[5] 运行时实证：home-data.mjs 改动 → index.html url 反映新值');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'publish-loop-'));
try {
  // 5a. 复制 home-data.mjs + index.html + scripts（最小验证集）
  //     这次验证只关注 hero 段能否被 build 写到 index.html，不用全量 build
  fs.cpSync(path.join(ROOT, 'home-data.mjs'), path.join(tmp, 'home-data.mjs'));
  fs.cpSync(path.join(ROOT, 'index.html'), path.join(tmp, 'index.html'));
  // 复制整棵 scripts/ 与 admin/modules/，使 build-home.mjs 的全部相对 import
  // （build-top-attractions.mjs、admin/modules/*.js）在 /tmp 副本里也能解析，
  // 否则会 ERR_MODULE_NOT_FOUND 导致验证器崩溃（Bug F）。
  fs.cpSync(path.join(ROOT, 'scripts'), path.join(tmp, 'scripts'), { recursive: true });
  fs.cpSync(path.join(ROOT, 'admin/modules'), path.join(tmp, 'admin/modules'), { recursive: true });

  // 5b. 直接调用 build-home.mjs 的 applyHome 函数（纯函数，零外部依赖）
  const { applyHome, buildHero } = await import(path.join(tmp, 'scripts/build-home.mjs'));
  const homeDataPath = path.join(tmp, 'home-data.mjs');
  const { hero } = await import(path.join(tmp, 'home-data.mjs'));
  // 把内存里的 hero.bgImg 改成测试值
  hero.bgImg = 'publish-loop-test-image';

  // 5c. 应用 build（同一命令 workflow 会跑的那一个，但走纯函数更直接、更稳）
  const originalIndex = fs.readFileSync(path.join(tmp, 'index.html'), 'utf8');
  const newIndex = applyHome(originalIndex, { hero });
  fs.writeFileSync(path.join(tmp, 'index.html'), newIndex, 'utf8');

  // 5d. 验证 index.html 的 url 真的反映了新值（最关键的实证）
  if (newIndex.includes(`images/hero/${hero.bgImg}.webp`)) {
    ok(`index.html url 已更新到 images/hero/${hero.bgImg}.webp`);
  } else {
    bad(`index.html url 未更新（应包含 images/hero/${hero.bgImg}.webp）`);
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

// ---- 总结 ----
console.log(`\n结果：${passed} 通过 / ${failed} 失败`);
process.exit(failed ? 1 : 0);
