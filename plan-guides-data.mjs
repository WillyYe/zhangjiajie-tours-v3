// zhangjiajie-tours-v3 — Plan Like a Local / Travel Guides module data.
// Reference: myguilin.com/guides-data.mjs
// Consumed by scripts/build-plan-guides.mjs to render plan/*.html.
//
// Block types (rendered by build-plan-guides.mjs):
//   { type: 'p',       text }            paragraph (HTML allowed: <a>, <strong>, <em>)
//   { type: 'h2',      text }            section heading
//   { type: 'h3',      text }            sub heading
//   { type: 'ul',      items: [] }       unordered list
//   { type: 'ol',      items: [] }       ordered list
//   { type: 'quote',   text, cite }      pull quote
//   { type: 'callout', title, text }     highlighted tip box (HTML allowed)
//   { type: 'image',   img, alt, caption }  inline figure (img must exist in /images/*.webp)

export const planGuides = [
  /* ============================== 1. ITINERARY ============================== */
  {
    slug: 'zhangjiajie-itinerary',
    title: 'Zhangjiajie Itinerary: How to Spend 3, 4, or 5 Days',
    date: '2026-03-12',
    excerpt:
      'A practical day-by-day Zhangjiajie itinerary for 3, 4, and 5 days — covering Yuanjiajie, Tianzi Mountain, Golden Whip Stream, Tianmen Mountain, the Grand Canyon Glass Bridge, and where to base yourself.',
    coverImage: 'yuanjiajie-avatar',
    coverAlt: 'Yuanjiajie Avatar Hallelujah Mountain at sunrise',
    tags: ['Itinerary', 'Planning', 'First-timer'],
    readingTime: '9 min read',
    author: 'Visit Zhangjiajie Local Team',
    related: ['best-time-to-visit-zhangjiajie', 'zhangjiajie-vs-wulingyuan'],
    blocks: [
      { type: 'p', text: 'Zhangjiajie is compact enough to see the headline peaks in three days, but rich enough that five days still feels full. The trick is pairing the right areas on the same day and not zig-zagging between Wulingyuan and the city. This guide gives you three ready-made plans built around the same logic we use when planning trips for international visitors.' },
      { type: 'h2', text: 'The one rule that makes or breaks your trip' },
      { type: 'p', text: 'Base yourself in <strong>one of two places</strong>: Wulingyuan (inside the park zone, best for sunrise and multiple park days) or Zhangjiajie city (better trains, airport, and Tianmen Mountain access). Most first-timers should do <strong>Wulingyuan → Yuanjiajie → Tianzi Mountain → Golden Whip Stream</strong>, then add Tianmen Mountain and the Grand Canyon from the city side.' },
      { type: 'callout', title: 'Quick answer', text: '3 days = Yuanjiajie + Tianzi + Golden Whip Stream. 4 days = above + Tianmen Mountain. 5 days = above + Grand Canyon Glass Bridge + a slow village or show evening.' },
      { type: 'h2', text: '3-Day Zhangjiajie itinerary (the essentials)' },
      { type: 'h3', text: 'Day 1 — Yuanjiajie & the Avatar mountains' },
      { type: 'ul', items: [
        'Morning: enter Wulingyuan through the East Gate and take the park shuttle to the <a href="../attractions/yuanjiajie.html">Bailong Elevator</a>.',
        'Midday: walk the Yuanjiajie loop — Avatar Hallelujah Mountain, First Bridge Under Heaven, and Enchanting Terrace.',
        'Afternoon: shuttle to the Yangjiajie wall area for a quieter ridge walk, or extend the Yuanjiajie loop further west.',
        'Evening: stay in Wulingyuan so you can enter at opening the next morning.',
      ] },
      { type: 'h3', text: 'Day 2 — Tianzi Mountain sea of clouds' },
      { type: 'ul', items: [
        'Morning: <a href="../attractions/tianzi.html">Tianzi Mountain</a> cable car up for sunrise over the West Sea of Rocks.',
        'Midday: Helong Park, Imperial Brush Peak, and Fairy Scattered Flowers.',
        'Afternoon: shuttle down or walk to the upper station, then a late lunch in Wulingyuan.',
        'Evening: early night — the best light is at dawn.',
      ] },
      { type: 'h3', text: 'Day 3 — Golden Whip Stream & depart' },
      { type: 'ul', items: [
        'Morning: walk the flat 7.5 km <a href="../attractions/jinbian.html">Golden Whip Stream</a> trail through the forest floor.',
        'Midday: lunch in Wulingyuan, then a bus or taxi to Zhangjiajie city.',
        'Afternoon: train or flight out.',
      ] },
      { type: 'image', img: 'yuanjiajie-mist', alt: 'Misty Yuanjiajie peaks at dawn', caption: 'Yuanjiajie at dawn — the Avatar mountains are best in the first soft light of the day.' },
      { type: 'h2', text: '4-Day itinerary (add Tianmen Mountain)' },
      { type: 'p', text: 'Insert Tianmen Mountain as <strong>Day 4</strong>. Take the world’s longest cable car up from Zhangjiajie city, walk the 99-turn road and the cliffside glass skywalk, then pass through the natural arch of Heaven’s Gate. Return to the city for your evening train or flight.' },
      { type: 'h2', text: '5-Day itinerary (add the Grand Canyon Glass Bridge)' },
      { type: 'p', text: 'Use the extra day for the <a href="../attractions/grand-canyon.html">Grand Canyon Glass Bridge</a> — a 430 m transparent span over the canyon. Pair it with a late afternoon visit to <a href="../attractions/yellow-dragon.html">Yellow Dragon Cave</a> or the <a href="../attractions/baofeng.html">Baofeng Lake</a> boat ride for a slower, varied day.' },
      { type: 'h2', text: 'Where to base: Wulingyuan vs Zhangjiajie city' },
      { type: 'ul', items: [
        'Choose <strong>Wulingyuan</strong> if: you have 3+ days, want sunrise gate access, and the park is your main focus.',
        'Choose <strong>Zhangjiajie city</strong> if: you arrive late, leave early, or Tianmen Mountain is your priority.',
      ] },
      { type: 'quote', text: 'The best Zhangjiajie trips are not the ones with the most viewpoints — they are the ones where you stood still long enough to watch the mist lift off the pillars.', cite: 'A Wulingyuan guide we work with' },
      { type: 'h2', text: 'Logistics that save you hours' },
      { type: 'ul', items: [
        'Wulingyuan is about 40 km from Zhangjiajie city; the bus takes roughly 40–60 minutes.',
        'Park tickets are valid for 4 days — keep your passport for entry.',
        'Book the Bailong Elevator and cable cars in advance during April–October.',
      ] },
      { type: 'callout', title: 'Plan with a local', text: 'Not sure which base fits your dates? Our <a href="../#tour">local team</a> builds a private itinerary around your flight times and energy level — reply within 24 hours, no obligation.' },
    ],
  },

  /* ============================== 2. BEST TIME ============================== */
  {
    slug: 'best-time-to-visit-zhangjiajie',
    title: 'Best Time to Visit Zhangjiajie: Month-by-Month Weather & Crowds',
    date: '2026-02-26',
    excerpt:
      'When to visit Zhangjiajie in 2026: a month-by-month breakdown of weather, crowd levels, and what to expect on the peaks and at Tianmen Mountain — plus the two weeks to avoid.',
    coverImage: 'tianzi-autumn',
    coverAlt: 'Autumn colors on Tianzi Mountain ridges',
    tags: ['Weather', 'Planning', 'Seasons'],
    readingTime: '7 min read',
    author: 'Visit Zhangjiajie Local Team',
    related: ['zhangjiajie-itinerary', 'zhangjiajie-vs-wulingyuan'],
    blocks: [
      { type: 'p', text: 'Zhangjiajie has a humid subtropical mountain climate: warm, wet summers and cool, misty winters. The pillars look dramatic in every season, but the <strong>experience</strong> changes a lot — especially when fog rolls in and closes the viewpoints. This guide breaks it down month by month.' },
      { type: 'h2', text: 'The short version' },
      { type: 'ul', items: [
        '<strong>Best overall:</strong> April–May and September–October (mild, photogenic, manageable crowds).',
        '<strong>Best for sea of clouds:</strong> mornings after rain, year-round.',
        '<strong>Best value / fewest crowds:</strong> November–March (cool, some mist, cheaper hotels).',
        '<strong>Avoid:</strong> the first week of May and Oct 1–7 (National Day) — prices and crowds peak.',
      ] },
      { type: 'image', img: 'peaks-panorama', alt: 'Panoramic view of Zhangjiajie quartz-sandstone peaks', caption: 'Late autumn light on the Wulingyuan pillars — clear air and warm color without the summer haze.' },
      { type: 'h2', text: 'Month by month' },
      { type: 'h3', text: 'March–May (spring)' },
      { type: 'p', text: 'Warm, lush, and often misty — the classic “ink painting” weather. April–May is peak photography season for sea-of-clouds shots after rain. Pack a light shell; trails can be damp.' },
      { type: 'h3', text: 'June–August (summer)' },
      { type: 'p', text: 'Hot and humid (30°C+), with afternoon thunderstorms. Crowds are moderate, but July–August school holidays spike. The forest trails stay cool; do exposed viewpoints early.' },
      { type: 'h3', text: 'September–October (autumn)' },
      { type: 'p', text: 'The most comfortable temperatures and clearest air. The autumn color on <a href="../attractions/tianzi.html">Tianzi Mountain</a> is spectacular. The National Day week (Oct 1–7) is the busiest, priciest window of the year — go the week before or after.' },
      { type: 'h3', text: 'November–March (winter)' },
      { type: 'p', text: 'Cool (5–15°C), quiet, and atmospheric. Some mist on the peaks; occasional light snow. Hotels are cheapest. The park feels almost private on weekday mornings.' },
      { type: 'callout', title: 'If you only have one trip', text: 'Target <strong>mid-April to mid-May</strong> or <strong>mid-September to late September</strong>. You get the scenery at its best without the holiday-week chaos. Tell our <a href="../#tour">local team</a> your dates and we will shape the itinerary around the weather.' },
      { type: 'h2', text: 'What “best” depends on' },
      { type: 'ul', items: [
        'Photography → Apr–May mist or late-Sep clear skies.',
        'Fewer crowds + low cost → Nov–Mar.',
        'Family summer break → Jun–Aug, start early, embrace the rain.',
      ] },
    ],
  },

  /* ============================== 3. WHERE TO BASE ============================== */
  {
    slug: 'zhangjiajie-vs-wulingyuan',
    title: 'Zhangjiajie vs Wulingyuan: Where to Base Your Trip',
    date: '2026-03-05',
    excerpt:
      'Zhangjiajie city or Wulingyuan? A straight comparison of where to stay — transport, scenery, park access, hotels, and which one fits a first-time visit to the pillar mountains.',
    coverImage: 'gallery-painting',
    coverAlt: 'Scenic valley view near Wulingyuan',
    tags: ['Planning', 'Where to stay', 'Wulingyuan'],
    readingTime: '6 min read',
    author: 'Visit Zhangjiajie Local Team',
    related: ['zhangjiajie-itinerary', 'best-time-to-visit-zhangjiajie'],
    blocks: [
      { type: 'p', text: 'First-time visitors almost always ask the same thing: should I stay in Zhangjiajie city or in Wulingyuan? They are only about 40 km apart, but they feel like different trips. Here is the honest comparison, with no sugar-coating.' },
      { type: 'h2', text: 'Wulingyuan' },
      { type: 'p', text: 'The gateway town cluster inside the park zone: East Gate, West Gate, and the hotel strip between them. This is where you want to be if the park is your main focus. You can walk or shuttle to the entrances, enter at opening for sunrise, and retreat to a hotel between viewpoints.' },
      { type: 'image', img: 'intro-bg', alt: 'Forest trail leading into Wulingyuan', caption: 'Wulingyuan puts you inside the park ecosystem — forest trails and hotel balconies with peak views.' },
      { type: 'h2', text: 'Zhangjiajie city' },
      { type: 'p', text: 'The regional transport hub: airport, high-speed trains, and long-distance buses. It is also the base for <a href="../attractions/tianmen.html">Tianmen Mountain</a>, whose cable car leaves from the city center. The city has more international-standard hotels and restaurants, but the pillar scenery is <em>around</em> the city, not in it.' },
      { type: 'image', img: 'yangjiajie-wall', alt: 'Wall-like cliff formation near Wulingyuan', caption: 'The city has conveniences; Wulingyuan has the views at your doorstep.' },
      { type: 'h2', text: 'Head-to-head' },
      { type: 'ul', items: [
        '<strong>Park access:</strong> Wulingyuan wins by a mile.',
        '<strong>Transport:</strong> Zhangjiajie city wins (airport + trains).',
        '<strong>Scenery at your door:</strong> Wulingyuan wins.',
        '<strong>Hotels:</strong> Zhangjiajie city has more chain options; Wulingyuan has characterful inns.',
        '<strong>Tianmen Mountain:</strong> Zhangjiajie city is the natural base.',
      ] },
      { type: 'callout', title: 'Our default recommendation', text: 'Spend 2–3 nights in Wulingyuan for the park, then move to Zhangjiajie city for Tianmen Mountain and your departure. Our <a href="../#tour">local team</a> can book both stays and the transfer in one go.' },
      { type: 'h2', text: 'Can you do both without moving hotels?' },
      { type: 'p', text: 'Yes, but it costs time. You can base in Zhangjiajie city and take a day tour to Wulingyuan, but you will miss the magic of entering at dawn before the tour buses arrive. If your trip is 3+ days, splitting bases is worth it.' },
    ],
  },
];
