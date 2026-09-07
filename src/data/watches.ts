import { Product } from '../types';

export const WATCH_COLLECTIONS = [
  { id: 'all', label: 'All Timepieces' },
  { id: 'chronograph', label: 'Chronographs' },
  { id: 'dress', label: 'Dress & Minimalist' },
  { id: 'gold', label: 'Gold Editions' },
  { id: 'diver', label: 'Nautical & Divers' },
  { id: 'tourbillon', label: 'Grand Complications' },
] as const;

export const WATCHES: Product[] = [
  {
    id: 'titanium-precision',
    reference: 'VEL-084-TP',
    name: 'TITANIUM PRECISION',
    category: 'Luxury Watches',
    collection: 'chronograph',
    price: 886.00,
    rating: 4.9,
    reviewsCount: 38,
    isBestseller: true,
    images: [
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1000&q=85',
      'https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=1000&q=85',
      'https://images.unsplash.com/photo-1508057198894-247b23fe5ade?auto=format&fit=crop&w=1000&q=85'
    ],
    colors: [
      { name: 'Cobalt Blue', hex: '#1e3a8a', image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1000&q=85' },
      { name: 'Onyx Silver', hex: '#94a3b8', image: 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=1000&q=85' },
      { name: 'Obsidian Noir', hex: '#18181b', image: 'https://images.unsplash.com/photo-1508057198894-247b23fe5ade?auto=format&fit=crop&w=1000&q=85' }
    ],
    specs: {
      diameter: '42 mm',
      thickness: '11.8 mm',
      movement: 'Swiss Mechanical Automatic',
      calibre: 'Calibre V-880 Chrono',
      powerReserve: '68 Hours',
      waterResistance: '100m / 10 ATM',
      caseMaterial: 'Grade 5 Aerospace Titanium',
      glass: 'Double-Domed Sapphire Crystal with AR Coating',
      strap: 'Hand-Finished Titanium Milanese Mesh'
    },
    description: 'Engineered for uncompromising accuracy, the Titanium Precision unites featherweight titanium with a high-beat column-wheel chronograph movement. The sunburst cobalt dial catches light with architectural grace.'
  },
  {
    id: 'timeless-beauty',
    reference: 'VEL-102-TB',
    name: 'TIMELESS BEAUTY',
    category: 'Luxury Watches',
    collection: 'dress',
    price: 887.00,
    priceRange: '$887.00 – $894.00',
    rating: 5.0,
    reviewsCount: 42,
    images: [
      'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1000&q=85',
      'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1000&q=85',
      'https://images.unsplash.com/photo-1533139502658-0198f920d8e8?auto=format&fit=crop&w=1000&q=85'
    ],
    colors: [
      { name: 'Ivory Sand', hex: '#d9cbb7', image: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1000&q=85' },
      { name: 'Emerald Velvet', hex: '#1b4332', image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1000&q=85' }
    ],
    specs: {
      diameter: '39 mm',
      thickness: '8.4 mm (Ultra-Thin)',
      movement: 'In-House Hand-Wound Manufacture',
      calibre: 'Calibre V-200 Slim',
      powerReserve: '55 Hours',
      waterResistance: '50m / 5 ATM',
      caseMaterial: '18K Yellow Gold Polished',
      glass: 'Scratch-Proof Flat Sapphire',
      strap: 'Italian Full-Grain Suede Calfskin'
    },
    description: 'An ode to pure horological minimalism. A satin warm enamel dial framed by a slim 18k gold bezel, complemented by a supple handcrafted calfskin strap for timeless formal wear.'
  },
  {
    id: 'energy-of-the-sun',
    reference: 'VEL-310-ES',
    name: 'ENERGY OF THE SUN',
    category: 'Luxury Watches',
    collection: 'dress',
    price: 471.00,
    rating: 4.8,
    reviewsCount: 29,
    images: [
      'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1000&q=85',
      'https://images.unsplash.com/photo-1547996160-71dfabb19283?auto=format&fit=crop&w=1000&q=85'
    ],
    colors: [
      { name: 'Solar Pearl', hex: '#ede8df', image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1000&q=85' },
      { name: 'Rose Dawn', hex: '#e2b49a', image: 'https://images.unsplash.com/photo-1547996160-71dfabb19283?auto=format&fit=crop&w=1000&q=85' }
    ],
    specs: {
      diameter: '40 mm',
      thickness: '9.2 mm',
      movement: 'Swiss High-Torque Automatic',
      calibre: 'Calibre V-340 Solar',
      powerReserve: '72 Hours',
      waterResistance: '50m / 5 ATM',
      caseMaterial: 'Surgical Stainless Steel 316L',
      glass: 'Anti-Glare Sapphire Crystal',
      strap: 'White Textured Tuscan Leather'
    },
    description: 'Capturing the luminous glow of dawn. Features a radiant pearl white dial and understated hour batons, powered by a 72-hour power reserve manufacture movement.'
  },
  {
    id: 'perfect-visibility',
    reference: 'VEL-405-PV',
    name: 'PERFECT VISIBILITY',
    category: 'Luxury Watches',
    collection: 'chronograph',
    price: 514.00,
    rating: 4.7,
    reviewsCount: 19,
    images: [
      'https://images.unsplash.com/photo-1539185441755-769473a23570?auto=format&fit=crop&w=1000&q=85',
      'https://images.unsplash.com/photo-1524592094714-0f0654e20314?auto=format&fit=crop&w=1000&q=85'
    ],
    colors: [
      { name: 'Glacier Silver', hex: '#cbd5e1', image: 'https://images.unsplash.com/photo-1539185441755-769473a23570?auto=format&fit=crop&w=1000&q=85' },
      { name: 'Midnight Matte', hex: '#0f172a', image: 'https://images.unsplash.com/photo-1524592094714-0f0654e20314?auto=format&fit=crop&w=1000&q=85' }
    ],
    specs: {
      diameter: '41 mm',
      thickness: '10.5 mm',
      movement: 'COSC Certified Chronometer',
      calibre: 'Calibre V-410 Chrono',
      powerReserve: '60 Hours',
      waterResistance: '100m / 10 ATM',
      caseMaterial: 'Brushed & Mirror Polished 316L Steel',
      glass: 'Sapphire Crystal with 7-Layer Internal AR',
      strap: 'Brushed Steel Oyster Link with Micro-Adjustment'
    },
    description: 'Engineered with high-contrast luminescent Super-LumiNova indexes and anti-reflective sapphire to guarantee legible reading in total darkness and underwater depths.'
  },
  {
    id: 'royal-heritage',
    reference: 'VEL-770-RH',
    name: 'ROYAL HERITAGE',
    category: 'Luxury Watches',
    collection: 'chronograph',
    price: 374.00,
    originalPrice: 480.00,
    rating: 4.9,
    reviewsCount: 64,
    images: [
      'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1000&q=85',
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1000&q=85'
    ],
    colors: [
      { name: 'Obsidian Black', hex: '#111827', image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1000&q=85' },
      { name: 'Steel Blue', hex: '#1e3a8a', image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1000&q=85' }
    ],
    specs: {
      diameter: '43 mm',
      thickness: '12.4 mm',
      movement: 'Precision Twin-Barrel Automatic',
      calibre: 'Calibre V-770 Heritage',
      powerReserve: '70 Hours',
      waterResistance: '150m / 15 ATM',
      caseMaterial: 'Dual-Tone 316L Stainless Steel',
      glass: 'High-Curve Box Sapphire Crystal',
      strap: 'Interchangeable Steel Link & Alligator Leather'
    },
    description: 'An imposing sport-luxury chronograph inspired by historic Swiss racing archives. Triple sub-dial layout with tachymeter scale, bi-directional bezel, and screw-down pushers.'
  },
  {
    id: 'strength-in-steel',
    reference: 'VEL-612-SS',
    name: 'STRENGTH IN STEEL',
    category: 'Luxury Watches',
    collection: 'gold',
    price: 279.00,
    rating: 4.8,
    reviewsCount: 31,
    images: [
      'https://images.unsplash.com/photo-1533139502658-0198f920d8e8?auto=format&fit=crop&w=1000&q=85',
      'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1000&q=85'
    ],
    colors: [
      { name: 'Champagne Gold', hex: '#c5a059', image: 'https://images.unsplash.com/photo-1533139502658-0198f920d8e8?auto=format&fit=crop&w=1000&q=85' },
      { name: 'Espresso Bronze', hex: '#451a03', image: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1000&q=85' }
    ],
    specs: {
      diameter: '40 mm',
      thickness: '10.2 mm',
      movement: 'Swiss Mechanical Calibre Automatic',
      calibre: 'Calibre V-612 Gold',
      powerReserve: '50 Hours',
      waterResistance: '100m / 10 ATM',
      caseMaterial: '18K Yellow Gold PVD on Solid Steel',
      glass: 'Scratch-Resistant Sapphire Crystal',
      strap: 'Integrated Presidential 3-Link Gold Bracelet'
    },
    description: 'Uncompromising prestige meets everyday resilience. Features a chocolate-brown sunburst dial encased in a brushed and polished gold exterior with fluted bezel.'
  },
  {
    id: 'for-every-training',
    reference: 'VEL-920-ET',
    name: 'FOR EVERY TRAINING',
    category: 'Luxury Watches',
    collection: 'chronograph',
    price: 417.00,
    priceRange: '$417.00 – $887.00',
    rating: 4.9,
    reviewsCount: 45,
    images: [
      'https://images.unsplash.com/photo-1508057198894-247b23fe5ade?auto=format&fit=crop&w=1000&q=85',
      'https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=1000&q=85'
    ],
    colors: [
      { name: 'British Racing Green', hex: '#166534', image: 'https://images.unsplash.com/photo-1508057198894-247b23fe5ade?auto=format&fit=crop&w=1000&q=85' },
      { name: 'Burgundy Crimson', hex: '#881337', image: 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=1000&q=85' }
    ],
    specs: {
      diameter: '42 mm',
      thickness: '11.5 mm',
      movement: 'Swiss Flyback Chronograph Calibre',
      calibre: 'Calibre V-920 Sport',
      powerReserve: '64 Hours',
      waterResistance: '200m / 20 ATM',
      caseMaterial: 'Surgical Steel 316L with Ceramic Bezel',
      glass: 'Domed Sapphire Crystal with AR Coating',
      strap: 'Steel Milanese Fine Weave Band'
    },
    description: 'Designed for the gentleman sportsman. The vivid racing green lacquer dial is balanced with polished silver numerals and high-efficiency flyback chronograph complication.'
  },
  {
    id: 'luxury-in-silver',
    reference: 'VEL-550-LS',
    name: 'LUXURY IN SILVER',
    category: 'Luxury Watches',
    collection: 'diver',
    price: 614.00,
    rating: 4.8,
    reviewsCount: 22,
    images: [
      'https://images.unsplash.com/photo-1547996160-71dfabb19283?auto=format&fit=crop&w=1000&q=85',
      'https://images.unsplash.com/photo-1508057198894-247b23fe5ade?auto=format&fit=crop&w=1000&q=85'
    ],
    colors: [
      { name: 'Emerald Wave', hex: '#065f46', image: 'https://images.unsplash.com/photo-1547996160-71dfabb19283?auto=format&fit=crop&w=1000&q=85' },
      { name: 'Sterling Rhodium', hex: '#94a3b8', image: 'https://images.unsplash.com/photo-1508057198894-247b23fe5ade?auto=format&fit=crop&w=1000&q=85' }
    ],
    specs: {
      diameter: '41 mm',
      thickness: '11.0 mm',
      movement: 'Swiss Self-Winding In-House Calibre',
      calibre: 'Calibre V-550 Wave',
      powerReserve: '58 Hours',
      waterResistance: '300m / 30 ATM (Helium Valve)',
      caseMaterial: '904L Corrosion-Resistant Superalloy Steel',
      glass: 'Anti-Reflective Flat Sapphire',
      strap: 'Solid 904L Steel Bracelet with Extension Clasp'
    },
    description: 'The definitive luxury diver timepiece. Engineered from extreme-grade 904L steel with an emerald green sunburst face and ceramic unidirectional dive bezel.'
  },
  {
    id: 'accuracy-in-every-flight',
    reference: 'VEL-380-AF',
    name: 'ACCURACY IN EVERY FLIGHT',
    category: 'Luxury Watches',
    collection: 'dress',
    price: 279.00,
    rating: 4.9,
    reviewsCount: 53,
    images: [
      'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1000&q=85',
      'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1000&q=85'
    ],
    colors: [
      { name: 'Cognac Saddle', hex: '#9a3412', image: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1000&q=85' },
      { name: 'Havana Dark', hex: '#451a03', image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1000&q=85' }
    ],
    specs: {
      diameter: '38 mm',
      thickness: '8.8 mm',
      movement: 'Swiss Ultra-Thin Automatic',
      calibre: 'Calibre V-380 Aero',
      powerReserve: '48 Hours',
      waterResistance: '50m / 5 ATM',
      caseMaterial: '18K Rose Gold Ion Plated',
      glass: 'Sapphire Crystal Glass',
      strap: 'Cognac Saddle Calf Leather with Contrast Stitching'
    },
    description: 'Understated elegance crafted for world travelers and aeronauts. Features a warm eggshell dial, rose gold baton hands, and a butter-soft cognac saddle strap.'
  },
  {
    id: 'without-limits',
    reference: 'VEL-810-WL',
    name: 'WITHOUT LIMITS',
    category: 'Luxury Watches',
    collection: 'dress',
    price: 673.00,
    rating: 4.9,
    reviewsCount: 27,
    images: [
      'https://images.unsplash.com/photo-1533139502658-0198f920d8e8?auto=format&fit=crop&w=1000&q=85',
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1000&q=85'
    ],
    colors: [
      { name: 'Champagne Satin', hex: '#eab308', image: 'https://images.unsplash.com/photo-1533139502658-0198f920d8e8?auto=format&fit=crop&w=1000&q=85' },
      { name: 'Titanium Graphite', hex: '#64748b', image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1000&q=85' }
    ],
    specs: {
      diameter: '40 mm',
      thickness: '8.6 mm',
      movement: 'Swiss Automatic Date-Window Calibre',
      calibre: 'Calibre V-810 Horizon',
      powerReserve: '65 Hours',
      waterResistance: '50m / 5 ATM',
      caseMaterial: 'Polished 18K Yellow Gold',
      glass: 'Double Curved Sapphire Crystal',
      strap: 'Fine Textured Steel Mesh with Gold Accents'
    },
    description: 'A tribute to boundary-pushing horology. The golden concave dial features a discreet date aperture at 3 o\'clock, paired with a supple woven mesh bracelet.'
  },
  {
    id: 'urban-adventure',
    reference: 'VEL-940-UA',
    name: 'URBAN ADVENTURE',
    category: 'Luxury Watches',
    collection: 'chronograph',
    price: 576.00,
    rating: 4.8,
    reviewsCount: 34,
    images: [
      'https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=1000&q=85',
      'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1000&q=85'
    ],
    colors: [
      { name: 'Caramel Leather', hex: '#b45309', image: 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=1000&q=85' },
      { name: 'Midnight Alligator', hex: '#0f172a', image: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1000&q=85' }
    ],
    specs: {
      diameter: '42 mm',
      thickness: '12.1 mm',
      movement: 'Swiss Mechanical Automatic Chronograph',
      calibre: 'Calibre V-940 Urban',
      powerReserve: '60 Hours',
      waterResistance: '100m / 10 ATM',
      caseMaterial: '316L Stainless Steel with Satin Finish',
      glass: 'Scratch-Proof Domed Sapphire',
      strap: 'Hand-Cut Italian Saddle Leather'
    },
    description: 'Equally refined in executive boardrooms or transcontinental journeys. High-precision 60-second and 30-minute registers with vintage caramel saddle stitching.'
  },
  {
    id: 'top-masters-of-horology',
    reference: 'VEL-999-TM',
    name: 'TOP MASTERS OF HOROLOGY',
    category: 'Luxury Watches',
    collection: 'gold',
    price: 379.00,
    originalPrice: 520.00,
    rating: 5.0,
    reviewsCount: 78,
    isBestseller: true,
    images: [
      'https://images.unsplash.com/photo-1533139502658-0198f920d8e8?auto=format&fit=crop&w=1000&q=85',
      'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1000&q=85'
    ],
    colors: [
      { name: 'Pure 18K Yellow Gold', hex: '#c8a25c', image: 'https://images.unsplash.com/photo-1533139502658-0198f920d8e8?auto=format&fit=crop&w=1000&q=85' },
      { name: 'Warm Rose Gold', hex: '#d97706', image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1000&q=85' }
    ],
    specs: {
      diameter: '39 mm',
      thickness: '7.9 mm',
      movement: 'Grand Complication Swiss Automatic',
      calibre: 'Calibre V-999 Master',
      powerReserve: '80 Hours (Twin-Barrel)',
      waterResistance: '50m / 5 ATM',
      caseMaterial: 'Solid 18K Yellow Gold Case',
      glass: 'Sapphire Crystal with Anti-Reflective Coating',
      strap: '18K Yellow Gold Intricate Mesh Bracelet'
    },
    description: 'The pinnacle of the Vellor Atelier. Cast entirely in luminous 18k yellow gold with a seamless woven gold bracelet and exhibition case back displaying perlage finishing.'
  },
  {
    id: 'the-power-in-black',
    reference: 'VEL-702-PB',
    name: 'THE POWER IN BLACK',
    category: 'Luxury Watches',
    collection: 'dress',
    price: 968.00,
    rating: 4.9,
    reviewsCount: 36,
    images: [
      'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1000&q=85',
      'https://images.unsplash.com/photo-1547996160-71dfabb19283?auto=format&fit=crop&w=1000&q=85'
    ],
    colors: [
      { name: 'British Forest Green', hex: '#14532d', image: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1000&q=85' },
      { name: 'Stealth Matte Black', hex: '#0a0a0a', image: 'https://images.unsplash.com/photo-1547996160-71dfabb19283?auto=format&fit=crop&w=1000&q=85' }
    ],
    specs: {
      diameter: '40 mm',
      thickness: '8.9 mm',
      movement: 'Swiss Certified Manufacture Automatic',
      calibre: 'Calibre V-702 Imperial',
      powerReserve: '72 Hours',
      waterResistance: '100m / 10 ATM',
      caseMaterial: '18K Rose Gold with DLC Coating Accents',
      glass: 'Curved Sapphire Crystal with Anti-Glare',
      strap: 'Forest Green Genuine Alligator Leather'
    },
    description: 'A commanding presence on the wrist. Blends an 18K rose gold bezel with a rich deep-forest alligator strap, representing modern aristocracy and horological mastery.'
  },
  {
    id: 'gold-for-generations',
    reference: 'VEL-888-GG',
    name: 'GOLD FOR GENERATIONS',
    category: 'Luxury Watches',
    collection: 'gold',
    price: 388.00,
    rating: 5.0,
    reviewsCount: 91,
    isBestseller: true,
    images: [
      'https://images.unsplash.com/photo-1533139502658-0198f920d8e8?auto=format&fit=crop&w=1000&q=85',
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1000&q=85'
    ],
    colors: [
      { name: 'Imperial 18K Gold', hex: '#c8a25c', image: 'https://images.unsplash.com/photo-1533139502658-0198f920d8e8?auto=format&fit=crop&w=1000&q=85' },
      { name: 'Platinum Silver', hex: '#e2e8f0', image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1000&q=85' }
    ],
    specs: {
      diameter: '40 mm',
      thickness: '9.8 mm',
      movement: 'Chronometer-Grade Automatic Calibre',
      calibre: 'Calibre V-888 Heirloom',
      powerReserve: '75 Hours',
      waterResistance: '100m / 10 ATM',
      caseMaterial: '18K Solid Gold & 316L Core',
      glass: 'Sapphire Crystal with Cyclops Date Lens',
      strap: '5-Piece Jubilee Gold Link Bracelet'
    },
    description: 'Created to be passed down through dynasties. An heirloom timepiece featuring a sunray champagne dial, diamond hour markers, and five-piece jubilee link band.'
  },
  {
    id: 'explore-the-deep',
    reference: 'VEL-159-ED',
    name: 'EXPLORE THE DEEP',
    category: 'Luxury Watches',
    collection: 'diver',
    price: 159.00,
    originalPrice: 220.00,
    rating: 4.8,
    reviewsCount: 44,
    images: [
      'https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=1000&q=85',
      'https://images.unsplash.com/photo-1508057198894-247b23fe5ade?auto=format&fit=crop&w=1000&q=85'
    ],
    colors: [
      { name: 'Glacier White', hex: '#f8fafc', image: 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=1000&q=85' },
      { name: 'Abyss Navy', hex: '#0f172a', image: 'https://images.unsplash.com/photo-1508057198894-247b23fe5ade?auto=format&fit=crop&w=1000&q=85' }
    ],
    specs: {
      diameter: '41 mm',
      thickness: '11.2 mm',
      movement: 'Swiss Automatic Day-Date Calibre',
      calibre: 'Calibre V-159 Nautical',
      powerReserve: '52 Hours',
      waterResistance: '200m / 20 ATM',
      caseMaterial: 'Surgical Grade 316L Brushed Steel',
      glass: 'Sapphire Crystal Glass',
      strap: 'Comfort-Fit Stainless Steel Mesh'
    },
    description: 'Engineered for ocean exploration with day-date complication at 12 and 3 o\'clock. Clean silver-white guilloché dial protected by an airtight monolithic steel case.'
  },
  {
    id: 'waterproof-to-perfection',
    reference: 'VEL-344-WP',
    name: 'WATERPROOF TO PERFECTION',
    category: 'Luxury Watches',
    collection: 'diver',
    price: 344.00,
    rating: 4.9,
    reviewsCount: 67,
    images: [
      'https://images.unsplash.com/photo-1508057198894-247b23fe5ade?auto=format&fit=crop&w=1000&q=85',
      'https://images.unsplash.com/photo-1533139502658-0198f920d8e8?auto=format&fit=crop&w=1000&q=85'
    ],
    colors: [
      { name: 'British Racing Green & Gold', hex: '#15803d', image: 'https://images.unsplash.com/photo-1508057198894-247b23fe5ade?auto=format&fit=crop&w=1000&q=85' },
      { name: 'Deep Sea Black & Gold', hex: '#0a0a0a', image: 'https://images.unsplash.com/photo-1533139502658-0198f920d8e8?auto=format&fit=crop&w=1000&q=85' }
    ],
    specs: {
      diameter: '42 mm',
      thickness: '12.0 mm',
      movement: 'Swiss Chronometer Calibre',
      calibre: 'Calibre V-344 Marine',
      powerReserve: '70 Hours',
      waterResistance: '300m / 30 ATM',
      caseMaterial: '18K Yellow Gold PVD with Ceramic Unidirectional Bezel',
      glass: 'Ultra-Tough Sapphire Crystal with Inner AR',
      strap: 'Solid Gold PVD Heavy Link with Diver Extension'
    },
    description: 'The marriage of opulent gold luxury and deep oceanic survival. Features a vibrant emerald green dial with golden luminescent hands and a 300m water resistance rating.'
  }
];
