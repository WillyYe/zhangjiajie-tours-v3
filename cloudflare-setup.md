# Cloudflare 接入指南 — zhangjiajie-tours-v3 (v3)

> v3 当前部署在 GitHub Pages 项目页 `https://willyye.github.io/zhangjiajie-tours-v3/`（尚未绑定自定义域；主站 `visitzhangjiajie.com` 仍由旧仓库占用）。
> 若未来让 v3 接管 `visitzhangjiajie.com`，先在 GitHub Pages 设置里把自定义域改到本仓库，再按下方步骤接入 Cloudflare。
> 本文由 myguilin 的接入指南复制并适配。

---


> 目的：① 解决 GitHub Pages 不读取 `_headers` 导致的安全响应头 / 缓存头不生效；② 用 Cloudflare 全球 CDN 让国内 / 海外访问都更稳更快。
> 方案：**保留 GitHub Pages 托管**，仅把 Cloudflare 作为反向代理（DNS 橙色云），不改托管、不动构建流程。

---

## 0. 前提与现状

| 项 | 现状 |
|----|------|
| 托管 | GitHub Pages（`WillyYe/zhangjiajie-tours-v3`，自定义域 `willyye.github.io/zhangjiajie-tours-v3`） |
| 当前 DNS | NS = `dns23/24.hichina.com`（阿里云万网） |
| 当前解析 | 根域 / www 直连 GitHub Pages `185.199.x.x` |
| `_headers` | ❌ 死配置（GitHub Pages 不读它，仅 Netlify / Cloudflare **Pages** 读） |

结论：安全头 / 缓存头**当前一个都没生效**，必须由 Cloudflare 在边缘补上。

---

## 1. 改 NS（只能你在域名注册商操作）

1. 注册 Cloudflare 账号 → **Add a Site** → 输入 `willyye.github.io/zhangjiajie-tours-v3` → 选 **Free** 计划。
2. Cloudflare 扫描后会给 **2 个 NS**（形如 `xxx.ns.cloudflare.com` / `yyy.ns.cloudflare.com`）。
3. 去 **阿里云（万网）控制台 → 域名 → willyye.github.io/zhangjiajie-tours-v3 → DNS 修改 / 修改 DNS 服务器**，把原来的 `dns23/24.hichina.com` 换成 Cloudflare 给的 2 个 NS。
4. 等待 NS 全球生效（通常 5 分钟～24 小时，阿里云一般较快）。在 Cloudflare 仪表盘看到站点状态变 **Active** 即可。

⚠️ 改 NS 后，**阿里云那边的 A/CNAME 解析记录会被 Cloudflare 接管**，下面第 2 步重新在 Cloudflare 配。GitHub Pages 的 `CNAME` 文件（仓库里已存在）保持不动。

---

## 2. DNS 记录（Cloudflare 控制台 → DNS）

| 类型 | 名称 | 目标 | 代理状态 |
|------|------|------|----------|
| CNAME | `willyye.github.io/zhangjiajie-tours-v3` | `willyye.github.io` | 🟠 橙色云（代理） |
| CNAME | `www` | `willyye.github.io` | 🟠 橙色云（代理） |

- 根域用 CNAME + Cloudflare **CNAME 扁平化（CNAME Flattening）** 自动处理（免费支持），无需 A 记录。
- 两个都开橙色云（Proxy），这样安全头 / 缓存 / CDN 才生效。
- 确认 GitHub Pages 设置里自定义域仍是 `willyye.github.io/zhangjiajie-tours-v3`（CNAME 文件已保证）。

---

## 3. SSL/TLS（控制台 → SSL/TLS）

- **Overview → 加密模式**：选 **Full (strict)**（GitHub Pages 对自定义域有有效证书，strict 最安全）。
- **Edge Certificates**：
  - ✅ **Always Use HTTPS**（自动跳 https）
  - **Minimum TLS Version**：1.2
  - （可选）**HTTP Strict Transport Security (HSTS)**：开启 `includeSubDomains`；`preload` 慎开（一旦提交到预加载列表很难撤销）。
- **Automatic HTTPS Rewrites**：开启。

---

## 4. 速度（控制台 → Speed → Optimization）

- ✅ **Brotli**（压缩传输，省流量、提速）
- Auto Minify 的 CSS/JS/HTML：**保持关闭**（我们构建时已用 Tailwind `--minify` 压过，重复压缩无意义且可能引入风险）。

---

## 5. 安全响应头（核心 — 替代失效的 `_headers`）

Cloudflare 免费版在 **Rules → Transform Rules → Modify Response Header** 即可添加（免费配额有限，足够本站点用；若控制台显示该功能在你的套餐被锁，用文末 **§7 Worker 兜底**）。

新建一条规则（或分多条），动作选 **Set / Add** 响应头：

| 头 | 值 |
|----|----|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `geolocation=(), microphone=(), camera=()` |

> 作用域：默认应用到所有响应（含 HTML / 静态资源），无需按路径拆分。

### ⚠️ Content-Security-Policy（CSP）— 必须分阶段，别直接上

本站点 `index.html` 含**两处内联脚本**（1027 行应用 JS、269 行 JSON-LD）。严格 CSP 会直接挡掉它们、搞挂整站。正确姿势：

1. **阶段一（观察）**：先加 `Content-Security-Policy-Report-Only` 头，值如：
   ```
   default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline';
   script-src 'self' 'unsafe-inline'; font-src 'self'; object-src 'none';
   base-uri 'self'; frame-ancestors 'none'
   ```
   只报告不拦截，确认无违规后再进入阶段二。
2. **阶段二（强制）**：确认报告干净后，把头名改为 `Content-Security-Policy` 正式生效。
   （`script-src` 含 `'unsafe-inline'` 是因为站内联脚本；后续若把内联 JS 抽成 `js/app.js` 并加 nonce，可进一步收紧。）

---

## 6. 静态资源缓存（控制台 → Rules → Cache Rules）

新建一条 **Cache Rule**：

- **匹配条件**：URI Path 匹配 `*webp` 或 `*jpg` 或 `*png` 或 `*svg` 或 `*woff2` 或 `*woff` 或 `*css` 或 `*js`
- **设置**：
  - **Edge Cache TTL**：1 month（边缘缓存 30 天）
  - **Browser Cache TTL**：1 month（浏览器缓存 30 天）
  - （可选）**Add Cache-Control header**：`public, max-age=2592000, immutable`

> ⚠️ 因为文件名未做内容哈希，长缓存意味着更新图片 / 字体后**访客短期看不到新版**。解决办法：每次内容更新后在 Cloudflare **Caching → Configuration → Purge Everything**（或按 URL 单清）。本站点更新频率低，30 天缓存收益远大于风险。

---

## 7. Worker 兜底（若 Transform Rules 在免费版被锁）

在 **Workers & Pages → Create Worker**，粘贴：

```js
export default {
  async fetch(request) {
    const res = await fetch(request);
    const h = new Headers(res.headers);
    h.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
    h.set("X-Content-Type-Options", "nosniff");
    h.set("X-Frame-Options", "DENY");
    h.set("Referrer-Policy", "strict-origin-when-cross-origin");
    h.set("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
    return new Response(res.body, { ...res, headers: h });
  }
}
```

再把该 Worker **Routes** 绑定到 `willyye.github.io/zhangjiajie-tours-v3/*` 与 `www.willyye.github.io/zhangjiajie-tours-v3/*`（免费额度 10 万次/天，足够）。

---

## 8. 验证（接入完成后）

```bash
node scripts/verify-cloudflare.mjs
```

脚本会检查：首页的 5 个安全头是否到位、静态资源（webp / woff2 / css）是否带长缓存。全部 ✅ 即接入成功。

也可用浏览器 DevTools → Network 看响应头，或：

```bash
curl -sI https://willyye.github.io/zhangjiajie-tours-v3/ | grep -iE 'strict-transport|x-content|frame|referrer|permissions'
```

---

## 9. 接入后建议

1. **重新跑一次 CI**，对比 Lighthouse 海外 LCP 基线（Cloudflare 边缘缓存会让复访 / 静态资源更快）。
2. 国内访问：Cloudflare 免费版**没有中国节点**（中国节点是企业版），但相比直连 GitHub Pages 的 `185.199.x.x`（国内常被墙 / 不稳），Cloudflare 任意播 + 国内 BGP 穿透通常明显更稳。若国内体验仍不达标，再考虑 Cloudflare 中国合作节点或国内 CDN。
3. 删除仓库里已失效的 `_headers`（见 commit 备注），避免再次误以为是生效配置。
