// 首页三大区块数据层（后台独立模块的数据源）
// 三个 export 块各自独立，保存时只重写被编辑的块（mjs.js rebuild 保证 diff 最小）。
// 约定：正文里的 *星号* 包住的文字渲染为 <em> 强调（与酒店模块一致）。

// ========== 首屏 Hero（后台 🖼 首屏 Hero 模块编辑） ==========
export const hero = {
  eyebrow: 'UNESCO World Heritage Site',
  h1Line1: 'Where Mountains',
  h1Line2: 'Float in the Clouds',
  desc: 'Discover the surreal sandstone peaks that inspired *Avatar*. Walk quiet streams beneath towering pillars, and see the real landscape behind the floating mountains — with local guides who know every trail.',
  // 背景图：仅限 images/hero/ 目录（hero 模块独立图库），不放根目录或其他模块
  bgImg: 'hero-tianzi-clouds',
};

// ========== 欢迎区 Welcome（后台 📝 欢迎区 模块，待建） ==========
export const welcome = {
  eyebrow: 'UNESCO World Heritage · Hunan Province, China',
  h2: 'Welcome to Zhangjiajie',
  paras: [
    'Zhangjiajie is a city in the mountains of Hunan Province, home to the *Wulingyuan Scenic Area* — a UNESCO World Heritage Site since 1992. More than *3,000 quartz-sandstone pillars* rise straight out of the mist here, many over 200 m tall. This is the real landscape behind the floating "Hallelujah Mountains" in the film *Avatar*.',
    "There's nowhere else quite like it. Ride the *world's longest cable car* up Tianmen Mountain (7.5 km), cross the *world's highest glass-bottom bridge* at Grand Canyon, or take the Bailong Elevator — the world's tallest outdoor lift — straight up a cliff face. Walk Golden Whip Stream where wild monkeys roam, and watch the peaks disappear into cloud at sunrise.",
    '*Why travel with us?* We\'re a Zhangjiajie-based team with English-speaking guides, hand-picked itineraries, and clear, upfront pricing — so you can enjoy the trip and leave the logistics to us. Whether it\'s a *private custom tour*, a small-group day trip, or a relaxed family visit, we shape it around *your* pace and interests.',
  ],
  stats: [
    { num: '3,000+', label: 'Sandstone Pillars' },
    { num: '7', label: 'Major Attractions' },
    { num: '54%', label: 'Overseas Market Share' },
    { num: '100K+', label: 'Guests / Year' },
  ],
  // 背景图：仅限 images/welcome/ 目录（welcome 模块独立图库）
  bgImg: 'intro-bg',
};

// ========== 顶部导航 Nav（后台 🧭 顶部导航 模块，待建） ==========
// items = 一级菜单；children = 二级子项（mega 下拉）。hidden=true 的菜单前台不渲染（用于无真实页面的占位）。
export const siteNav = {
  items: [
    { label: 'Home', url: 'index.html', hidden: false, children: [] },
    { label: 'Attractions', url: 'attractions/index.html', hidden: true, children: [
      { label: '🏞 Tianzi Mountain', url: 'attractions/tianzi.html' },
      { label: '🏞 Yuanjiajie', url: 'attractions/yuanjiajie.html' },
    ] },
    { label: 'Experiences', url: 'experiences/index.html', hidden: true, children: [] },
    { label: 'Tours', url: 'tours/index.html', hidden: true, children: [
      { label: '📅 Day Tours', url: '#tour-day' },
      { label: '🎒 Private Tours', url: '#tour-private-card' },
      { label: '💎 VIP Tours', url: '#tour-vip-card' },
    ] },
    { label: 'Hotels', url: 'hotels/mountain-lodges.html', hidden: false, children: [
      { label: '🏔️ Mountain Lodges', url: 'hotels/mountain-lodges.html' },
      { label: '⭐ Selected Stays', url: 'hotels/selected-stays.html' },
      { label: '💡 Value Hotels', url: 'hotels/value-hotels.html' },
      { label: '📍 By Area', url: 'hotels/by-area.html' },
    ] },
    { label: 'Contact Us', url: '#contact', hidden: false, children: [] },
  ],
};
