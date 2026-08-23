// 首页三大区块数据层（后台独立模块的数据源）
// 三个 export 块各自独立，保存时只重写被编辑的块（mjs.js rebuild 保证 diff 最小）。
// 约定：正文里的 *星号* 包住的文字渲染为 <em> 强调（与酒店模块一致）。

// ========== 首屏 Hero（后台 🖼 首屏 Hero 模块编辑） ==========
export const hero = {
  eyebrow: 'UNESCO World Heritage Site',
  h1Line1: 'Where Mountains',
  h1Line2: 'Float in the Clouds',
  desc: 'Discover the surreal sandstone peaks that inspired *Avatar*. Walk quiet streams beneath towering pillars, and see the real landscape behind the floating mountains — with local guides who know every trail.',
  bgImg: '20',
};

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

export const siteNav = {
  items: [
    { label: 'Home', url: 'index.html', hidden: false, children: [] },
    { label: 'Attractions', url: 'attractions/index.html', hidden: false, footerLabel: 'Attractions', children: [
      { label: 'Tianzi Mountain', url: 'attractions/tianzi.html' },
      { label: 'Golden Whip Stream', url: 'attractions/jinbian.html' },
      { label: 'Huangshizhai', url: 'attractions/huangshizhai.html' },
      { label: 'Tianmen Mountain', url: 'attractions/tianmen.html' },
      { label: 'Grand Canyon Glass Bridge', url: 'attractions/grand-canyon.html' },
      { label: 'Baofeng Lake', url: 'attractions/baofeng.html' },
      { label: 'Yellow Dragon Cave', url: 'attractions/yellow-dragon.html' },
      { label: 'Yuanjiajie (Avatar)', url: 'attractions/yuanjiajie.html' },
    ] },
    { label: 'Experiences', url: 'experiences/index.html', hidden: false, footerLabel: 'Experiences', children: [
      { label: 'Avatar & Bailong Elevator', url: 'experiences/avatar-bailong-elevator.html' },
      { label: 'Glass Bridge & Bungee', url: 'experiences/glass-bridge-bungee.html' },
      { label: 'Tianmen Mountain', url: 'experiences/tianmen-mountain.html' },
      { label: 'Helicopter Tour', url: 'experiences/helicopter-tour.html' },
      { label: 'Cultural Shows', url: 'experiences/cultural-shows.html' },
      { label: 'Minority & Local Life', url: 'experiences/minority-local-life.html' },
    ] },
    { label: 'Tours', url: 'tours/index.html', hidden: false, footerLabel: 'Tours & Itineraries', children: [] },
    { label: 'Plan', url: 'plan/index.html', hidden: true, footerLabel: 'Plan Like a Local', children: [
      { label: 'Zhangjiajie Itinerary (3–5 Days)', url: 'plan/zhangjiajie-itinerary.html' },
      { label: 'Best Time to Visit', url: 'plan/best-time-to-visit-zhangjiajie.html' },
      { label: 'Zhangjiajie vs Wulingyuan', url: 'plan/zhangjiajie-vs-wulingyuan.html' },
    ] },
    { label: 'Food', url: 'food/index.html', hidden: true, footerLabel: 'Local Food', children: [] },
    { label: 'Hotels', url: 'hotels/mountain-lodges.html', hidden: false, footerLabel: 'Hotels', children: [
      { label: '🏔️ Mountain Lodges', url: 'hotels/mountain-lodges.html' },
      { label: '⭐ Selected Stays', url: 'hotels/selected-stays.html' },
      { label: '💡 Value Hotels', url: 'hotels/value-hotels.html' },
      { label: '📍 By Area', url: 'hotels/by-area.html' },
    ] },
    { label: 'Contact Us', url: '#contact', hidden: false, children: [] },
  ],
};

// ========== 景点 Top Attractions（后台 🏞 模块编辑，独立图库 images/top-attractions/） ==========
// 仅管首页 #attraction 区块的 8 张卡片；详情页（attractions/<slug>.html）由 attractions-data.mjs 生成，互不耦合。
// 角标颜色用关键字（badgeColor），运营不写裸类名；图片仅取自 images/top-attractions/。
export const topAttractions = {
  eyebrow: "DON'T MISS THESE",
  title: 'Top 8 Must-See Spots',
  subtitle: 'The spots our guests love most, ranked by how often they actually go.',
  items: [
    { slug: 'yuanjiajie', title: 'Yuanjiajie (Avatar Mountains)', highlight: 'Bailong Elevator, floating peaks', time: '3-4 hrs', vibeEmoji: '🌌', vibe: 'Epic', hidden: false },
    { slug: 'tianzi', title: 'Tianzi Mountain', highlight: 'Sea of clouds, sunrise', time: '3-4 hrs', vibeEmoji: '☁️', vibe: 'Dreamy', hidden: false },
    { slug: 'tianmen', title: 'Tianmen Mountain', highlight: 'Cable car, 999 steps, glass walk', time: 'Half-full day', vibeEmoji: '😱', vibe: 'Thrilling', hidden: false },
    { slug: 'jinbian', title: 'Golden Whip Stream', highlight: 'Flat valley walk, wild monkeys', time: '2-3 hrs', vibeEmoji: '🌿', vibe: 'Relaxing', hidden: false },
    { slug: 'grand-canyon', title: 'Grand Canyon Glass Bridge', highlight: 'Transparent bridge, bungee', time: '3-4 hrs', vibeEmoji: '⚡', vibe: 'Adrenaline', hidden: false },
    { slug: 'huangshizhai', title: 'Huangshizhai', highlight: '360° panorama loop trail', time: '2-3 hrs', vibeEmoji: '🏔️', vibe: 'Vistas', hidden: false },
    { slug: 'baofeng', title: 'Baofeng Lake', highlight: 'Boat ride, folk songs', time: '2-3 hrs', vibeEmoji: '🛶', vibe: 'Serene', hidden: false },
    { slug: 'yellow-dragon', title: 'Yellow Dragon Cave', highlight: 'Karst caves, underground river', time: '2-3 hrs', vibeEmoji: '🐉', vibe: 'Mystical', hidden: false },
  ],
};
