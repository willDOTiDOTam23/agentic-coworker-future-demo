import {
  AccessoryConfig,
  ConfiguratorProfile,
  Drivetrain,
  ExteriorConfig,
  ExteriorPaint,
  InteriorConfig,
  InteriorLevel,
  OptionItem,
  PowerConfig,
  Region,
  RoofRackStyle,
  Terrain,
  VanModel,
  VanTemplate,
  VisualAssetRecord,
  VisualTaxonomy,
  VisualRightsMetadata,
  WheelStyle,
  LightStyle,
  LifestyleMode
} from "../types.js";

export interface ExteriorCatalogItem {
  id: string;
  label: string;
}

export interface ExteriorSelectionCatalog {
  paintColors: Array<ExteriorCatalogItem & { value: ExteriorPaint; hex: string }>;
  roofRacks: Array<ExteriorCatalogItem & { value: RoofRackStyle; description: string }>;
  wheels: Array<ExteriorCatalogItem & { value: WheelStyle; terrainHint: string }>;
  lights: Array<ExteriorCatalogItem & { value: LightStyle; description: string }>;
}

export interface InteriorCatalogItem {
  id: string;
  label: string;
  style: InteriorLevel;
  description: string;
}

export interface LifestyleCatalogItem {
  id: string;
  label: string;
  style: LifestyleMode;
}

export interface PowerCatalogItem {
  id: string;
  label: string;
  style: Drivetrain;
  description: string;
}

export const regions: Region[] = ["NW", "CA", "CO", "FL"];
export const terrains: Terrain[] = ["mountain", "beach", "forest", "winter", "city", "water"];

const visualStylePrompt = "Cinematic stylized realism and hyper-real CGI for adventure vehicles, matte painting and concept-art composition, clean architectural product rendering language, cinematic color grading, coherent outdoor palette, polished materials, no text, no people, no photoreal, no cartoon style.";
const visualPalette = "cohesive muted earth and forest palette with warm dune accents, deep graphite, silver-gray metal accents, matte greens, and restrained peach highlights.";

function makeVisualPrompt(role: string, signature: string, details: string, styleHint = "muted-adventure-suite") {
  return `${visualStylePrompt} Reference style family: ${styleHint}. Palette: ${visualPalette}. ${role}: ${signature}. ${details}.`;
}

function makeVisualAsset(
  assetId: string,
  assetType: "template" | "option",
  imagePath: string,
  role: string,
  signature: string,
  details: string,
  styleHint: string,
  provenance: {
    sourceUrl?: string;
    license?: "unsplash" | "pexels" | "pixabay" | "cc0" | "other";
    attributionRequired?: boolean;
    sourceNote?: string;
  } = {},
  taxonomyOverrides: Partial<VisualTaxonomy> = {}
): VisualAssetRecord {
    const defaultTaxonomy: VisualTaxonomy = {
      subjectType: assetType === "template" ? "van_exterior" : "accessory_detail",
      sceneType: assetType === "template" ? "hero" : "detail",
      accessoryType: assetType === "template" ? "none" : "unknown",
      angle: assetType === "template" ? "front_three_quarter" : "close_up",
      environment: assetType === "template" ? "mountain" : "studio",
      lighting: "daylight",
      occupancySignal: "empty_scene",
      colorway: "mixed",
      styleTone: assetType === "template" ? "premium" : "minimal",
      qualityScore: 76
    };

    const rights: VisualRightsMetadata = {
      owner: "Demo stock source",
      usageScope: "local-demo",
      attributionRequired: Boolean(provenance.attributionRequired),
      source: provenance.sourceUrl ?? provenance.sourceNote ?? "catalog-seed"
    };

    return {
      assetId,
      assetType,
      imagePath,
      prompt: makeVisualPrompt(role, signature, details, styleHint),
      taxonomy: {
        ...defaultTaxonomy,
        ...taxonomyOverrides
      },
      rights,
      sourceUrl: provenance.sourceUrl,
      license: provenance.license,
      attributionRequired: provenance.attributionRequired,
      sourceNote: provenance.sourceNote,
      style: {
        prompt: makeVisualPrompt(role, signature, details, styleHint),
        styleKey: styleHint,
        seedHint: "adventure-v1",
        generatedAt: "2026-02-17T00:00:00.000Z",
        modelHint: "dall-e-3",
        palette: visualPalette,
        sourceUrl: provenance.sourceUrl,
        license: provenance.license,
        attributionRequired: provenance.attributionRequired,
        sourceNote: provenance.sourceNote
      }
    };
  }

export const vans: VanModel[] = [
  {
    id: "aether-glider",
    name: "Aether Glider 4x4",
    basePrice: 79000,
    maxOccupancy: 4,
    rangeKm: 540,
    terrains: ["mountain", "forest", "city", "winter", "beach"],
    regions: ["CO", "NW", "CA"],
    features: ["Solar Array", "Snowmobile Tracks", "Roof Rail Modular", "Remote Climate Pods"],
    tags: ["tracks", "winter", "camping", "modular", "range"],
    imageHint: "4x4 van with bright cargo rack"
  },
  {
    id: "aquilo-orca",
    name: "Aquila Orca",
    basePrice: 86500,
    maxOccupancy: 3,
    rangeKm: 430,
    terrains: ["beach", "forest", "water", "city"],
    regions: ["CA", "FL", "NW"],
    features: ["Water-Tight Hull Kit", "Retractable Paddle Assist", "Salt-Resistant Shell", "All-Weather Lounge"],
    tags: ["water", "amphibious", "beach", "family", "adventure"],
    imageHint: "camper with side-mounted water fins"
  },
  {
    id: "volt-sprinter",
    name: "Volt Sprinter Forge",
    basePrice: 94000,
    maxOccupancy: 5,
    rangeKm: 640,
    terrains: ["city", "forest", "mountain", "winter"],
    regions: ["CA", "CO", "NW", "FL"],
    features: ["Fast Charge", "Smart Camp OS", "Cargo Spine", "Quiet Ride"],
    tags: ["electric", "family", "long-range", "tech-forward"],
    imageHint: "sleek electric adventure van profile"
  },
  {
    id: "magma-hopper",
    name: "Magma Hopper",
    basePrice: 72000,
    maxOccupancy: 2,
    rangeKm: 390,
    terrains: ["mountain", "forest", "winter", "city"],
    regions: ["CO", "NW"],
    features: ["Rugged Exterior", "Ultra Light Frame", "Quick-Tow Rack"],
    tags: ["offgrid", "lightweight", "tracks", "offroad"],
    imageHint: "compact offroad van with bright yellow trim"
  },
  {
    id: "storm-reef-ranger",
    name: "Storm Reef Ranger",
    basePrice: 109000,
    maxOccupancy: 4,
    rangeKm: 610,
    terrains: ["beach", "water", "forest", "city"],
    regions: ["CA", "FL", "NW", "CO"],
    features: ["HydroJet Assist", "Reinforced Axle", "Auto Deck Lock", "Dual-Deck Sleep"],
    tags: ["water", "family", "amphibious", "adventure"],
    imageHint: "van in surf-ready mode with side floats"
  },
  {
    id: "aurora-arc",
    name: "Aurora Arc 7",
    basePrice: 128000,
    maxOccupancy: 6,
    rangeKm: 700,
    terrains: ["city", "mountain", "forest", "winter", "beach", "water"],
    regions: ["CA", "CO", "FL", "NW"],
    features: ["Autosteer Assist", "Cold-Weather Pod", "Modular Water Skis", "Solar Skin"],
    tags: ["electric", "luxury", "family", "water", "winter", "tracks", "camping"],
    imageHint: "luxury camper with dramatic LED trim"
  }
];

export const options: OptionItem[] = [
  {
    id: "option-snow-traction",
    name: "Snowmobile Tracks",
    description: "Magnetic track pack for hard-snow and steep grades.",
    deltaPrice: 8200,
    category: "offroad",
    requiredTags: ["tracks"],
    incompatibleTags: ["water"],
    compatibilityNote: "Great in mountain/winter. Not approved for deep saltwater usage."
  },
  {
    id: "option-amphibious-kit",
    name: "Amphibious Water Glide Kit",
    description: "Adds amphibious mode and quick-seal undercarriage.",
    deltaPrice: 9600,
    category: "water",
    requiredTags: ["water"],
    incompatibleTags: ["winter"],
    compatibilityNote: "Requires water-safe body handling and crew comfort mode."
  },
  {
    id: "option-solar-canopy",
    name: "Solar Canopy Array",
    description: "Retractable solar roof for daytime charging and shade.",
    deltaPrice: 4500,
    category: "comfort",
    requiredTags: [],
    incompatibleTags: [],
    compatibilityNote: "No known conflicts."
  },
  {
    id: "option-family-safety",
    name: "Family Command Pod",
    description: "Dual-screen command console with kid-safe quick-alert logic.",
    deltaPrice: 2800,
    category: "comfort",
    requiredTags: [],
    incompatibleTags: [],
    compatibilityNote: "Best fit for family-oriented flows."
  },
  {
    id: "option-offroad-cabin",
    name: "Rapid Lift Camp Cabin",
    description: "Pop-up elevated cabin with quick set-up tent frame.",
    deltaPrice: 5200,
    category: "comfort",
    requiredTags: ["offroad", "family"],
    incompatibleTags: [],
    compatibilityNote: "Pairs best with offroad-capable layouts."
  },
  {
    id: "option-titan-clamp",
    name: "Titan Tow Clamp Pack",
    description: "Heavy-duty rear package for long haulers and cargo trailers.",
    deltaPrice: 3900,
    category: "propulsion",
    requiredTags: [],
    incompatibleTags: [],
    compatibilityNote: "Pairs with family and utility builds."
  },
  {
    id: "option-lake-mode",
    name: "Lake Mode Thrusters",
    description: "Adds stabilization jets for dock launches and shallow-water exits.",
    deltaPrice: 7600,
    category: "water",
    requiredTags: ["water"],
    incompatibleTags: ["winter"],
    compatibilityNote: "Requires certified water-sealed wheels and calm-weather confidence."
  },
  {
    id: "option-quiet-cab",
    name: "QuietPod Climate Shell",
    description: "Whisper-quiet climate and cabin isolation for nighttime comfort.",
    deltaPrice: 3700,
    category: "comfort",
    requiredTags: [],
    incompatibleTags: [],
    compatibilityNote: "Popular with family and overnight trips."
  },
  {
    id: "option-solar-panels",
    name: "Solar Panels",
    description: "Roof-integrated solar rig with optimized camping power routing.",
    deltaPrice: 2800,
    category: "comfort",
    requiredTags: [],
    incompatibleTags: [],
    compatibilityNote: "Great for off-grid, low-noise builds.",
    imagePath: "/assets/accessories/solar-panels.png"
  },
  {
    id: "option-shower-module",
    name: "Shower & Compost Kit",
    description: "Compact hot-water shower module with privacy shell and refill port.",
    deltaPrice: 3900,
    category: "comfort",
    requiredTags: [],
    incompatibleTags: [],
    compatibilityNote: "Adds comfort-focused utility.",
    imagePath: "/assets/accessories/shower-module.png"
  },
  {
    id: "option-portable-fridge",
    name: "Large Fridge Module",
    description: "120V/12V fridge with smart-temp cycling.",
    deltaPrice: 2200,
    category: "comfort",
    requiredTags: [],
    incompatibleTags: [],
    compatibilityNote: "Best paired with solar or hybrid systems.",
    imagePath: "/assets/accessories/fridge-module.png"
  },
  {
    id: "option-bike-rack",
    name: "Bike Rack",
    description: "Rear-rail rack for bikes or compact cargo.",
    deltaPrice: 2100,
    category: "offroad",
    requiredTags: [],
    incompatibleTags: [],
    compatibilityNote: "Keep wheel clearance in mind for long cargo loads.",
    imagePath: "/assets/accessories/bike-rack.png"
  },
  {
    id: "option-ski-rack",
    name: "Ski / Snowboard Rack",
    description: "Roof-forward rack with reinforced lock points.",
    deltaPrice: 2600,
    category: "offroad",
    requiredTags: ["winter"],
    incompatibleTags: ["water"],
    compatibilityNote: "Avoid in deep-salt or surf conditions.",
    imagePath: "/assets/accessories/ski-rack.png"
  },
  {
    id: "option-gear-locker",
    name: "Lock-Down Gear Locker",
    description: "Secure under-seat locker with tamper-resistant lock.",
    deltaPrice: 1800,
    category: "comfort",
    requiredTags: [],
    incompatibleTags: [],
    compatibilityNote: "Useful for long road and overnight trips.",
    imagePath: "/assets/accessories/gear-locker.png"
  }
];

export const vanTemplates: VanTemplate[] = [
  {
    id: "template-sable-escape",
    title: "Sable Escape",
    description: "A cinematic matte-glow runner for beach-to-forest escapes with a smart rear camp kit.",
    imagePath: "/assets/van-styles/sable-escape.png",
    imagePrompt: makeVisualPrompt(
      "adventure van concept",
      "Template 1",
      "A coastal-to-forest adventure van on a lifted stance, with soft horizon glow, clean matte paneling, compact roof camp canopy, and matte finish. Clean side lighting with cinematic atmosphere."
    ),
    tags: ["beach", "family", "lifestyle", "electric"],
    styleHint: "warm-horizon matte",
    imageStyleKey: "muted-adventure-suite"
  },
  {
    id: "template-ridge-ramble",
    title: "Ridge Ramble",
    description: "Built for true-adventure lanes, steep turns, and cozy campfire nights.",
    imagePath: "/assets/van-styles/ridge-ramble.png",
    imagePrompt: makeVisualPrompt(
      "adventure van concept",
      "Template 2",
      "A mountain-road explorer with rugged body lines, integrated roof rails, tire protection trim, and matte off-road stance. Warm dusk haze and restrained green/earth tones."
    ),
    tags: ["mountain", "tracks", "adventure"],
    styleHint: "muted-green matte",
    imageStyleKey: "muted-adventure-suite"
  },
  {
    id: "template-dune-nomad",
    title: "Dune Nomad",
    description: "A stylish all-road interior-forward setup for remote scouting and digital work.",
    imagePath: "/assets/van-styles/dune-nomad.png",
    imagePrompt: makeVisualPrompt(
      "adventure van concept",
      "Template 3",
      "A modern road-and-remote explorer with cool matte finish, angular roof geometry, and understated work-ready silhouette. Night-leaning light tones, cinematic reflections."
    ),
    tags: ["winter", "city", "digital", "work-from-home"],
    styleHint: "cool-gray concept",
    imageStyleKey: "muted-adventure-suite"
  },
  {
    id: "template-lumina-lounger",
    title: "Luminis Lounger",
    description: "Relax-first luxury shell with premium interior comfort and night-ready accents.",
    imagePath: "/assets/van-styles/luminis-lounger.png",
    imagePrompt: makeVisualPrompt(
      "adventure van concept",
      "Template 4",
      "A luxury-focused van with premium roofline, plush silhouette accents, and softly luminous interior glow under warm night light. Clean materials and premium architecture."
    ),
    tags: ["luxury", "relax", "family"],
    styleHint: "amber-night matte",
    imageStyleKey: "muted-adventure-suite"
  }
];

export const visualAssetManifest: VisualAssetRecord[] = [
  makeVisualAsset(
    "template-sable-escape",
    "template",
    "/assets/van-styles/sable-escape.png",
    "template concept card",
    "Sable Escape",
    "Beach-to-forest adventure shell with matte silver-beige finish and compact rear camp kit geometry.",
    "muted-adventure-suite",
    {
      sourceUrl: "https://images.pexels.com/photos/32378665/pexels-photo-32378665.jpeg?auto=compress&cs=tinysrgb&h=1000&w=1600",
      license: "pexels",
      attributionRequired: false,
      sourceNote: "Stock-first source. Quick visual pass found no visible logos."
    },
    {
      environment: "coastal",
      styleTone: "premium",
      colorway: "warm_sand",
      qualityScore: 84
    }
  ),
  makeVisualAsset(
    "template-ridge-ramble",
    "template",
    "/assets/van-styles/ridge-ramble.png",
    "template concept card",
    "Ridge Ramble",
    "Mountain-oriented expedition van with protective roof-rack architecture and subdued green-gray contrast.",
    "muted-adventure-suite",
    {
      sourceUrl: "https://images.pexels.com/photos/29710911/pexels-photo-29710911.jpeg?auto=compress&cs=tinysrgb&h=1000&w=1600",
      license: "pexels",
      attributionRequired: false,
      sourceNote: "Stock-first source. Quick visual pass found no visible logos."
    },
    {
      environment: "mountain",
      styleTone: "rugged",
      colorway: "olive",
      qualityScore: 82
    }
  ),
  makeVisualAsset(
    "template-dune-nomad",
    "template",
    "/assets/van-styles/dune-nomad.png",
    "template concept card",
    "Dune Nomad",
    "Road-and-remote explorer frame with cool gray palette and workstation-inclined profile.",
    "muted-adventure-suite",
    {
      sourceUrl: "https://images.pexels.com/photos/13134378/pexels-photo-13134378.jpeg?auto=compress&cs=tinysrgb&h=1000&w=1600",
      license: "pexels",
      attributionRequired: false,
      sourceNote: "Stock-first source. Quick visual pass found no visible logos."
    },
    {
      environment: "desert",
      styleTone: "minimal",
      colorway: "graphite",
      qualityScore: 80
    }
  ),
  makeVisualAsset(
    "template-lumina-lounger",
    "template",
    "/assets/van-styles/luminis-lounger.png",
    "template concept card",
    "Luminis Lounger",
    "Luxury, comfort-first adventure van with warm accent lighting and sculpted cabin form.",
    "muted-adventure-suite",
    {
      sourceUrl: "https://images.pexels.com/photos/5581740/pexels-photo-5581740.jpeg?auto=compress&cs=tinysrgb&h=1000&w=1600",
      license: "pexels",
      attributionRequired: false,
      sourceNote: "Stock-first source. Quick visual pass found no visible logos."
    },
    {
      environment: "urban",
      styleTone: "premium",
      colorway: "arctic_white",
      qualityScore: 83
    }
  ),
  makeVisualAsset(
    "option-solar-panels",
    "option",
    "/assets/accessories/solar-panels.png",
    "accessory module",
    "Roof solar rig",
    "Matte solar panels with clean fastener layout and low-profile cable routing integrated into roof profile.",
    "muted-adventure-suite",
    {
      sourceUrl: "https://images.pexels.com/photos/356049/pexels-photo-356049.jpeg?auto=compress&cs=tinysrgb&h=1000&w=1600",
      license: "pexels",
      attributionRequired: false,
      sourceNote: "Stock-first source. Quick visual pass found no visible logos."
    },
    {
      accessoryType: "solar_panels",
      environment: "studio",
      styleTone: "minimal",
      qualityScore: 79
    }
  ),
  makeVisualAsset(
    "option-shower-module",
    "option",
    "/assets/accessories/shower-module.png",
    "accessory module",
    "Shower kit",
    "Compact modular shower block with matte utility shell and restrained reflective highlights.",
    "muted-adventure-suite",
    {
      sourceUrl: "https://images.pexels.com/photos/29987674/pexels-photo-29987674.jpeg?auto=compress&cs=tinysrgb&h=1000&w=1600",
      license: "pexels",
      attributionRequired: false,
      sourceNote: "Stock-first source. Quick visual pass found no visible logos."
    },
    {
      accessoryType: "shower_module",
      environment: "studio",
      styleTone: "minimal",
      qualityScore: 78
    }
  ),
  makeVisualAsset(
    "option-portable-fridge",
    "option",
    "/assets/accessories/fridge-module.png",
    "accessory module",
    "Fridge module",
    "Integrated cooling pod with matte panel accents and clean front edge details.",
    "muted-adventure-suite",
    {
      sourceUrl: "https://images.pexels.com/photos/14841578/pexels-photo-14841578.jpeg?auto=compress&cs=tinysrgb&h=1000&w=1600",
      license: "pexels",
      attributionRequired: false,
      sourceNote: "Stock-first source. Quick visual pass found no visible logos."
    },
    {
      accessoryType: "fridge_module",
      environment: "studio",
      styleTone: "minimal",
      qualityScore: 77
    }
  ),
  makeVisualAsset(
    "option-bike-rack",
    "option",
    "/assets/accessories/bike-rack.png",
    "accessory module",
    "Bike rack",
    "Rear bike rack rail system with lock-ready loops and compact modular geometry.",
    "muted-adventure-suite",
    {
      sourceUrl: "https://images.pexels.com/photos/4061622/pexels-photo-4061622.jpeg?auto=compress&cs=tinysrgb&h=1000&w=1600",
      license: "pexels",
      attributionRequired: false,
      sourceNote: "Stock-first source. Quick visual pass found no visible logos."
    },
    {
      accessoryType: "bike_rack",
      environment: "studio",
      styleTone: "sport",
      qualityScore: 76
    }
  ),
  makeVisualAsset(
    "option-ski-rack",
    "option",
    "/assets/accessories/ski-rack.png",
    "accessory module",
    "Ski rack",
    "Roof-forward snow and board rack with reinforced tie-down geometry and matte reinforcement.",
    "muted-adventure-suite",
    {
      sourceUrl: "https://images.pexels.com/photos/7300959/pexels-photo-7300959.jpeg?auto=compress&cs=tinysrgb&h=1000&w=1600",
      license: "pexels",
      attributionRequired: false,
      sourceNote: "Stock-first source. Quick visual pass found no visible logos."
    },
    {
      accessoryType: "ski_rack",
      environment: "mountain",
      styleTone: "sport",
      qualityScore: 75
    }
  ),
  makeVisualAsset(
    "option-gear-locker",
    "option",
    "/assets/accessories/gear-locker.png",
    "accessory module",
    "Gear locker",
    "Under-seat secure storage shell with minimal locking linework and matte finish.",
    "muted-adventure-suite",
    {
      sourceUrl: "https://images.pexels.com/photos/30255828/pexels-photo-30255828.jpeg?auto=compress&cs=tinysrgb&h=1000&w=1600",
      license: "pexels",
      attributionRequired: false,
      sourceNote: "Stock-first source. Quick visual pass found no visible logos."
    },
    {
      accessoryType: "gear_locker",
      environment: "studio",
      styleTone: "minimal",
      qualityScore: 74
    }
  ),
  makeVisualAsset(
    "option-quiet-cab",
    "option",
    "/assets/accessories/accessory-default.svg",
    "accessory module fallback",
    "QuietPod cabin",
    "Fallback accessory concept tile for comfort modules when no dedicated tile exists.",
    "muted-adventure-suite",
    {},
    {
      accessoryType: "none",
      environment: "studio",
      styleTone: "minimal",
      qualityScore: 58
    }
  )
];

export const exteriorCatalog: ExteriorSelectionCatalog = {
  paintColors: [
    { id: "paint-warm-sand", label: "Warm Sand", value: "paint-warm-sand", hex: "#bfa17a" },
    { id: "paint-matte-graphite", label: "Matte Graphite", value: "paint-matte-graphite", hex: "#2e2e2e" },
    { id: "paint-forest-olive", label: "Forest Olive", value: "paint-forest-olive", hex: "#53624c" },
    { id: "paint-arctic-white", label: "Arctic White", value: "paint-arctic-white", hex: "#f7f2ea" }
  ],
  roofRacks: [
    { id: "rack-sleek", label: "Sleek Touring Rack", value: "rack-sleek", description: "Minimal silhouette with hidden fasteners." },
    { id: "rack-touring", label: "Touring Utility Rack", value: "rack-touring", description: "Wide-mount cargo platform with side loops." },
    { id: "rack-rugged", label: "Rugged Expedition Rack", value: "rack-rugged", description: "Extra-brace mount points and tie-down array." }
  ],
  wheels: [
    { id: "wheel-all-terrain", label: "All-Terrain Track Pack", value: "wheel-all-terrain", terrainHint: "mud, snow, gravel" },
    { id: "wheel-urban", label: "Urban Touring Tires", value: "wheel-urban", terrainHint: "pavement-first with light off-road support" },
    { id: "wheel-slick", label: "Performance Slick Kit", value: "wheel-slick", terrainHint: "highway and smooth terrain" }
  ],
  lights: [
    { id: "light-led", label: "LED Horizon Bars", value: "light-led", description: "Balanced brightness with clean diffused halo." },
    { id: "light-auxiliary", label: "Auxiliary Work Spotlights", value: "light-auxiliary", description: "Bright forward and side support lighting." },
    { id: "light-spotlight", label: "Dual Spot Array", value: "light-spotlight", description: "High-lumen directional spot stack." }
  ]
};

export const interiorCatalog: InteriorCatalogItem[] = [
  { id: "basic-empty", label: "Basic Empty", style: "basic-empty", description: "Clean shell and flexible surfaces only." },
  { id: "minimal-build-out", label: "Minimal Build-Out", style: "minimal-build-out", description: "Simple bed and storage with compact kitchen essentials." },
  { id: "moderate-build-out", label: "Moderate Build-Out", style: "moderate-build-out", description: "Comfort seats, fold-down galley, and improved storage." },
  { id: "ultra-luxury-build-out", label: "Ultra-Luxury Build-Out", style: "ultra-luxury-build-out", description: "Full comfort package, private seating zones, and acoustic treatment." }
];

export const lifestyleCatalog: LifestyleCatalogItem[] = [
  { id: "true-adventure", label: "True Adventure", style: "true-adventure" },
  { id: "relax", label: "Relax & Retreat", style: "relax" },
  { id: "work-from-home", label: "Work from Home", style: "work-from-home" },
  { id: "play-hard", label: "Play Hard", style: "play-hard" },
  { id: "nomad", label: "Nomad", style: "nomad" },
  { id: "digital", label: "Digital Explorer", style: "digital" }
];

export const powerCatalog: PowerCatalogItem[] = [
  { id: "ic", label: "Internal Combustion", style: "internal-combustion", description: "Reliable range and proven refueling rhythm." },
  { id: "hybrid", label: "Hybrid", style: "hybrid", description: "Balanced power and lower noise in quiet zones." },
  { id: "ev", label: "All-Electric", style: "all-electric", description: "Zero-emission charge-first performance." }
];

const sampleTemplateProfile: ConfiguratorProfile = {
  exterior: {
    paintColor: "paint-forest-olive",
    roofRack: "rack-touring",
    wheels: "wheel-all-terrain",
    lights: "light-led"
  },
  interior: {
    level: "minimal-build-out",
    lifestyleMode: "true-adventure"
  },
  power: {
    drivetrain: "hybrid"
  },
  accessories: {
    selectedAccessoryIds: ["option-solar-panels", "option-portable-fridge"]
  },
  totalPrice: 0
};

export const templateStarterProfiles: Record<string, typeof sampleTemplateProfile> = {
  "template-sable-escape": sampleTemplateProfile,
  "template-ridge-ramble": {
    totalPrice: 0,
    exterior: {
      paintColor: "paint-forest-olive",
      roofRack: "rack-rugged",
      wheels: "wheel-all-terrain",
      lights: "light-spotlight"
    },
    interior: {
      level: "moderate-build-out",
      lifestyleMode: "true-adventure"
    },
    power: {
      drivetrain: "hybrid"
    },
    accessories: {
      selectedAccessoryIds: ["option-solar-panels", "option-titan-clamp"]
    }
  },
  "template-dune-nomad": {
    totalPrice: 0,
    exterior: {
      paintColor: "paint-matte-graphite",
      roofRack: "rack-sleek",
      wheels: "wheel-urban",
      lights: "light-auxiliary"
    },
    interior: {
      level: "ultra-luxury-build-out",
      lifestyleMode: "digital"
    },
    power: {
      drivetrain: "all-electric"
    },
    accessories: {
      selectedAccessoryIds: ["option-solar-panels", "option-portable-fridge", "option-quiet-cab"]
    }
  },
  "template-lumina-lounger": {
    totalPrice: 0,
    exterior: {
      paintColor: "paint-arctic-white",
      roofRack: "rack-sleek",
      wheels: "wheel-slick",
      lights: "light-led"
    },
    interior: {
      level: "ultra-luxury-build-out",
      lifestyleMode: "relax"
    },
    power: {
      drivetrain: "all-electric"
    },
    accessories: {
      selectedAccessoryIds: ["option-shower-module", "option-portable-fridge"]
    }
  }
};

export function getTemplateProfile(id?: string) {
  return templateStarterProfiles[id ?? ""] ?? sampleTemplateProfile;
}

export const defaultConfiguratorProfile: ConfiguratorProfile = {
  exterior: {
    paintColor: "paint-forest-olive",
    roofRack: "rack-touring",
    wheels: "wheel-all-terrain",
    lights: "light-led"
  },
  interior: {
    level: "minimal-build-out",
    lifestyleMode: "true-adventure"
  },
  power: {
    drivetrain: "hybrid"
  },
  accessories: {
    selectedAccessoryIds: []
  },
  totalPrice: 0
};
