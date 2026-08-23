// zhangjiajie-tours-v3 — Tour Packages module data (data-driven page generation)
// Each object in `items` feeds templates/tour-detail.html via scripts/build-tours.mjs
// and is editable in the admin backend (admin/modules/tours.js).
// Images are physically isolated to images/tours/ (one manifest: admin/imglib/tours.json).
// Round-trips through admin/mjs.js rebuild() on the single `tours` export (diff stays minimal).

export const tours = {
  eyebrow: 'Curated Itineraries',
  title: 'Tour Packages in Zhangjiajie',
  subtitle: 'Hand-picked multi-day tours and day trips, built around the Avatar mountains, glass bridge and Tianmen peak — with local guides, clear pricing and flexible pacing.',
  items: [
    {
      slug: '3-day-classic',
      img: 'yuanjiajie-avatar',
      imgAlt: 'Yuanjiajie Avatar mountains on a 3-day classic tour',
      badge: '3 Days',
      badgeColor: 'forest',
      title: '3-Day Classic Zhangjiajie Tour',
      desc: 'The essential Wulingyuan loop: Avatar mountains, Tianzi Sea of Clouds and Golden Whip Stream — paced for first-time visitors.',
      hidden: false,
      heroImg: 'peaks-panorama',
      heroAlt: 'Sandstone pillars of Zhangjiajie Wulingyuan at sunrise',
      tagline: 'Best of Wulingyuan',
      heroLead: 'Three days covering the most iconic pillars of the UNESCO park with an English-speaking local guide — no rushed transfers, no hidden stops.',
      duration: '3 Days / 2 Nights',
      price: 'From ¥2,980 / person',
      overview: 'This is the tour most first-time visitors choose. It strings together the three postcard sights of Wulingyuan — Yuanjiajie (the Avatar mountains), Tianzi Mountain and Golden Whip Stream — into a relaxed three-day rhythm, with two nights inside or next to the park so you can catch the early light and avoid the midday crowds.',
      itinerary: [
        {
          day: 'Day 1',
          title: 'Arrival & Yuanjiajie (Avatar)',
          text: 'Meet your guide at the Wulingyuan East Gate, shuttle to the Bailong Elevator, ride up to the Yuanjiajie plateau. Walk the Avatar Hallelujah Mountain viewpoint and First Bridge Under Heaven. Overnight near the park.',
        },
        {
          day: 'Day 2',
          title: 'Tianzi Mountain & Golden Whip Stream',
          text: 'Cable car up to Tianzi Mountain for the Sea of Clouds and Imperial Brush Peak. Afternoon walk down Golden Whip Stream (7.5 km, flat) alongside wild macaques and crystal water.',
        },
        {
          day: 'Day 3',
          title: 'Huangshizhai & departure',
          text: 'Morning loop at Huangshizhai for a 360° panorama, then transfer to your next destination (Zhangjiajie city, airport or railway).',
        },
      ],
      included: ['English-speaking local guide for 3 days', 'Park combo ticket (¥227, valid 4 days) & shuttle bus', 'Bailong Elevator + Tianzi cable car rides', '2 nights standard hotel near Wulingyuan', 'Private transport between sights'],
      excluded: ['Meals (your guide recommends local restaurants, ¥40–¥80/meal)', 'Gratuities', 'Personal expenses & travel insurance', 'City-hotel pickup outside Wulingyuan (surcharge applies)'],
      gallery: [
        {
          img: 'yuanjiajie-avatar',
          alt: 'Avatar Hallelujah Mountain',
        },
        {
          img: 'peaks-panorama',
          alt: 'Sea of sandstone pillars',
        },
        {
          img: 'tianzi-autumn',
          alt: 'Tianzi Mountain in autumn',
        },
        {
          img: 'jinbianxi-stream',
          alt: 'Golden Whip Stream',
        },
        {
          img: 'huangshizhai-winter',
          alt: 'Huangshizhai panorama',
        },
        {
          img: 'intro-bg',
          alt: 'Misty Wulingyuan valley',
        },
      ],
      faq: [
        {
          q: 'Is this tour suitable for families?',
          a: 'Yes. Day 2’s Golden Whip Stream walk is flat and family-friendly; the elevator and cable car save the climbing. We can slow the pace for young children.',
        },
        {
          q: 'What is included in the park ticket?',
          a: 'The Wulingyuan combo ticket (about ¥227, valid 4 days) covers park entry and the shuttle buses inside the park. The Bailong Elevator and Tianzi cable car are included in this package.',
        },
        {
          q: 'Can the itinerary be customized?',
          a: 'Absolutely. Many guests add Tianmen Mountain or the Glass Bridge as a 4th day. Tell us your interests and we reshape the route.',
        },
        {
          q: 'Where do we stay?',
          a: 'Two nights in a standard hotel within or beside Wulingyuan scenic area, chosen for location and cleanliness. Upgrades are available on request.',
        },
      ],
    },
    {
      slug: 'glass-bridge-avatar',
      img: 'yangjiajie-wall',
      imgAlt: 'Grand Canyon Glass Bridge on the adventure tour',
      badge: '1 Day',
      badgeColor: 'red',
      title: 'Glass Bridge & Avatar Adventure',
      desc: 'A full day of adrenaline: walk the world’s highest glass-bottom bridge, then ride the Bailong Elevator to the Avatar mountains.',
      hidden: false,
      heroImg: 'yangjiajie-wall',
      heroAlt: 'Zhangjiajie Grand Canyon Glass Bridge between two cliffs',
      tagline: 'Thrill + Icons',
      heroLead: 'For travellers who want the biggest wow in one day — the 430 m glass bridge over the Grand Canyon and the Avatar mountains, with a local guide handling every transfer.',
      duration: '1 Day',
      price: 'From ¥880 / person',
      overview: 'A compact day combining the two most photographed spots in Zhangjiajie: the Grand Canyon Glass Bridge (430 m, 300 m above the canyon) and the Yuanjiajie Avatar mountains reached by the Bailong Elevator. Perfect as a day trip from Zhangjiajie city or Wulingyuan.',
      itinerary: [
        {
          day: 'Morning',
          title: 'Grand Canyon Glass Bridge',
          text: 'Transfer to the Grand Canyon, walk the transparent 430 m span with shoe covers, then hike down past waterfalls and out by boat.',
        },
        {
          day: 'Afternoon',
          title: 'Avatar mountains via Bailong Elevator',
          text: 'Shuttle to Wulingyuan East Gate, ride the Bailong Elevator to Yuanjiajie, walk the Avatar viewpoint loop and First Bridge Under Heaven.',
        },
        {
          day: 'Late',
          title: 'Return',
          text: 'Transfer back to your hotel or the railway station. Optional bungee jump can be added at the bridge (advance booking).',
        },
      ],
      included: ['English-speaking local guide', 'Glass Bridge + Grand Canyon ticket', 'Wulingyuan combo ticket & Bailong Elevator', 'Private transport for the day'],
      excluded: ['Meals', 'Bungee jump (¥2,998–¥3,998, book ahead)', 'Gratuities & personal expenses'],
      gallery: [
        {
          img: 'yangjiajie-wall',
          alt: 'Glass bridge span',
        },
        {
          img: 'peaks-panorama',
          alt: 'Canyon view from the bridge',
        },
        {
          img: 'yuanjiajie-avatar',
          alt: 'Avatar mountains',
        },
        {
          img: 'jinbianxi-rock',
          alt: 'Rock formations below the bridge',
        },
        {
          img: 'intro-bg',
          alt: 'Misty canyon',
        },
        {
          img: 'tianzi-autumn',
          alt: 'Autumn peaks',
        },
      ],
      faq: [
        {
          q: 'How high is the glass bridge?',
          a: 'About 300 m above the canyon floor, with a 430 m transparent span — one of the highest and longest glass-bottom bridges in the world.',
        },
        {
          q: 'Can I add the bungee jump?',
          a: 'Yes, the bridge has one of the world’s highest commercial bungee jumps (¥2,998–¥3,998). It needs advance booking and a same-day health check.',
        },
        {
          q: 'Is the bridge safe?',
          a: 'The bridge is engineered to high safety standards and inspected regularly. Visitors must wear the supplied shoe covers and follow staff instructions.',
        },
        {
          q: 'How long is the day?',
          a: 'About 8–9 hours including transfers. We start early to beat the bridge queues.',
        },
      ],
    },
    {
      slug: 'tianmen-day',
      img: 'tianzi-snow',
      imgAlt: 'Tianmen Mountain Heaven’s Gate natural arch',
      badge: '1 Day',
      badgeColor: 'gold',
      title: 'Tianmen Mountain Day Tour',
      desc: 'Ride the world’s longest cable car, walk the cliffside glass path and climb through Heaven’s Gate — a dramatic standalone peak.',
      hidden: false,
      heroImg: 'tianzi-snow',
      heroAlt: 'Tianmen Mountain with Heaven’s Gate arch in winter',
      tagline: 'The Mountain with the Arch',
      heroLead: 'Tianmen Mountain stands alone south of the city — the 7.5 km cable car, 99-bend road and the Heaven’s Gate natural arch make it the most convenient “wow” of the trip.',
      duration: '1 Day',
      price: 'From ¥760 / person',
      overview: 'Tianmen Mountain is outside Wulingyuan, so it is easy to reach and has a different feel: a single peak with vertical cliffs, a cave punched through the mountain, and a cable car that starts in the city and ends in the clouds. A half-day to full-day experience, best done on its own day.',
      itinerary: [
        {
          day: 'Morning',
          title: 'Cable car up',
          text: 'Ride the 7.5 km cable car from downtown Zhangjiajie to the summit (about 28 minutes), passing over villages and forest.',
        },
        {
          day: 'Midday',
          title: 'Cliff walk & Heaven’s Gate',
          text: 'Walk the west cliff glass pathway, visit Tianmen Temple, then descend through the cave escalators to the Heaven’s Gate arch (999 steps or escalator).',
        },
        {
          day: 'Afternoon',
          title: '99-bend bus down',
          text: 'Return to the city by the dramatic 99-bend shuttle road. Optional Tianmen Fox Fairy evening show can be added.',
        },
      ],
      included: ['English-speaking local guide', 'Tianmen Mountain ticket (¥275–¥278, includes cable car & shuttle)', 'Private transport within the mountain area'],
      excluded: ['Meals', 'Glass walkway shoe covers (¥5, or included)', 'Evening show tickets (optional add-on)', 'Gratuities & personal expenses'],
      gallery: [
        {
          img: 'tianzi-snow',
          alt: 'Heaven’s Gate and cable car',
        },
        {
          img: 'peaks-panorama',
          alt: 'Tianmen panorama',
        },
        {
          img: 'yangjiajie-wall',
          alt: 'Cliffside walkway',
        },
        {
          img: 'intro-bg',
          alt: 'Mountain road',
        },
        {
          img: 'tianzi-autumn',
          alt: 'Autumn peaks',
        },
        {
          img: 'huangshizhai-winter',
          alt: 'Winter cliffs',
        },
      ],
      faq: [
        {
          q: 'How long is the Tianmen cable car?',
          a: 'The cable car is 7.5 km and takes about 28 minutes — one of the longest passenger cable cars in the world.',
        },
        {
          q: 'Do I need to climb 999 steps?',
          a: 'No. Escators through the cave reach the Heaven’s Gate arch. The 999 steps are optional.',
        },
        {
          q: 'Is Tianmen part of Wulingyuan?',
          a: 'No. It is a separate mountain with its own ticket (about ¥275–¥278) and is not covered by the Wulingyuan combo ticket.',
        },
        {
          q: 'Can I combine it with Wulingyuan?',
          a: 'Not recommended in one day — Tianmen alone takes 4–6 hours plus travel. Plan separate days.',
        },
      ],
    },
    {
      slug: '4-day-highlights',
      img: 'tianzi-autumn',
      imgAlt: 'Autumn peaks on the 4-day highlights tour',
      badge: '4 Days',
      badgeColor: 'emerald',
      title: '4-Day Zhangjiajie Highlights',
      desc: 'The complete circuit — Avatar mountains, Glass Bridge, Tianmen Mountain and a Tujia village — with time to breathe.',
      hidden: false,
      heroImg: 'tianzi-autumn',
      heroAlt: 'Autumn sandstone pillars of Zhangjiajie',
      tagline: 'Everything, Unrushed',
      heroLead: 'Four relaxed days covering both Wulingyuan and the standalone Tianmen peak, plus a taste of local Tujia culture — the most complete first visit.',
      duration: '4 Days / 3 Nights',
      price: 'From ¥2,680 / person',
      overview: 'For travellers who want the full picture without racing, this four-day tour links the Avatar mountains and Golden Whip Stream, the Grand Canyon Glass Bridge, Tianmen Mountain, and a Tujia village visit for local food and handicrafts. Three nights based in Wulingyuan keep transfers short.',
      itinerary: [
        {
          day: 'Day 1',
          title: 'Yuanjiajie & Tianzi',
          text: 'Bailong Elevator to Yuanjiajie Avatar loop, then Tianzi Mountain Sea of Clouds. Overnight Wulingyuan.',
        },
        {
          day: 'Day 2',
          title: 'Golden Whip Stream & Glass Bridge',
          text: 'Morning walk along Golden Whip Stream, afternoon at the Grand Canyon Glass Bridge (optional bungee). Overnight Wulingyuan.',
        },
        {
          day: 'Day 3',
          title: 'Tianmen Mountain',
          text: 'Transfer to Tianmen Mountain: cable car, cliff glass walk, Heaven’s Gate. Evening Tujia village feast. Overnight Wulingyuan.',
        },
        {
          day: 'Day 4',
          title: 'Village & departure',
          text: 'Morning Tujia village walk and market, then transfer to your next destination.',
        },
      ],
      included: ['English-speaking local guide for 4 days', 'All park tickets (Wulingyuan combo, Glass Bridge, Tianmen)', 'Bailong Elevator, Tianzi cable car, Tianmen cable car', '3 nights hotel (Wulingyuan)', 'Private transport throughout', 'Tujia village visit & feast'],
      excluded: ['Meals (¥40–¥80/meal, guide recommends)', 'Gratuities & personal expenses', 'Optional bungee jump', 'Travel insurance'],
      gallery: [
        {
          img: 'tianzi-autumn',
          alt: 'Autumn peaks',
        },
        {
          img: 'yuanjiajie-avatar',
          alt: 'Avatar mountains',
        },
        {
          img: 'yangjiajie-wall',
          alt: 'Glass bridge',
        },
        {
          img: 'tianzi-snow',
          alt: 'Tianmen Mountain',
        },
        {
          img: 'jinbianxi-stream',
          alt: 'Golden Whip Stream',
        },
        {
          img: 'gallery-painting',
          alt: 'Tujia village',
        },
      ],
      faq: [
        {
          q: 'Is 4 days enough for a first visit?',
          a: 'Yes — it covers the headline sights plus local culture with a relaxed pace. Most guests find it the sweet spot before adding Fenghuang or Fenghuang ancient town.',
        },
        {
          q: 'Can we add Fenghuang?',
          a: 'Easily as a 5th day. Fenghuang ancient town is about 2.5 hours from Zhangjiajie by car; we can extend the route.',
        },
        {
          q: 'What about the Tujia village?',
          a: 'A half-day visit with a wooden-village walk and a communal local feast. It is the most human, lowest-key part of the trip.',
        },
        {
          q: 'Are hotels flexible?',
          a: 'Yes. We default to clean standard hotels near Wulingyuan; upgrades (forest lodges, lake resorts) are available on request.',
        },
      ],
    },
  ],
};
