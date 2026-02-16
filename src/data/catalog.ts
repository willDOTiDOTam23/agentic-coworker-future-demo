import { OptionItem, Region, Terrain, VanModel } from "../types";

export const regions: Region[] = ["NW", "CA", "CO", "FL"];
export const terrains: Terrain[] = ["mountain", "beach", "forest", "winter", "city", "water"];

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
  }
];
