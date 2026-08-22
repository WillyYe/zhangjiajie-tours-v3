// zhangjiajie-tours-v3 — Hotel module data
// 7 partner hotels grouped into 4 categories (mind-map: 山野 / 精选 / 性价比 / 区域).
// Images are pre-converted webp in images/ (see /tmp/convert_hotels.py).
// Run: node scripts/build-hotels.mjs

export const hotels = {
  jimo: {
    name: 'JiMO Boutique Hotel',
    zh: '积木酒店',
    area: 'Wulingyuan Core',
    tier: 'Boutique',
    img: 'hotel-jimo-hero',
    alt: 'JiMO boutique hotel exterior at blue hour by the river',
    blurb: 'A design-led retreat tucked into the Wulingyuan valley, minutes from the east gate. Quiet rooms, a riverside terrace, and the kind of calm that makes early park mornings effortless.',
    features: ['5–10 min drive to the Wulingyuan east gate', 'Riverside terrace & garden', 'Design-led rooms with local timber'],
    detail: {
      tagline: 'Boutique retreat',
      heroLead: 'A design-led retreat tucked into the Wulingyuan valley, minutes from the east gate. Quiet rooms, a riverside terrace, and the kind of calm that makes early park mornings effortless.',
      areaTier: 'Wulingyuan · Boutique',
      intro: 'JiMO sits where the valley narrows by the river — close enough to the Wulingyuan east gate for a relaxed sunrise transfer, quiet enough to actually unwind afterwards. Design-forward rooms, a riverside terrace, and a garden courtyard are the draw.',
      metaDesc: 'JiMO Boutique Hotel — a design-led retreat in Wulingyuan, minutes from the park’s east gate. Courtyard rooms, riverside calm, and a valley setting made for early park mornings.',
      heroAlt: 'JiMO Boutique Hotel exterior by the river in Wulingyuan',
      alternateName: '几木酒店',
      jsonDesc: 'A design-led boutique retreat in Wulingyuan, Zhangjiajie, minutes from the park east gate, with courtyard rooms and a riverside terrace.',
      areaServed: 'Wulingyuan, Zhangjiajie',
      roomsTitle: 'Rooms & suites',
      roomsSub: 'Ten room types across the courtyard and riverside wings — from compact kings to terrace suites and a family layout.',
      rooms: [
        { img: 'hotel-jimo-room-mansi-twin', alt: 'Mansi Deluxe Twin room', name: 'Mansi Deluxe Twin', nameZh: '漫时光豪华双床房', features: ['Two twin beds', '“Slow-time” warm styling', 'Courtyard or city outlook'] },
        { img: 'hotel-jimo-room-mansi-king', alt: 'Mansi Comfort King room', name: 'Mansi Comfort King', nameZh: '漫时光舒适大床房', features: ['King bed', 'Soft, restful palette', 'Work desk & lounge chair'] },
        { img: 'hotel-jimo-room-court-king', alt: 'Courtyard King terrace room', name: 'Courtyard King (Terrace)', nameZh: '庭院大床房', features: ['King bed', 'Private terrace', 'Direct courtyard access'] },
        { img: 'hotel-jimo-room-court-twin', alt: 'Courtyard Twin terrace room', name: 'Courtyard Twin (Terrace)', nameZh: '庭院双床房', features: ['Twin beds', 'Private terrace', 'Courtyard-facing'] },
        { img: 'hotel-jimo-room-court-suite', alt: 'Courtyard Suite terrace room', name: 'Courtyard Suite (Terrace)', nameZh: '庭院套房', features: ['Suite layout', 'Private terrace', 'Separate lounge space'] },
        { img: 'hotel-jimo-room-bathtub', alt: 'Courtyard Bathtub room', name: 'Courtyard Bathtub Room', nameZh: '庭院浴缸房', features: ['Spa bathtub', 'Twin beds', 'Courtyard outlook'] },
        { img: 'hotel-jimo-room-family', alt: 'Family Suite room', name: 'Family Suite', nameZh: '家庭套房', features: ['Family layout', 'Extra beds', 'Living space for kids'] },
        { img: 'hotel-jimo-room-king-suite', alt: 'King Suite room', name: 'King Suite', nameZh: '大床套房', features: ['King bed', 'Suite living area', 'Premium finishes'] },
        { img: 'hotel-jimo-room-esports', alt: 'E-sports Room', name: 'E-sports Room', nameZh: '电竞房', features: ['Gaming setup', 'King bed', 'High-speed gear'] },
        { img: 'hotel-jimo-room-special', alt: 'Special King room', name: 'Special King', nameZh: '特价房', features: ['Standard king', 'Best-value rate', 'Cozy & compact'] },
      ],
      galleryTitle: 'Inside JiMO',
      gallerySub: 'The courtyard, the garden, and the riverside calm that give the hotel its character.',
      gallery: [
        { img: 'hotel-jimo-lobby2', alt: 'JiMO common area' },
        { img: 'hotel-jimo-lobby3', alt: 'JiMO lounge' },
        { img: 'hotel-jimo-garden', alt: 'JiMO garden courtyard' },
        { img: 'hotel-jimo-hero', alt: 'JiMO exterior by the river' },
      ],
      faq: [
        { q: 'How far is JiMO from the park?', a: 'About a 5–10 minute drive to the Wulingyuan east gate, so early-morning entries are easy and relaxed.' },
        { q: 'Is breakfast included?', a: 'A daily breakfast is available on site. Tell us your dates and we’ll confirm the plan for your room type.' },
        { q: 'Which room fits a family?', a: 'The Family Suite and courtyard rooms with extra beds work well for families; the E-sports Room is a hit with kids and gamers.' },
        { q: 'How do I book JiMO?', a: 'We don’t take payment — message us by email and we’ll recommend the right room and help reserve for your dates, free and with no obligation.' },
      ],
    },
  },
  hetianye: {
    name: 'Hetianye Hotel',
    zh: '和田野酒店',
    area: 'Wulingyuan · Mountain side',
    tier: 'Mountain Lodge',
    img: 'hotel-hetianye-1',
    alt: 'Hetianye hotel surrounded by green peaks',
    blurb: 'A hillside lodge with balcony rooms that open straight onto the quartz-sandstone peaks. Built for travellers who want the scenery from the pillow, not just the trail.',
    features: ['Balcony rooms with peak views', 'Quiet mountain setting', 'Family & suite layouts'],
    detail: {
      tagline: 'Hillside retreat',
      heroLead: 'A hillside lodge with balcony rooms that open straight onto the quartz-sandstone peaks — built for travellers who want the scenery from the pillow.',
      heroAlt: 'Hetianye hillside hotel with balcony rooms overlooking the peaks',
      areaTier: 'Wulingyuan · Mountain side',
      intro: 'Hetianye is set into the hillside on the Wulingyuan side, so many rooms look straight out at the peaks. It is the choice when the view matters as much as the stay.',
      metaDesc: 'Hetianye Hotel — a design-led retreat in Wulingyuan, minutes from the park’s east gate. Courtyard rooms, riverside calm, and a valley setting made for early park mornings.',
      alternateName: '和田野酒店',
      jsonDesc: 'A hillside lodge on the Wulingyuan side of Zhangjiajie with balcony rooms overlooking the quartz-sandstone peaks, including family and suite layouts.',
      areaServed: 'Wulingyuan, Zhangjiajie',
      roomsTitle: 'Rooms & suites',
      roomsSub: 'Ten room types across the hillside wings — from compact twins to 270° peak suites and two-bedroom layouts for families and groups.',
      rooms: [
        {
          img: 'hotel-hetianye-room-1',
          alt: 'View Twin room',
          name: 'View Twin',
          nameZh: '阅景双床房',
          features: [
            'Two twin beds',
            'Peak view',
            'Quiet wing'
          ]
        },
        {
          img: 'hotel-hetianye-room-2',
          alt: 'Mountain-View King room',
          name: 'Mountain-View King',
          nameZh: '山色大床房',
          features: [
            '1.8m king bed',
            'Mountain view',
            'Warm timber finish'
          ]
        },
        {
          img: 'hotel-hetianye-room-3',
          alt: 'Peak-View King room',
          name: 'Peak-View King',
          nameZh: '观岚大床',
          features: [
            '1.8m king bed',
            'Open peak view',
            'Private balcony'
          ]
        },
        {
          img: 'hotel-hetianye-room-4',
          alt: '270° Peak Suite room',
          name: '270° Peak Suite',
          nameZh: '270°观岚套房',
          features: [
            'Suite layout',
            '270° peak views',
            'Premium finish'
          ]
        },
        {
          img: 'hotel-hetianye-room-5',
          alt: 'Scenery Twin room',
          name: 'Scenery Twin',
          nameZh: '观景双床房',
          features: [
            'Two twin beds',
            'Scenery view',
            'Restful palette'
          ]
        },
        {
          img: 'hotel-hetianye-room-6',
          alt: 'Family Suite room',
          name: 'Family Suite',
          nameZh: '亲子套房',
          features: [
            'Family layout',
            'Extra beds',
            'Kids welcome'
          ]
        },
        {
          img: 'hotel-hetianye-room-7',
          alt: 'Peak Suite room',
          name: 'Peak Suite',
          nameZh: '观岚套房',
          features: [
            'Suite living area',
            'Peak view',
            'Separate lounge'
          ]
        },
        {
          img: 'hotel-hetianye-room-8',
          alt: 'Balcony Mountain Twin room',
          name: 'Balcony Mountain Twin',
          nameZh: '601阳台观山双床房',
          features: [
            'Two twin beds',
            'Private balcony',
            'Mountain outlook'
          ]
        },
        {
          img: 'hotel-hetianye-room-9',
          alt: 'One-Bedroom Twin Suite room',
          name: 'One-Bedroom Twin Suite',
          nameZh: '602一室一厅双床套房',
          features: [
            'One bedroom + lounge',
            'Twin beds',
            'Space for longer stays'
          ]
        },
        {
          img: 'hotel-hetianye-room-10',
          alt: 'Two-Bedroom Suite room',
          name: 'Two-Bedroom Suite',
          nameZh: '605双卧套房',
          features: [
            'Two bedrooms',
            'Family / group layout',
            'Living room'
          ]
        }
      ],
      galleryTitle: 'Inside Hetianye',
      gallerySub: 'The tea room, the restaurant, the lawn, and the front desk that frame the mountain setting.',
      gallery: [
        {
          img: 'hotel-hetianye-g2',
          alt: 'Tea room'
        },
        {
          img: 'hotel-hetianye-g3',
          alt: 'Restaurant'
        },
        {
          img: 'hotel-hetianye-g4',
          alt: 'Reception'
        },
        {
          img: 'hotel-hetianye-g5',
          alt: 'Lawn'
        },
        {
          img: 'hotel-hetianye-g6',
          alt: 'Signage'
        },
        {
          img: 'hotel-hetianye-g1',
          alt: 'Exterior'
        }
      ],
      faq: [
        {
          q: 'Which rooms have the best view?',
          a: 'The 270° Peak Suite and the balcony rooms (601) open straight onto the quartz-sandstone peaks.'
        },
        {
          q: 'Is it close to the park?',
          a: 'It sits on the Wulingyuan side, a short transfer to the gates — good for early-morning entries.'
        },
        {
          q: 'Good for families?',
          a: 'Yes — the Family Suite, One-Bedroom Twin Suite and Two-Bedroom Suite all work well for families and groups.'
        },
        {
          q: 'How do I book?',
          a: 'We don\'t take payment — message us by email and we will help reserve the right room for your dates.'
        }
      ]
    },
  },
  vienna: {
    name: 'Vienna International Hotel',
    zh: '维也纳国际酒店',
    area: 'Near Tianmen Cable Car',
    tier: 'Curated',
    img: 'hotel-vienna-1',
    alt: 'Vienna International Hotel daytime exterior',
    blurb: 'A polished international-standard hotel a short hop from the Tianmen Mountain cable-car station. Reliable comfort, a proper breakfast spread, and easy airport/train links.',
    features: ['Near Tianmen cable-car station', 'Full breakfast & business facilities', 'International service standard'],
    detail: {
      tagline: 'International comfort',
      heroLead: 'A polished international-standard hotel a short hop from the Tianmen Mountain cable-car station — reliable comfort, a proper breakfast, and easy airport and train links.',
      heroAlt: 'Vienna International Hotel exterior by the Tianmen cable-car station',
      areaTier: 'Near Tianmen · International',
      intro: 'Vienna International sits by the Tianmen cable-car station, so the mountain and the transit hub are both minutes away. It is the pick when you want a dependable, full-service base without surprises.',
      metaDesc: 'Vienna International Hotel — a design-led retreat in Wulingyuan, minutes from the park’s east gate. Courtyard rooms, riverside calm, and a valley setting made for early park mornings.',
      alternateName: '维也纳国际酒店',
      jsonDesc: 'A polished international-standard hotel near the Tianmen Mountain cable-car station in Zhangjiajie, with smart rooms, a daily breakfast, and business facilities.',
      areaServed: 'Near Tianmen, Zhangjiajie',
      roomsTitle: 'Rooms & suites',
      roomsSub: 'Five room types plus family and kids-themed layouts — smart-controlled rooms, an on-site breakfast, and business facilities.',
      rooms: [
        {
          img: 'hotel-vienna-room-1',
          alt: 'Superior Smart King room',
          name: 'Superior Smart King',
          nameZh: '高级智能大床房',
          features: [
            '1.8m king bed',
            'Smart room controls',
            '24 m²'
          ]
        },
        {
          img: 'hotel-vienna-room-2',
          alt: 'Deluxe Smart King room',
          name: 'Deluxe Smart King',
          nameZh: '豪华智能大床房',
          features: [
            '1.8m king bed',
            'Smart room controls',
            '30 m²'
          ]
        },
        {
          img: 'hotel-vienna-room-3',
          alt: 'Deluxe Smart Twin room',
          name: 'Deluxe Smart Twin',
          nameZh: '豪华智能双床房',
          features: [
            'Two twin beds',
            'Smart room controls',
            '28 m²'
          ]
        },
        {
          img: 'hotel-vienna-room-4',
          alt: 'Dream Smart King room',
          name: 'Dream Smart King',
          nameZh: '愉梦智能大床房',
          features: [
            '1.8m king bed',
            'Dream-series mattress',
            '31 m²'
          ]
        },
        {
          img: 'hotel-vienna-room-5',
          alt: 'Business Suite room',
          name: 'Business Suite',
          nameZh: '商务套房',
          features: [
            '1.8m king bed',
            'Separate living area',
            '45 m²'
          ]
        },
        {
          img: 'hotel-vienna-room-6',
          alt: 'Family Room room',
          name: 'Family Room',
          nameZh: '家庭房',
          features: [
            'Family layout',
            'Extra beds available',
            'Kid-friendly'
          ]
        },
        {
          img: 'hotel-vienna-room-7',
          alt: 'Kids-Themed Room room',
          name: 'Kids-Themed Room',
          nameZh: '乐玩亲子房',
          features: [
            'Playful kids theme',
            'Family layout',
            'Games & toys'
          ]
        },
        {
          img: 'hotel-vienna-room-8',
          alt: 'Special Rate Room room',
          name: 'Special Rate Room',
          nameZh: '特价房',
          features: [
            'Best-value rate',
            'Standard king',
            'Cozy & compact'
          ]
        }
      ],
      galleryTitle: 'Inside Vienna International',
      gallerySub: 'The lobby, the breakfast hall, the gym, and the meeting spaces that make it a dependable city base.',
      gallery: [
        {
          img: 'hotel-vienna-g2',
          alt: 'Lobby'
        },
        {
          img: 'hotel-vienna-g3',
          alt: 'Breakfast hall'
        },
        {
          img: 'hotel-vienna-g4',
          alt: 'Fitness centre'
        },
        {
          img: 'hotel-vienna-g5',
          alt: 'Lift lobby'
        },
        {
          img: 'hotel-vienna-g6',
          alt: 'Meeting room'
        },
        {
          img: 'hotel-vienna-g1',
          alt: 'Exterior'
        }
      ],
      faq: [
        {
          q: 'How far is the hotel from Tianmen Mountain?',
          a: 'About a 5-minute walk to the Tianmen cable-car station; the airport and train station are a short drive away.'
        },
        {
          q: 'Is breakfast included?',
          a: 'A daily breakfast is available on site. Tell us your dates and we will confirm what is included for your room.'
        },
        {
          q: 'Do you have family rooms?',
          a: 'Yes — the Family Room and Kids-Themed Room are popular with families, both with extra beds and a playful setup.'
        },
        {
          q: 'How do I book?',
          a: 'We don\'t take payment — message us by email and we will recommend the right room and help reserve for your dates, free and with no obligation.'
        }
      ]
    },
  },
  boutique: {
    name: 'Homeinn Boutique (Ziwu Park)',
    zh: '如家精品酒店（紫舞公园店）',
    area: 'Zhangjiajie City · Ziwu Park',
    tier: 'Design',
    img: 'hotel-boutique-1',
    alt: 'Homeinn Boutique hotel interior at Ziwu Park',
    blurb: 'The refreshed Homeinn Boutique format — warmer materials, smarter rooms, and a location by Ziwu Park that keeps you close to the city’s eats and transport without the noise.',
    features: ['Newly refreshed boutique format', 'By Ziwu Park, city centre', 'Smart, compact rooms'],
    detail: {
      tagline: 'Refreshed design',
      heroLead: 'The refreshed Homeinn Boutique format — warmer materials, smarter rooms, and a location by Ziwu Park that keeps you close to the city\'s eats without the noise.',
      heroAlt: 'Homeinn Boutique hotel by Ziwu Park, Zhangjiajie',
      areaTier: 'Zhangjiajie City · Ziwu Park',
      intro: 'Homeinn Boutique by Ziwu Park is the design-led sister of the Homeinn family — smarter rooms and a quieter spot near the park, close to the city\'s food and transport.',
      metaDesc: 'Homeinn Boutique (Ziwu Park) — a design-led retreat in Wulingyuan, minutes from the park’s east gate. Courtyard rooms, riverside calm, and a valley setting made for early park mornings.',
      alternateName: '如家精品酒店（紫舞公园店）',
      jsonDesc: 'The refreshed Homeinn Boutique hotel by Ziwu Park in Zhangjiajie city, with design-led rooms and a quieter, central location.',
      areaServed: 'Zhangjiajie City, Ziwu Park',
      roomsTitle: 'Rooms & suites',
      roomsSub: 'Five refreshed layouts — from a compact standard king to a spacious zero-pressure twin.',
      rooms: [
        {
          img: 'hotel-boutique-room-1',
          alt: 'Standard King room',
          name: 'Standard King',
          nameZh: '大床房',
          features: [
            '1.5m queen bed',
            '19 m²',
            'Cozy'
          ]
        },
        {
          img: 'hotel-boutique-room-2',
          alt: 'Superior King room',
          name: 'Superior King',
          nameZh: '高级大床房',
          features: [
            '1.8m king bed',
            '21 m²',
            'Smart finishes'
          ]
        },
        {
          img: 'hotel-boutique-room-3',
          alt: 'Zero-Pressure King room',
          name: 'Zero-Pressure King',
          nameZh: '安心睡0压大床房',
          features: [
            '1.8m king bed',
            'Zero-pressure mattress',
            '24 m²'
          ]
        },
        {
          img: 'hotel-boutique-room-4',
          alt: 'Twin Room room',
          name: 'Twin Room',
          nameZh: '双床房',
          features: [
            'Two twin beds',
            '20 m²',
            'Compact'
          ]
        },
        {
          img: 'hotel-boutique-room-5',
          alt: 'Zero-Pressure Twin room',
          name: 'Zero-Pressure Twin',
          nameZh: '安心睡0压双床房',
          features: [
            'Two twin beds',
            'Zero-pressure mattresses',
            '35 m²'
          ]
        }
      ],
      galleryTitle: 'Inside Homeinn Boutique',
      gallerySub: 'The redesigned rooms and common areas of the Ziwu Park boutique format.',
      gallery: [
        {
          img: 'hotel-boutique-g1',
          alt: 'Room'
        },
        {
          img: 'hotel-boutique-g2',
          alt: 'Detail'
        },
        {
          img: 'hotel-boutique-g3',
          alt: 'Lounge'
        },
        {
          img: 'hotel-boutique-g4',
          alt: 'Common area'
        },
        {
          img: 'hotel-boutique-g5',
          alt: 'Corridor'
        },
        {
          img: 'hotel-boutique-g6',
          alt: 'Lobby'
        }
      ],
      faq: [
        {
          q: 'How is it different from standard Homeinn?',
          a: 'It is the refreshed Boutique format — warmer materials and smarter, design-led rooms.'
        },
        {
          q: 'Where is it?',
          a: 'By Ziwu Park in Zhangjiajie city, close to eats and transport but away from the noise.'
        },
        {
          q: 'Which room is most spacious?',
          a: 'The Zero-Pressure Twin is the largest at 35 m².'
        },
        {
          q: 'How do I book?',
          a: 'Message us by email and we will recommend the right room and help reserve for your dates.'
        }
      ]
    },
  },
  'homeinn-plus': {
    name: 'Homeinn Plus (Ziwu Road)',
    zh: '如家酒店（子午路店）',
    area: 'Zhangjiajie City · Ziwu Road',
    tier: 'Value',
    img: 'hotel-homeinn-plus-room-3',
    alt: 'Homeinn Plus hotel at Ziwu Road',
    blurb: 'Bright, reliable and budget‑friendly, Homeinn Plus offers you a solid retreat against Zhangjiajie’s legendary peak‑forest scenery. Every travel essential is thoughtfully covered, free of superfluous add‑ons, so you can savour the magic of mist‑shrouded stone pillars without distractions.',
    features: ['Dependable value stay', 'City-centre Ziwu Road', 'Great for longer trips'],
    detail: {
      tagline: 'Dependable value',
      heroLead: 'Clean, predictable, and easy on the wallet — the Homeinn Plus format gives you a dependable city base with the basics done right.',
      heroAlt: 'Homeinn Plus hotel on Ziwu Road, Zhangjiajie city',
      areaTier: 'Zhangjiajie City · Ziwu Road',
      intro: 'Homeinn Plus on Ziwu Road is the practical city choice — consistent rooms, a central address, and nothing you pay for but don\'t use. Great for longer trips.',
      metaDesc: 'Homeinn Plus (Ziwu Road) — a design-led retreat in Wulingyuan, minutes from the park’s east gate. Courtyard rooms, riverside calm, and a valley setting made for early park mornings.',
      alternateName: '如家酒店（子午路店）',
      jsonDesc: 'A dependable Homeinn Plus hotel on Ziwu Road in Zhangjiajie city, offering clean, value-focused rooms from compact kings to a suite.',
      areaServed: 'Zhangjiajie City, Ziwu Road',
      roomsTitle: 'Rooms & suites',
      roomsSub: 'Five dependable layouts — from a compact superior king to a suite with a separate lounge.',
      rooms: [
        {
          img: 'hotel-homeinn-plus-room-1',
          alt: 'Superior King room',
          name: 'Superior King',
          nameZh: '高级大床房',
          features: [
            '1.8m king bed',
            '24 m²',
            'City view'
          ]
        },
        {
          img: 'hotel-homeinn-plus-room-2',
          alt: 'View King room',
          name: 'View King',
          nameZh: '景观大床房',
          features: [
            '1.8m king bed',
            'Mountain view',
            '28 m²'
          ]
        },
        {
          img: 'hotel-homeinn-plus-room-3',
          alt: 'Zero-Pressure King room',
          name: 'Zero-Pressure King',
          nameZh: '安心睡零压大床房',
          features: [
            '1.8m king bed',
            'Zero-pressure mattress',
            '28 m²'
          ]
        },
        {
          img: 'hotel-homeinn-plus-room-4',
          alt: 'Suite room',
          name: 'Suite',
          nameZh: '套房',
          features: [
            '2m king bed',
            'Separate lounge',
            '34 m²'
          ]
        },
        {
          img: 'hotel-homeinn-plus-room-5',
          alt: 'Superior Twin room',
          name: 'Superior Twin',
          nameZh: '高级双床房',
          features: [
            'Two twin beds',
            'Mountain view',
            '26 m²'
          ]
        }
      ],
      galleryTitle: 'Inside Homeinn Plus',
      gallerySub: 'The rooms, the corridors, and the common areas of the Ziwu Road Homeinn Plus.',
      gallery: [
        {
          img: 'hotel-homeinn-plus-g1',
          alt: 'Room'
        },
        {
          img: 'hotel-homeinn-plus-g2',
          alt: 'Corridor'
        },
        {
          img: 'hotel-homeinn-plus-g3',
          alt: 'Lounge'
        },
        {
          img: 'hotel-homeinn-plus-g4',
          alt: 'Common area'
        },
        {
          img: 'hotel-homeinn-plus-g5',
          alt: 'Detail'
        },
        {
          img: 'hotel-homeinn-plus-g6',
          alt: 'Lobby'
        }
      ],
      faq: [
        {
          q: 'Where is it?',
          a: 'On Ziwu Road in Zhangjiajie city — central, with transit and eats nearby.'
        },
        {
          q: 'Is it good value?',
          a: 'Yes — predictable, clean rooms at a friendly rate; nothing extra you don\'t need.'
        },
        {
          q: 'Which room has a view?',
          a: 'The View King and Superior Twin both face the mountains.'
        },
        {
          q: 'How do I book?',
          a: 'Message us by email and we will recommend the right room and help reserve for your dates, free and with no obligation.'
        }
      ]
    },
  },
  '72qilou': {
    name: 'Homeinn (72 Qilou)',
    zh: '如家酒店（七十二奇楼店）',
    area: 'Zhangjiajie City · 72 Qilou',
    tier: 'Value',
    img: 'hotel-72qilou-1',
    alt: 'Homeinn hotel near the 72 Qilou towers',
    blurb: 'Steps from the 72 Qilou (Seven-Twelve Towers) night-life and dining district. The practical pick if you want the city’s buzz within walking distance of your room.',
    features: ['Walking distance to 72 Qilou district', 'Lively dining & night-life nearby', 'Straightforward, comfortable rooms'],
    detail: {
      tagline: 'City buzz',
      heroLead: 'Steps from the 72 Qilou (Seven-Twelve Towers) night-life and dining district — the practical pick if you want the city\'s buzz within walking distance.',
      heroAlt: 'Homeinn hotel by the 72 Qilou night-life district',
      areaTier: 'Zhangjiajie City · 72 Qilou',
      intro: 'Homeinn by the 72 Qilou towers puts the city\'s dining and night-life at your doorstep. Straightforward, comfortable rooms for travellers who would rather be out than in.',
      metaDesc: 'Homeinn (72 Qilou) — a design-led retreat in Wulingyuan, minutes from the park’s east gate. Courtyard rooms, riverside calm, and a valley setting made for early park mornings.',
      alternateName: '如家酒店（七十二奇楼店）',
      jsonDesc: 'A practical Homeinn hotel by the 72 Qilou (Seven-Twelve Towers) night-life district in Zhangjiajie city, with compact, comfortable rooms.',
      areaServed: 'Zhangjiajie City, 72 Qilou',
      roomsTitle: 'Rooms & suites',
      roomsSub: 'Five straightforward layouts — from a compact standard king to a family room for the whole crew.',
      rooms: [
        {
          img: 'hotel-72qilou-room-1',
          alt: 'Standard King room',
          name: 'Standard King',
          nameZh: '大床房',
          features: [
            '1.5m queen bed',
            '18 m²',
            'Compact & cozy'
          ]
        },
        {
          img: 'hotel-72qilou-room-2',
          alt: 'Superior King room',
          name: 'Superior King',
          nameZh: '高级大床房',
          features: [
            '1.8m king bed',
            '22 m²',
            'City view'
          ]
        },
        {
          img: 'hotel-72qilou-room-3',
          alt: 'Zero-Pressure King room',
          name: 'Zero-Pressure King',
          nameZh: '零压大床房',
          features: [
            '1.8m king bed',
            'Zero-pressure mattress',
            '24 m²'
          ]
        },
        {
          img: 'hotel-72qilou-room-4',
          alt: 'Superior Twin room',
          name: 'Superior Twin',
          nameZh: '高级双床房',
          features: [
            'Two twin beds',
            '24 m²',
            'City view'
          ]
        },
        {
          img: 'hotel-72qilou-room-5',
          alt: 'Family Room room',
          name: 'Family Room',
          nameZh: '家庭房',
          features: [
            '2m king bed',
            'Family layout',
            'Kid-friendly'
          ]
        }
      ],
      galleryTitle: 'Inside Homeinn (72 Qilou)',
      gallerySub: 'The rooms and the 72 Qilou surroundings that put the city\'s buzz at your doorstep.',
      gallery: [
        {
          img: 'hotel-72qilou-g1',
          alt: 'Room'
        },
        {
          img: 'hotel-72qilou-g2',
          alt: 'Room detail'
        },
        {
          img: 'hotel-72qilou-g3',
          alt: 'Corridor'
        },
        {
          img: 'hotel-72qilou-g4',
          alt: 'Building'
        },
        {
          img: 'hotel-72qilou-g5',
          alt: 'Towers nearby'
        },
        {
          img: 'hotel-72qilou-g6',
          alt: 'Entrance'
        }
      ],
      faq: [
        {
          q: 'What is nearby?',
          a: 'The 72 Qilou (Seven-Twelve Towers) dining and night-life district is a short walk away.'
        },
        {
          q: 'Good for a short stay?',
          a: 'Yes — rooms are compact and comfortable; ideal for a night or two in the city.'
        },
        {
          q: 'Do you have family rooms?',
          a: 'The Family Room adds a larger bed and a family-friendly setup.'
        },
        {
          q: 'How do I book?',
          a: 'Message us by email and we will help reserve the right room for your dates.'
        }
      ]
    },
  },
  huatian: {
    name: 'Huatiancheng Suites',
    zh: '华天城',
    area: 'Zhangjiajie City Centre',
    tier: 'City',
    img: 'hotel-huatian-g1',
    alt: 'Huatiancheng city-centre suites',
    blurb: 'Spacious apartment-style suites in the heart of the city — a smart base for families and longer stays that want kitchen space, a living area, and doorstep access to transit.',
    features: ['Apartment-style suites', 'City-centre location', 'Good for families & long stays'],
    detail: {
      tagline: 'City suites',
      heroLead: 'Spacious apartment-style suites in the heart of the city — a smart base for families and longer stays that want kitchen space and doorstep transit.',
      heroAlt: 'Huatiancheng apartment-style suites in central Zhangjiajie',
      areaTier: 'Zhangjiajie City Centre',
      intro: 'Huatiancheng gives you suite-style space in the city centre — a living area, a kitchen, and room to spread out. The pick for families and longer trips.',
      metaDesc: 'Huatiancheng Suites — a design-led retreat in Wulingyuan, minutes from the park’s east gate. Courtyard rooms, riverside calm, and a valley setting made for early park mornings.',
      alternateName: '华天城',
      jsonDesc: 'Spacious apartment-style suites in central Zhangjiajie, with separate bedrooms, a living area, and a kitchen for families and longer stays.',
      areaServed: 'Zhangjiajie City Centre',
      roomsTitle: 'Rooms & suites',
      roomsSub: 'Suite-style layouts for travellers who want space — separate bedrooms, a living area, and a kitchen.',
      rooms: [
        {
          img: 'hotel-huatian-room-1',
          alt: 'One-Bedroom Suite room',
          name: 'One-Bedroom Suite',
          nameZh: '一室一厅套房',
          features: [
            'Separate bedroom',
            'Living & kitchen',
            'City-centre'
          ]
        },
        {
          img: 'hotel-huatian-room-2',
          alt: 'Two-Bedroom Suite room',
          name: 'Two-Bedroom Suite',
          nameZh: '两室一厅套房',
          features: [
            'Two bedrooms',
            'Living & kitchen',
            'For families / groups'
          ]
        },
        {
          img: 'hotel-huatian-room-3',
          alt: 'Deluxe King Suite room',
          name: 'Deluxe King Suite',
          nameZh: '豪华大床套房',
          features: [
            'King bed',
            'Premium finish',
            'Spacious'
          ]
        },
        {
          img: 'hotel-huatian-room-4',
          alt: 'Family Suite room',
          name: 'Family Suite',
          nameZh: '家庭套房',
          features: [
            'Family layout',
            'Kid-friendly',
            'Living space'
          ]
        },
        {
          img: 'hotel-huatian-room-5',
          alt: 'View Suite room',
          name: 'View Suite',
          nameZh: '景观套房',
          features: [
            'City view',
            'Living area',
            'Bright & open'
          ]
        },
        {
          img: 'hotel-huatian-room-6',
          alt: 'Business Suite room',
          name: 'Business Suite',
          nameZh: '商务套房',
          features: [
            'Work desk',
            'Living area',
            'Long-stay ready'
          ]
        }
      ],
      galleryTitle: 'Inside Huatiancheng',
      gallerySub: 'The suites, the living spaces, and the city-centre setting.',
      gallery: [
        {
          img: 'hotel-huatian-g1',
          alt: 'Suite living'
        },
        {
          img: 'hotel-huatian-g2',
          alt: 'Bedroom'
        },
        {
          img: 'hotel-huatian-g3',
          alt: 'Kitchen'
        },
        {
          img: 'hotel-huatian-g4',
          alt: 'Living area'
        },
        {
          img: 'hotel-huatian-g5',
          alt: 'View'
        },
        {
          img: 'hotel-huatian-g6',
          alt: 'Building'
        }
      ],
      faq: [
        {
          q: 'Are these full apartments?',
          a: 'Suite-style — a separate bedroom plus a living area and kitchen, ideal for longer stays.'
        },
        {
          q: 'Where is it?',
          a: 'In the city centre, close to transit and dining.'
        },
        {
          q: 'Good for families?',
          a: 'Yes — the Two-Bedroom and Family Suites give everyone space.'
        },
        {
          q: 'How do I book?',
          a: 'Message us by email and we will help reserve the right suite for your dates.'
        }
      ]
    },
  },
};

export const hotelCategories = [
  {
    slug: 'mountain-lodges',
    title: 'Mountain & Forest Lodges',
    tag: 'Best for parks',
    heroImg: 'hotel-hetianye-1',
    heroAlt: 'Hetianye mountain lodge among the peaks',
    heroTag: 'Sleep in the scenery',
    h1: 'Mountain & Forest Lodges',
    subtitle: 'Stay inside Wulingyuan and wake up to the quartz-sandstone peaks — our picks for travellers who put the park first.',
    metaDesc: 'Mountain and forest lodges near Zhangjiajie Wulingyuan — balcony rooms and boutique retreats minutes from the park gates.',
    intro: 'These are the stays that trade city convenience for scenery. Both sit close to the Wulingyuan gates, so sunrise at the pillars is a short transfer rather than a long drive.',
    bodyIntro: 'Two lodges that put you inside the landscape rather than looking at it from afar.',
    hubDesc: 'Boutique and hillside stays inside Wulingyuan — balcony rooms with peak views.',
    faq: [
      { q: "Which area should I stay in?", a: "Wulingyuan puts you minutes from the park gates — best for early sunrise starts. Zhangjiajie city (Yongding) is better for the train station, airport and Tianmen Mountain." },
      { q: "Do you book hotels for me?", a: "We don’t take payment, but message us by email and we’ll recommend and help reserve the right stay for your dates — free, no obligation." },
      { q: "What’s the price range?", a: "From around ¥130/night at value stays to ¥600+ at scenic-view and international hotels. Peak season (May–Oct and holidays) books out early — reserve ahead." },
    ],
    cardTitle: 'Mountain Lodges',
    cardDesc: 'Stay close to the peaks and trails',
    cardImg: 'hotel-jimo-1',
    cardAlt: 'Mountain lodges with valley views in Zhangjiajie',
    navLabel: '🏔️ Mountain Lodges',
    hotels: ['jimo', 'hetianye'],
  },
  {
    slug: 'selected-stays',
    title: 'Curated & Design Stays',
    tag: 'Our favourites',
    heroImg: 'hotel-vienna-1',
    heroAlt: 'Vienna International Hotel exterior',
    heroTag: 'Comfort, curated',
    h1: 'Curated & Design Stays',
    subtitle: 'Hotels we’d book for our own parents — international-standard comfort and refreshed boutique design, without the guesswork.',
    metaDesc: 'Curated Zhangjiajie hotels — Vienna International near Tianmen and the refreshed Homeinn Boutique by Ziwu Park.',
    intro: 'When you want the stay itself to feel good, not just the location. These two balance service standard with a bit of design.',
    bodyIntro: 'Two stays we confidently recommend for comfort and consistency.',
    hubDesc: 'International-standard and design-led hotels we routinely recommend.',
    faq: [
      { q: "Which area should I stay in?", a: "Wulingyuan puts you minutes from the park gates — best for early sunrise starts. Zhangjiajie city (Yongding) is better for the train station, airport and Tianmen Mountain." },
      { q: "Do you book hotels for me?", a: "We don’t take payment, but message us by email and we’ll recommend and help reserve the right stay for your dates — free, no obligation." },
      { q: "What’s the price range?", a: "From around ¥130/night at value stays to ¥600+ at scenic-view and international hotels. Peak season (May–Oct and holidays) books out early — reserve ahead." },
    ],
    cardTitle: 'Selected Stays',
    cardDesc: 'Hand-picked for comfort & service',
    cardImg: 'hotel-vienna-1',
    cardAlt: 'Selected boutique hotels in Zhangjiajie',
    navLabel: '⭐ Selected Stays',
    hotels: ['vienna', 'boutique'],
  },
  {
    slug: 'value-hotels',
    title: 'Great-Value Hotels',
    tag: 'Smart spend',
    heroImg: 'hotel-72qilou-1',
    heroAlt: 'Homeinn near the 72 Qilou towers',
    heroTag: 'More trip, less room',
    h1: 'Great-Value Hotels',
    subtitle: 'Clean, dependable bases that leave more of your budget for tickets, guides, and the good meals.',
    metaDesc: 'Great-value Zhangjiajie hotels — Homeinn Plus on Ziwu Road and Homeinn by the 72 Qilou district.',
    intro: 'Value doesn’t mean compromise on the basics. Both deliver a comfortable, predictable night with the city’s eats and transit close by.',
    bodyIntro: 'Two dependable, easy-on-the-wallet bases in the city.',
    hubDesc: 'Dependable, budget-friendly stays in Zhangjiajie city.',
    faq: [
      { q: "Which area should I stay in?", a: "Wulingyuan puts you minutes from the park gates — best for early sunrise starts. Zhangjiajie city (Yongding) is better for the train station, airport and Tianmen Mountain." },
      { q: "Do you book hotels for me?", a: "We don’t take payment, but message us by email and we’ll recommend and help reserve the right stay for your dates — free, no obligation." },
      { q: "What’s the price range?", a: "From around ¥130/night at value stays to ¥600+ at scenic-view and international hotels. Peak season (May–Oct and holidays) books out early — reserve ahead." },
    ],
    cardTitle: 'Value Hotels',
    cardDesc: 'Comfortable rooms that save your budget',
    cardImg: 'hotel-homeinn-plus-1',
    cardAlt: 'Great-value hotels in Zhangjiajie',
    navLabel: '💡 Value Hotels',
    hotels: ['homeinn-plus', '72qilou'],
  },
  {
    slug: 'by-area',
    title: 'City & By-Area Stays',
    tag: 'Transit hub',
    heroImg: 'hotel-huatian-1',
    heroAlt: 'Huatiancheng city-centre suites',
    heroTag: 'City base',
    h1: 'City & By-Area Stays',
    subtitle: 'Suite-style bases in the city centre — best when trains, the airport, and a kitchen matter more than a mountain view.',
    metaDesc: 'City-centre Zhangjiajie stays — spacious Huatiancheng suites close to transit and dining.',
    intro: 'For families and longer trips, a city base with space and transit access often beats a scenic but remote room. Huatiancheng gives you suites in the centre.',
    bodyIntro: 'Apartment-style suites for travellers who want space and a central address.',
    hubDesc: 'Spacious city-centre suites close to transit and dining.',
    faq: [
      { q: "Which area should I stay in?", a: "Wulingyuan puts you minutes from the park gates — best for early sunrise starts. Zhangjiajie city (Yongding) is better for the train station, airport and Tianmen Mountain." },
      { q: "Do you book hotels for me?", a: "We don’t take payment, but message us by email and we’ll recommend and help reserve the right stay for your dates — free, no obligation." },
      { q: "What’s the price range?", a: "From around ¥130/night at value stays to ¥600+ at scenic-view and international hotels. Peak season (May–Oct and holidays) books out early — reserve ahead." },
    ],
    cardTitle: 'By Area',
    cardDesc: 'City centre · Wulingyuan · park gates',
    cardImg: 'hotel-huatian-1',
    cardAlt: 'Hotels by area in Zhangjiajie city',
    navLabel: '📍 By Area',
    hotels: ['huatian'],
  },
];
