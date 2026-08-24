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

export const topAttractions = {
  eyebrow: "Don't Miss These",
  title: 'Top 8 Must-See Spots',
  subtitle: 'The spots our guests love most, ranked by how often they actually go.',
  items: [
    { slug: 'yuanjiajie', rank: 1, spot: 'Yuanjiajie (Avatar Mountains)', highlight: 'Bailong Elevator, floating peaks', time: '3–4 hrs', vibe: '🎬 Epic', hidden: false },
    { slug: 'tianzi', rank: 2, spot: 'Tianzi Mountain', highlight: 'Sea of clouds, sunrise', time: '3–4 hrs', vibe: '☁️ Dreamy', hidden: false },
    { slug: 'tianmen', rank: 3, spot: 'Tianmen Mountain', highlight: 'Cable car, 999 steps, glass walk', time: 'Half–full day', vibe: '😱 Thrilling', hidden: false },
    { slug: 'jinbian', rank: 4, spot: 'Golden Whip Stream', highlight: 'Flat valley walk, wild monkeys', time: '2–3 hrs', vibe: '🌿 Relaxing', hidden: false },
    { slug: 'grand-canyon', rank: 5, spot: 'Grand Canyon Glass Bridge', highlight: 'Transparent bridge, bungee', time: '3–4 hrs', vibe: '⚡ Adrenaline', hidden: false },
    { slug: 'huangshizhai', rank: 6, spot: 'Huangshizhai', highlight: '360° panorama loop trail', time: '2–3 hrs', vibe: '🔭 Vistas', hidden: false },
    { slug: 'baofeng', rank: 7, spot: 'Baofeng Lake', highlight: 'Boat ride, folk songs', time: '2–3 hrs', vibe: '🚣 Serene', hidden: false },
    { slug: 'yellow-dragon', rank: 8, spot: 'Yellow Dragon Cave', highlight: 'Karst caves, underground river', time: '2–3 hrs', vibe: '🐉 Mystical', hidden: false },
  ],
};

export const homeTourCards = {
  eyebrow: 'Choose Your Style',
  title: 'Tour Packages',
  cards: [
    {
      id: 'day',
      icon: '📅',
      iconBg: 'bg-sand',
      title: 'Day Tour',
      subtitle: 'One-day highlights',
      subtitleColor: 'stone-500',
      desc: 'Perfect if you\'re short on time. Hit the biggest sights in one action-packed day with a private guide and driver.',
      features: ['Yuanjiajie + Avatar Platform', 'Tianzi Mountain overlook', 'Golden Whip Stream walk', 'Private car + English guide', 'Hotel pickup & drop-off'],
      price: 'From $129/person',
      buttonStyle: 'forest',
      popular: false,
      hidden: false,
    },
    {
      id: 'private',
      icon: '🎒',
      iconBg: 'bg-gold/20',
      title: 'Private Tour',
      subtitle: 'Most Popular ★',
      subtitleColor: 'gold-dark',
      desc: 'Built around your pace and interests — your own guide, your own car, and a flexible plan that changes when you want it to.',
      features: ['Customizable 3–7 day itinerary', 'Private English-speaking guide', 'Private vehicle throughout', '4★ hotel accommodation', 'All entrance tickets included'],
      price: 'From $599/person',
      buttonStyle: 'gold',
      popular: true,
      hidden: false,
    },
    {
      id: 'vip-wen',
      icon: '💎',
      iconBg: 'bg-forest/10',
      title: 'VIP Tour wen',
      subtitle: 'Ultimate experience',
      subtitleColor: 'stone-500',
      desc: 'Skip the queues, stay in top hotels, and reach the quietest viewpoints. For travelers who\'d rather relax and let us handle the rest.',
      features: ['Fast-track entry (skip lines)', '5★ luxury hotel suite', 'Premium dining experiences', 'Helicopter option available', 'Personal concierge 24/7'],
      price: 'From $2,999/person',
      buttonStyle: 'forest',
      popular: false,
      hidden: false,
    },
  ],
};
