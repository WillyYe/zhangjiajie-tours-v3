#!/usr/bin/env node
// Verify Cloudflare (or any edge) security + cache response headers for willyye.github.io/zhangjiajie-tours-v3.
// Usage: node scripts/verify-cloudflare.mjs  (override BASE_URL=https://willyye.github.io/zhangjiajie-tours-v3)

const BASE = (process.env.BASE_URL || "https://willyye.github.io/zhangjiajie-tours-v3").replace(/\/$/, "");

// Required security headers on the HTML response.
const REQUIRED_SECURITY = [
  "strict-transport-security",
  "x-content-type-options",
  "x-frame-options",
  "referrer-policy",
  "permissions-policy",
];

// Asset paths to spot-check caching. Adjust if filenames change.
const ASSETS = [
  "/images/attraction-elephant.webp",
  "/fonts/inter-latin-400-normal.woff2",
  "/tailwind.css",
];

const checks = [];
function add(name, ok, detail) {
  checks.push({ name, ok, detail });
}

async function head(path) {
  const res = await fetch(BASE + path, { redirect: "manual" });
  return res;
}

async function main() {
  console.log(`\n🌐 Verifying headers for: ${BASE}\n`);

  // 1) Homepage security headers
  let home;
  try {
    home = await head("/");
  } catch (e) {
    console.error(`❌ Cannot reach ${BASE} — is DNS/Cloudflare set up? (${e.message})`);
    process.exit(2);
  }
  const hdrs = {};
  for (const [k, v] of home.headers.entries()) hdrs[k.toLowerCase()] = v;

  for (const h of REQUIRED_SECURITY) {
    const present = h in hdrs;
    add(`security: ${h}`, present, present ? hdrs[h] : "(missing)");
  }
  // CSP is recommended but optional (staged) — warn only.
  add("security: content-security-policy (recommended)", "content-security-policy" in hdrs,
      hdrs["content-security-policy"] || "(missing — see cloudflare-setup.md §5)");

  // 2) Asset cache headers
  for (const a of ASSETS) {
    try {
      const r = await head(a);
      const cc = (r.headers.get("cache-control") || "").toLowerCase();
      const ok = cc.includes("max-age") && (cc.includes("immutable") || cc.includes("max-age=2592000") || cc.includes("max-age=31536000"));
      add(`cache: ${a}`, ok, r.headers.get("cache-control") || "(no cache-control)");
    } catch (e) {
      add(`cache: ${a}`, false, `fetch error: ${e.message}`);
    }
  }

  // 3) Report
  let pass = 0, fail = 0, warn = 0;
  for (const c of checks) {
    const tag = c.ok ? "✅" : (c.name.includes("(recommended)") ? "⚠️ " : "❌");
    if (c.ok) pass++;
    else if (c.name.includes("(recommended)")) warn++;
    else fail++;
    console.log(`${tag} ${c.name}`);
    console.log(`     ${c.detail}`);
  }

  console.log(`\n=== Summary: ${pass} pass, ${fail} fail, ${warn} warn ===\n`);
  if (fail > 0) {
    console.log("❌ Required headers missing — Cloudflare Transform Rules not applied yet,");
    console.log("   or DNS not proxied (orange cloud). See cloudflare-setup.md.\n");
    process.exit(1);
  }
  console.log("✅ All required security headers + asset caching are in place.\n");
  process.exit(0);
}

main();
