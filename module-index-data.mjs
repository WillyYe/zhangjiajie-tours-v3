// First-level (module hub) pages for zhangjiajie-tours-v3.
// Reference: myguilin.com/guides/index.html (hero + card grid + ItemList JSON-LD).
// All pages live one level below root, so asset paths use "../".
// Attractions cards link to real detail pages; the other modules link to
// homepage section anchors (their detail pages are built later — "先只做一级").

export const SITE_BASE = 'https://willyye.github.io/zhangjiajie-tours-v3/';

export const modules = [
  {
    slug: 'attractions',
    file: 'attractions/index.html',
    title: 'Top Attractions in Zhangjiajie | Visit Zhangjiajie',
    metaDesc: 'The 8 signature sights of Zhangjiajie National Forest Park — Yuanjiajie (Avatar mountains), Tianzi Mountain, the Grand Canyon Glass Bridge, Tianmen Mountain and more, each with its own guide.',
    canonical: 'https://willyye.github.io/zhangjiajie-tours-v3/attractions/index.html',
    heroImg: 'peaks-panorama.webp',
    heroImgAlt: 'Panoramic view of Zhangjiajie quartz-sandstone peaks at dawn',
    breadcrumb: 'Attractions',
    heroEyebrow: 'Wulingyuan World Heritage',
    h1: 'Top Attractions in Zhangjiajie',
    heroDesc: 'From the Avatar mountains of Yuanjiajie to the glass bridge over the Grand Canyon — explore the eight signature sights of Zhangjiajie National Forest Park, each with its own full guide.',
    intro: 'Zhangjiajie’s Wulingyuan Scenic Area packs more than 3,000 quartz-sandstone pillars into a single UNESCO World Heritage landscape. We’ve broken the must-sees into eight clear chapters — open one for the full guide, or string several together for a multi-day park itinerary.',
    gridTitle: 'The 8 signature sights',
    gridIntro: 'Each card opens a dedicated guide with routes, tickets, best-time tips, and how to get there.',
    cards: [
      { img: 'tianzi-autumn.webp', alt: 'Tianzi Mountain sea of clouds', title: 'Tianzi Mountain (天子山)', desc: 'The park’s most famous viewpoint ridge — sea of clouds, the "West Sea" of pillars, and the Helong Pavilion panorama.', href: './tianzi.html', tag: 'Wulingyuan Core' },
      { img: 'jinbianxi-stream.webp', alt: 'Golden Whip Stream clear water', title: 'Golden Whip Stream (金鞭溪)', desc: 'A flat, shaded 7.5 km stream walk between the core scenic areas — easy, green, and full of monkeys.', href: './jinbian.html', tag: 'Easy Walk' },
      { img: 'huangshizhai-winter.webp', alt: 'Huangshizhai viewpoint in winter', title: 'Huangshizhai (黄石寨)', desc: 'A circular clifftop loop reached by cable car, with some of the cleanest pillar-and-gorge views in the park.', href: './huangshizhai.html', tag: 'Cable Car' },
      { img: 'yangjiajie-wall.webp', alt: 'Yangjiajie cliff wall', title: 'Tianmen Mountain (天门山)', desc: 'A separate peak south of the park: the 99-turn road, the cliffside glass walkway, and the giant natural arch.', href: './tianmen.html', tag: 'Iconic' },
      { img: 'peaks-panorama.webp', alt: 'Grand Canyon Glass Bridge span', title: 'Grand Canyon Glass Bridge', desc: 'The headline glass-bottom bridge — a 430 m span with a bungee jump and canyon views straight down.', href: './grand-canyon.html', tag: 'Adrenaline' },
      { img: 'gallery-painting.webp', alt: 'Baofeng Lake calm water', title: 'Baofeng Lake (宝峰湖)', desc: 'A calm alpine lake inside the park — boat rides between karst walls, an easy half-day add-on.', href: './baofeng.html', tag: 'Boat Ride' },
      { img: 'intro-bg.webp', alt: 'Yellow Dragon Cave illuminated chambers', title: 'Yellow Dragon Cave (黄龙洞)', desc: 'A vast illuminated limestone cave with underground rivers and a boat tour — a cool retreat on hot days.', href: './yellow-dragon.html', tag: 'Cave' },
      { img: 'yuanjiajie-avatar.webp', alt: 'Yuanjiajie Avatar Hallelujah Mountain', title: 'Yuanjiajie (袁家界)', desc: 'The plateau that inspired Avatar’s Hallelujah Mountains — Bailong Elevator up, the Avatar viewpoint, and First Bridge Under Heaven.', href: './yuanjiajie.html', tag: 'Avatar' }
    ]
  },

  {
    slug: 'experiences',
    file: 'experiences/index.html',
    title: 'Things to Do in Zhangjiajie | Visit Zhangjiajie',
    metaDesc: 'The experiences worth the trip to Zhangjiajie — the Bailong Elevator, the Grand Canyon Glass Bridge, bamboo rafting, helicopter flights, Tujia cultural shows and local village life.',
    canonical: 'https://willyye.github.io/zhangjiajie-tours-v3/experiences/index.html',
    heroImg: 'yangjiajie-wall.webp',
    heroImgAlt: 'Cliffside walkway along Zhangjiajie karst walls',
    breadcrumb: 'Experiences',
    heroEyebrow: 'Things to do',
    h1: 'Things to Do in Zhangjiajie',
    heroDesc: 'Ride the world’s tallest outdoor elevator, walk the glass bridge, drift a stream by bamboo raft, or watch Tujia culture come alive — the experiences that turn a scenic stop into a real adventure.',
    intro: 'Beyond the viewpoints, Zhangjiajie is built for doing. These six experiences are the ones travellers talk about for years — each card now opens a dedicated guide with what to expect, how to book, and how to fit it into your trip.',
    gridTitle: 'Six experiences worth the trip',
    gridIntro: 'Tap any card to open the full experience guide.',
    cards: [
      { img: 'yuanjiajie-avatar.webp', alt: 'Bailong Elevator against the cliff', title: 'Avatar & Bailong Elevator', desc: 'The 326 m outdoor elevator that lifts you to the Yuanjiajie plateau in about 90 seconds — the fastest way to the Avatar mountains.', href: './avatar-bailong-elevator.html', tag: 'Iconic' },
      { img: 'yangjiajie-wall.webp', alt: 'Glass bridge over the canyon', title: 'Glass Bridge & Bungee', desc: 'Walk the transparent span of the Grand Canyon Glass Bridge, then step off the edge on one of the world’s highest bungee jumps.', href: './glass-bridge-bungee.html', tag: 'Adrenaline' },
      { img: 'peaks-panorama.webp', alt: 'Tianmen Mountain cable car', title: 'Tianmen Mountain', desc: 'Cable car up, the 99-turn road, the cliffside glass walkway, and the vast natural arch of Heaven’s Gate.', href: './tianmen-mountain.html', tag: 'Views' },
      { img: 'tianzi-snow.webp', alt: 'Aerial view of the peaks', title: 'Helicopter Tour', desc: 'A bird’s-eye loop over the sandstone sea — the only way to take in the whole landscape in one go.', href: './helicopter-tour.html', tag: 'Aerial' },
      { img: 'gallery-painting.webp', alt: 'Tujia cultural performance', title: 'Cultural Shows', desc: 'Evening song-and-dance performances of Tujia and Miao heritage, including the large-scale Tianmen Fox Fairy show.', href: './cultural-shows.html', tag: 'Night' },
      { img: 'huangshizhai-winter.webp', alt: 'Minority village life', title: 'Minority & Local Life', desc: 'Markets, villages, and food of the Tujia and Miao people who call the Wuling mountains home.', href: './minority-local-life.html', tag: 'Culture' }
    ]
  },

  {
    slug: 'tours',
    file: 'tours/index.html',
    title: 'Zhangjiajie Tours & Itineraries | Visit Zhangjiajie',
    metaDesc: 'Zhangjiajie tour formats compared — top-ranked must-see spots, day tours, private guide-and-car plans, and VIP packages, with honest notes on what’s included.',
    canonical: 'https://willyye.github.io/zhangjiajie-tours-v3/tours/index.html',
    heroImg: 'intro-bg.webp',
    heroImgAlt: 'Guided tour group overlooking the peaks',
    breadcrumb: 'Tours',
    heroEyebrow: 'Guided & self-planned',
    h1: 'Zhangjiajie Tours & Itineraries',
    heroDesc: 'Day trips, private guides with a car, and VIP packages — find the tour style that fits how you like to travel, with honest notes on what’s included.',
    intro: 'Not sure how to stitch the park together? These tour formats cover most visitors — from a tightly-run day tour to a fully private guide-and-car plan. Each card jumps to the details on our main page.',
    gridTitle: 'Tour formats we recommend',
    gridIntro: 'Pick a style, then see the full breakdown and booking notes.',
    cards: [
      { img: 'peaks-panorama.webp', alt: 'The top must-see viewpoints', title: 'Top 8 Must-See Spots', desc: 'Our ranked shortlist of the sights you shouldn’t leave without seeing, and the most efficient order to hit them.', href: '../#tour-ranking', tag: 'Ranked' },
      { img: 'tianzi-autumn.webp', alt: 'Group on a day tour', title: 'Day Tours', desc: 'Join-in and private day tours that cover the core park highlights in a single, well-paced day.', href: '../#tour-day', tag: 'Day Trip' },
      { img: 'yangjiajie-wall.webp', alt: 'Private guide with car', title: 'Private Tours', desc: 'A private guide and car for your group — flexible routing, hotel pickup, and no fixed coach schedule.', href: '../#tour-private-card', tag: 'Most Popular' },
      { img: 'gallery-painting.webp', alt: 'Premium tour experience', title: 'VIP Tours', desc: 'Premium packages with skip-line access, premium vehicles, and curated experiences across the park.', href: '../#tour-vip-card', tag: 'Premium' },
      { img: 'intro-bg.webp', alt: 'Plan your own route', title: 'Plan Your Own', desc: 'Prefer to go independent? Use our attraction and experience guides to build a self-planned itinerary.', href: '../#tour', tag: 'DIY' }
    ]
  },

  {
    slug: 'plan',
    file: 'plan/index.html',
    title: 'Plan Like a Local | Visit Zhangjiajie',
    metaDesc: 'Plan your Zhangjiajie trip like a local — practical itineraries, best time to visit, where to stay, and how to avoid the crowds, written by our Zhangjiajie-based team.',
    canonical: 'https://willyye.github.io/zhangjiajie-tours-v3/plan/index.html',
    heroImg: 'yuanjiajie-mist.webp',
    heroImgAlt: 'Misty Yuanjiajie quartz-sandstone peaks at dawn',
    breadcrumb: 'Plan Like a Local',
    heroEyebrow: 'Travel guides',
    h1: 'Plan Like a Local',
    heroDesc: 'Practical, no-fluff Zhangjiajie guides written by our team — itineraries, best time to visit, where to stay, and how to string the sights together.',
    intro: 'The best Zhangjiajie trips are planned, not stumbled into. These guides cover the decisions that matter most — how many days, where to base yourself, when to come, and how to avoid the crowds.',
    gridTitle: 'Zhangjiajie travel guides',
    gridIntro: 'Each guide links to real attractions and booking advice, so you can turn a plan into a trip.',
    cards: [
      { img: 'yuanjiajie-avatar.webp', alt: 'Yuanjiajie Avatar Hallelujah Mountain at sunrise', title: 'Zhangjiajie Itinerary: 3, 4, or 5 Days', desc: 'A practical day-by-day plan for 3, 4, and 5 days — covering Yuanjiajie, Tianzi Mountain, Golden Whip Stream, Tianmen Mountain, and the Grand Canyon.', href: './zhangjiajie-itinerary.html', date: '2026-03-12', readingTime: '9 min read', tags: ['Itinerary', 'Planning', 'First-timer'] },
      { img: 'tianzi-autumn.webp', alt: 'Autumn colors on Tianzi Mountain ridges', title: 'Best Time to Visit Zhangjiajie', desc: 'Month-by-month weather, crowd levels, and what to expect on the peaks — plus the two weeks to avoid.', href: './best-time-to-visit-zhangjiajie.html', date: '2026-02-26', readingTime: '7 min read', tags: ['Weather', 'Planning', 'Seasons'] },
      { img: 'gallery-painting.webp', alt: 'Scenic valley view near Wulingyuan', title: 'Zhangjiajie vs Wulingyuan: Where to Base Your Trip', desc: 'Zhangjiajie city or Wulingyuan? A straight comparison of transport, park access, scenery, and hotels.', href: './zhangjiajie-vs-wulingyuan.html', date: '2026-03-05', readingTime: '6 min read', tags: ['Planning', 'Where to stay', 'Wulingyuan'] }
    ]
  }
];
