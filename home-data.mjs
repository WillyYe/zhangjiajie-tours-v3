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
    { label: 'Attractions', url: 'attractions/index.html', hidden: false, children: [
      { label: 'Tianzi Mountain', url: 'attractions/tianzi.html' },
      { label: 'Golden Whip Stream', url: 'attractions/jinbian.html' },
      { label: 'Huangshizhai', url: 'attractions/huangshizhai.html' },
      { label: 'Tianmen Mountain', url: 'attractions/tianmen.html' },
      { label: 'Grand Canyon Glass Bridge', url: 'attractions/grand-canyon.html' },
      { label: 'Baofeng Lake', url: 'attractions/baofeng.html' },
      { label: 'Yellow Dragon Cave', url: 'attractions/yellow-dragon.html' },
      { label: 'Yuanjiajie (Avatar)', url: 'attractions/yuanjiajie.html' },
    ] },
    { label: 'Experiences', url: 'experiences/index.html', hidden: false, children: [
      { label: 'Avatar & Bailong Elevator', url: 'experiences/avatar-bailong-elevator.html' },
      { label: 'Glass Bridge & Bungee', url: 'experiences/glass-bridge-bungee.html' },
      { label: 'Tianmen Mountain', url: 'experiences/tianmen-mountain.html' },
      { label: 'Helicopter Tour', url: 'experiences/helicopter-tour.html' },
      { label: 'Cultural Shows', url: 'experiences/cultural-shows.html' },
      { label: 'Minority & Local Life', url: 'experiences/minority-local-life.html' },
    ] },
    { label: 'Tours', url: 'tours/index.html', hidden: false, children: [] },
    { label: 'Plan', url: 'plan/index.html', hidden: false, children: [
      { label: 'Zhangjiajie Itinerary (3–5 Days)', url: 'plan/zhangjiajie-itinerary.html' },
      { label: 'Best Time to Visit', url: 'plan/best-time-to-visit-zhangjiajie.html' },
      { label: 'Zhangjiajie vs Wulingyuan', url: 'plan/zhangjiajie-vs-wulingyuan.html' },
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

// ========== 景点 Top Attractions（后台 🏞 模块编辑，独立图库 images/top-attractions/） ==========
// 仅管首页 #attraction 区块的 8 张卡片；详情页（attractions/<slug>.html）由 attractions-data.mjs 生成，互不耦合。
// 角标颜色用关键字（badgeColor），运营不写裸类名；图片仅取自 images/top-attractions/。
export const topAttractions = {
  eyebrow: 'Explore',
  title: 'Top Attractions in Zhangjiajie',
  subtitle: 'Eight must-see destinations — the same iconic spots ranked in our Top 8 list, from the Avatar mountains to hidden caves.',
  items: [
    { slug: 'yuanjiajie', img: 'yuanjiajie-avatar', imgAlt: 'Yuanjiajie Avatar Mountains', imgW: 800, imgH: 450, badge: 'Avatar · Pandora', badgeColor: 'forest', title: 'Yuanjiajie (Avatar Mountains)', desc: 'The real-life Pandora — sandstone pillars that inspired Avatar\'s Hallelujah Mountains. Ride the Bailong Elevator and walk the Avatar viewpoint.', hidden: false },
    { slug: 'tianzi', img: 'tianzi-autumn', imgAlt: 'Tianzi Mountain', imgW: 1200, imgH: 781, badge: 'Sea of Clouds', badgeColor: 'emerald', title: 'Tianzi Mountain', desc: 'Legendary peak forest with rolling seas of clouds and crimson sunrises. Named after Xiang Dakun, the Tujia "Son of Heaven". Best at dawn.', hidden: false },
    { slug: 'tianmen', img: 'peaks-panorama', imgAlt: 'Tianmen Mountain', imgW: 1200, imgH: 815, badge: 'World Record', badgeColor: 'gold', title: 'Tianmen Mountain', desc: 'Ride the world\'s longest cable car (7.5 km), climb the 999-step Heavenly Stairway, and walk the glass skywalk at 1,500 m.', hidden: false },
    { slug: 'jinbian', img: 'jinbianxi-stream', imgAlt: 'Golden Whip Stream', imgW: 800, imgH: 534, badge: 'Family Friendly', badgeColor: 'blue', title: 'Golden Whip Stream', desc: 'A flat 7.5 km valley walk along a crystal stream, shaded by peaks and home to playful wild macaques. Easy and perfect for families.', hidden: false },
    { slug: 'grand-canyon', img: 'yangjiajie-wall', imgAlt: 'Grand Canyon Glass Bridge', imgW: 1200, imgH: 801, badge: 'Thrill Seeker', badgeColor: 'red', title: 'Grand Canyon Glass Bridge', desc: 'The world\'s highest & longest glass-bottom suspension bridge (430 m), 300 m above the canyon floor. Bungee jumping available!', hidden: false },
    { slug: 'huangshizhai', img: 'huangshizhai-winter', imgAlt: 'Huangshizhai', imgW: 1200, imgH: 627, badge: 'Panorama', badgeColor: 'orange', title: 'Huangshizhai', desc: 'A classic loop trail with a 360° panorama of the quartz-sandstone peaks. "He who doesn\'t reach Huangshizhai hasn\'t seen Zhangjiajie."', hidden: false },
    { slug: 'baofeng', img: 'gallery-painting', imgAlt: 'Baofeng Lake', imgW: 1200, imgH: 801, badge: 'Relaxing', badgeColor: 'blue', title: 'Baofeng Lake', desc: 'A pristine alpine lake surrounded by towering cliffs. Take a boat ride while local ethnic singers perform traditional folk songs. Pure serenity.', hidden: false },
    { slug: 'yellow-dragon', img: 'jinbianxi-rock', imgAlt: 'Yellow Dragon Cave', imgW: 970, imgH: 1200, badge: 'Underground Wonder', badgeColor: 'purple', title: 'Yellow Dragon Cave', desc: 'One of China\'s largest karst cave systems — 13 levels, underground rivers, stalactites and waterfalls spanning 48 hectares beneath the earth.', hidden: false },
  ],
};
