import { z } from "zod";
import {
  STEP_DEFINITIONS,
  type ConfigurationSession,
  type ConfigurationValues,
  type LayoutZoneKind,
  type StepId,
  type VisualizationSpec
} from "./domain.js";

const DEFAULT_THEME = {
  paletteName: "Sunlit trail",
  backgroundLocked: false,
  backgroundA: "#f7e6c7",
  backgroundB: "#ebd7a4",
  accent: "#cf7b3f",
  accentAlt: "#3f7288",
  ink: "#182125",
  bodyColor: "#d7b892",
  cabinColor: "#f7f1e8"
} as const;

const PALETTE_LIBRARY = [
  {
    match: /forest|green|sage|moss/i,
    theme: {
      paletteName: "Forest calm",
      backgroundA: "#dce8dc",
      backgroundB: "#bfd4c0",
      accent: "#537857",
      accentAlt: "#d19a59",
      ink: "#18231d",
      bodyColor: "#6c876f",
      cabinColor: "#edf3ec"
    }
  },
  {
    match: /blue|ocean|storm|navy|coast/i,
    theme: {
      paletteName: "Coastal current",
      backgroundA: "#dbe8ef",
      backgroundB: "#bfd4df",
      accent: "#2f6f8b",
      accentAlt: "#d2874b",
      ink: "#16242c",
      bodyColor: "#56788f",
      cabinColor: "#f0f6f8"
    }
  },
  {
    match: /black|charcoal|graphite|night/i,
    theme: {
      paletteName: "Graphite horizon",
      backgroundA: "#e5e5e7",
      backgroundB: "#d1d4da",
      accent: "#4d5662",
      accentAlt: "#d08d55",
      ink: "#151a1d",
      bodyColor: "#69717b",
      cabinColor: "#f2f2f4"
    }
  },
  {
    match: /white|silver|alpine|glacier|stone/i,
    theme: {
      paletteName: "Alpine light",
      backgroundA: "#eff1f1",
      backgroundB: "#d8ddd9",
      accent: "#65808c",
      accentAlt: "#d29954",
      ink: "#172126",
      bodyColor: "#cfd5d5",
      cabinColor: "#fbfcfc"
    }
  },
  {
    match: /sand|beige|desert|clay|terra|bronze|copper/i,
    theme: {
      paletteName: "Desert heat",
      backgroundA: "#f3e1c8",
      backgroundB: "#dec094",
      accent: "#cf7744",
      accentAlt: "#54758a",
      ink: "#201d18",
      bodyColor: "#c9a27c",
      cabinColor: "#f6eee3"
    }
  }
] as const;

const ALLOWED_LAYOUT_ZONE_KINDS = [
  "driver",
  "passenger",
  "galley",
  "storage",
  "dinette",
  "bed",
  "bath",
  "utility"
] satisfies LayoutZoneKind[];

export const LayoutZoneSchema = z.object({
  kind: z.enum(ALLOWED_LAYOUT_ZONE_KINDS),
  x: z.number().int().min(0).max(11),
  y: z.number().int().min(0).max(5),
  w: z.number().int().min(1).max(12),
  h: z.number().int().min(1).max(6),
  label: z.string().trim().min(1).max(40),
  emphasis: z.enum(["primary", "secondary", "support"])
});

export const VisualizationSpecSchema = z.object({
  generatedBy: z.enum(["deterministic", "agent"]),
  updatedAt: z.string().datetime(),
  currentStep: z.enum(STEP_DEFINITIONS.map((step) => step.id) as [StepId, ...StepId[]]),
  theme: z.object({
    paletteName: z.string().trim().min(1).max(80),
    backgroundLocked: z.boolean(),
    backgroundA: z.string().trim().min(4).max(32),
    backgroundB: z.string().trim().min(4).max(32),
    accent: z.string().trim().min(4).max(32),
    accentAlt: z.string().trim().min(4).max(32),
    ink: z.string().trim().min(4).max(32),
    bodyColor: z.string().trim().min(4).max(32),
    cabinColor: z.string().trim().min(4).max(32)
  }),
  stepRail: z.array(
    z.object({
      step: z.enum(STEP_DEFINITIONS.map((step) => step.id) as [StepId, ...StepId[]]),
      label: z.string().trim().min(1).max(80),
      state: z.enum(["complete", "current", "upcoming"])
    })
  ),
  visionHighlights: z.object({
    title: z.string().trim().min(1).max(80),
    summary: z.string().trim().min(1).max(180),
    chips: z.array(z.string().trim().min(1).max(40)).max(6)
  }),
  exteriorScene: z.object({
    bodyColor: z.string().trim().min(4).max(32),
    finish: z.string().trim().min(1).max(40),
    wheelRadius: z.number().int().min(18).max(36),
    wheelStyle: z.string().trim().min(1).max(40),
    rackStyle: z.string().trim().min(1).max(40),
    auxLights: z.string().trim().min(1).max(40),
    powertrain: z.string().trim().min(1).max(40),
    driveSide: z.enum(["left", "right"]),
    frontSeatConfig: z.string().trim().min(1).max(60),
    roofGear: z.string().trim().min(1).max(60),
    rearCarrier: z.string().trim().min(1).max(60),
    ladder: z.boolean(),
    campLighting: z.string().trim().min(1).max(60),
    badges: z.array(z.string().trim().min(1).max(32)).max(4),
    overlays: z.array(z.string().trim().min(1).max(40)).max(8)
  }),
  interiorSwatches: z.object({
    fixtureColor: z.string().trim().min(1).max(40),
    primaryTexture: z.string().trim().min(1).max(40),
    secondaryTexture: z.string().trim().min(1).max(40),
    stitchingColor: z.string().trim().min(1).max(40),
    seatFinish: z.string().trim().min(1).max(40),
    notes: z.array(z.string().trim().min(1).max(40)).max(6)
  }),
  layoutFloorplan: z.object({
    gridColumns: z.literal(12),
    gridRows: z.literal(6),
    driveSide: z.enum(["left", "right"]),
    frontSeatConfig: z.string().trim().min(1).max(60),
    notes: z.array(z.string().trim().min(1).max(50)).max(6),
    zones: z.array(LayoutZoneSchema).min(4).max(8)
  }),
  gearScene: z.object({
    roofGear: z.string().trim().min(1).max(60),
    rearCarrier: z.string().trim().min(1).max(60),
    ladder: z.boolean(),
    powerModule: z.string().trim().min(1).max(60),
    campLighting: z.string().trim().min(1).max(60),
    modules: z.array(
      z.object({
        id: z.string().trim().min(1).max(40),
        label: z.string().trim().min(1).max(60),
        detail: z.string().trim().min(1).max(80),
        status: z.enum(["active", "optional", "inactive"])
      })
    )
  })
});

function now(): string {
  return new Date().toISOString();
}

function valueToText(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (typeof value === "boolean") {
    return value ? "yes" : "no";
  }

  if (Array.isArray(value)) {
    const items = value.map(valueToText).filter((item): item is string => Boolean(item));
    return items.length ? items.join(", ") : null;
  }

  return null;
}

function valueToList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(valueToText).filter((item): item is string => Boolean(item));
  }

  const text = valueToText(value);
  if (!text) return [];
  return text
    .split(/[;,/]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function pickValue(values: ConfigurationValues, ...keys: string[]) {
  for (const key of keys) {
    const value = values[key];
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return undefined;
}

function pickText(values: ConfigurationValues, ...keys: string[]): string | null {
  return valueToText(pickValue(values, ...keys));
}

function pickList(values: ConfigurationValues, ...keys: string[]): string[] {
  for (const key of keys) {
    const list = valueToList(values[key]);
    if (list.length) {
      return list;
    }
  }
  return [];
}

function normalizeDriveSide(value: string | null | undefined): "left" | "right" {
  return /right/i.test(value ?? "") ? "right" : "left";
}

function includesLike(value: string | null | undefined, ...needles: string[]) {
  const normalized = (value ?? "").toLowerCase();
  return needles.some((needle) => normalized.includes(needle));
}

function normalizeWheelRadius(value: string | null | undefined) {
  if (!value) return 26;
  if (includesLike(value, "small", "compact", "18", "19")) return 22;
  if (includesLike(value, "large", "oversize", "35", "34")) return 32;
  if (includesLike(value, "33", "32")) return 32;
  if (includesLike(value, "mid", "medium", "all-terrain")) return 30;
  const numeric = Number.parseInt(value, 10);
  if (Number.isFinite(numeric)) {
    if (numeric <= 19) return 22;
    if (numeric >= 32) return 32;
    if (numeric >= 21) return 28;
  }
  return 26;
}

function compactList(items: Array<string | null | undefined>, limit: number) {
  return items
    .filter((item): item is string => Boolean(item))
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit);
}

function resolveTheme(
  seed: string,
  locked: boolean,
  previousTheme: VisualizationSpec["theme"] | undefined
): VisualizationSpec["theme"] {
  if (!locked) {
    return {
      ...DEFAULT_THEME
    };
  }

  const match = PALETTE_LIBRARY.find((candidate) => candidate.match.test(seed));
  const theme = match?.theme ?? previousTheme ?? DEFAULT_THEME;
  return {
    paletteName: theme.paletteName,
    backgroundLocked: true,
    backgroundA: theme.backgroundA,
    backgroundB: theme.backgroundB,
    accent: theme.accent,
    accentAlt: theme.accentAlt,
    ink: theme.ink,
    bodyColor: theme.bodyColor,
    cabinColor: theme.cabinColor
  };
}

function deriveCurrentStep(session: ConfigurationSession): StepId {
  if (session.status === "submitted") return "gear";
  return STEP_DEFINITIONS[Math.min(Math.max(session.currentStep - 1, 0), STEP_DEFINITIONS.length - 1)]?.id ?? "vision";
}

function deriveVisionHighlights(session: ConfigurationSession, currentStep: StepId): VisualizationSpec["visionHighlights"] {
  const useCase = pickText(session.state.vision, "useCase", "primaryUseCase", "visionStatement") ?? "Weekend basecamp";
  const vibe = pickList(session.state.vision, "vibeKeywords", "styleKeywords");
  const trips = pickList(session.state.vision, "intendedTrips", "tripTypes");
  const colorTone = pickText(session.state.vision, "visualTone", "tone");
  const chips = compactList(
    [useCase, ...vibe, ...trips, colorTone, currentStep === "vision" ? "Vision shaping" : null],
    6
  );

  return {
    title: pickText(session.state.vision, "projectTitle", "buildName") ?? "Northstar custom build",
    summary:
      pickText(session.state.vision, "summary", "visionStatement") ??
      `A ${chips.slice(0, 3).join(", ").toLowerCase()} van build that keeps the journey front and center.`,
    chips: chips.length ? chips : ["Weekend escape", "Calm cabin", "Adventure-ready"]
  };
}

function deriveLayoutZones(
  driveSide: "left" | "right",
  frontSeatConfig: string,
  galleyType: string,
  storageType: string,
  dinetteType: string,
  bedType: string
): VisualizationSpec["layoutFloorplan"]["zones"] {
  const driverX = driveSide === "left" ? 0 : 10;
  const passengerX = driveSide === "left" ? 2 : 8;

  const zones: VisualizationSpec["layoutFloorplan"]["zones"] = [
    {
      kind: "driver",
      x: driverX,
      y: 0,
      w: 2,
      h: 2,
      label: driveSide === "left" ? "LHD cockpit" : "RHD cockpit",
      emphasis: "primary"
    },
    {
      kind: "passenger",
      x: passengerX,
      y: 0,
      w: 2,
      h: 2,
      label: frontSeatConfig,
      emphasis: "secondary"
    },
    {
      kind: "galley",
      x: driveSide === "left" ? 0 : 6,
      y: 2,
      w: 4,
      h: 2,
      label: galleyType,
      emphasis: "primary"
    },
    {
      kind: "storage",
      x: driveSide === "left" ? 8 : 0,
      y: 2,
      w: 4,
      h: 2,
      label: storageType,
      emphasis: "secondary"
    },
    {
      kind: "dinette",
      x: 4,
      y: 2,
      w: 4,
      h: 2,
      label: dinetteType,
      emphasis: "support"
    },
    {
      kind: "bed",
      x: 2,
      y: 4,
      w: 8,
      h: 2,
      label: bedType,
      emphasis: "primary"
    }
  ];

  if (includesLike(storageType, "bath", "wet")) {
    zones.push({
      kind: "bath",
      x: driveSide === "left" ? 9 : 1,
      y: 4,
      w: 2,
      h: 2,
      label: "Wet bath",
      emphasis: "support"
    });
  } else {
    zones.push({
      kind: "utility",
      x: driveSide === "left" ? 9 : 1,
      y: 4,
      w: 2,
      h: 2,
      label: "Power + water",
      emphasis: "support"
    });
  }

  return zones.slice(0, 8);
}

export function deriveVisualizationSpec(
  session: ConfigurationSession,
  previousSpec?: VisualizationSpec | null
): VisualizationSpec {
  const currentStep = deriveCurrentStep(session);
  const exteriorColor =
    pickText(session.state.exterior, "exteriorColor", "color") ?? previousSpec?.exteriorScene.bodyColor ?? DEFAULT_THEME.bodyColor;
  const finish = pickText(session.state.exterior, "finish") ?? "Satin finish";
  const driveSide = normalizeDriveSide(
    pickText(session.state.layout, "driveSide") ?? previousSpec?.layoutFloorplan.driveSide
  );
  const frontSeatConfig =
    pickText(session.state.layout, "frontSeatConfig") ??
    previousSpec?.layoutFloorplan.frontSeatConfig ??
    "Twin captain seats";
  const backgroundLocked =
    previousSpec?.theme.backgroundLocked === true || Boolean(pickText(session.state.exterior, "exteriorColor", "color"));
  const themeSeed = [
    exteriorColor,
    pickText(session.state.exterior, "powertrain", "drivetrain"),
    session.theme.paletteChoice,
    session.theme.visualTone
  ]
    .filter(Boolean)
    .join(" ");
  const theme = resolveTheme(themeSeed, backgroundLocked, previousSpec?.theme);
  const roofGear =
    pickText(session.state.gear, "roofGear") ??
    pickText(session.state.exterior, "rackStyle") ??
    previousSpec?.gearScene.roofGear ??
    "Low-profile rack";
  const rearCarrier =
    pickText(session.state.gear, "rearCarrier") ?? previousSpec?.gearScene.rearCarrier ?? "No rear carrier";
  const ladderText = pickText(session.state.gear, "ladder");
  const ladder = /yes|true|ladder|rear ladder/i.test(ladderText ?? "");
  const campLighting =
    pickText(session.state.gear, "campLighting") ??
    pickText(session.state.exterior, "auxLights") ??
    previousSpec?.gearScene.campLighting ??
    "Soft perimeter lighting";
  const wheelSize =
    pickText(session.state.exterior, "wheelSize") ??
    pickText(session.state.exterior, "wheelRadius") ??
    previousSpec?.exteriorScene.wheelRadius?.toString() ??
    "All-terrain";
  const wheelStyle = pickText(session.state.exterior, "wheelStyle") ?? "All-terrain alloy";
  const powertrain =
    pickText(session.state.exterior, "powertrain", "drivetrain", "powerPreference") ?? "AWD";
  const visionHighlights = deriveVisionHighlights(session, currentStep);
  const stepRail = STEP_DEFINITIONS.map((step, index) => ({
    step: step.id,
    label: step.label,
    state:
      session.status === "submitted" || index + 1 < session.currentStep
        ? "complete"
        : index + 1 === session.currentStep
          ? "current"
          : "upcoming"
  })) satisfies VisualizationSpec["stepRail"];
  const galleyType = pickText(session.state.layout, "galleyType") ?? "Compact galley";
  const storageType = pickText(session.state.layout, "storageType") ?? "Tall garage storage";
  const dinetteType = pickText(session.state.layout, "dinetteType") ?? "Two-seat dinette";
  const bedType = pickText(session.state.layout, "bedType") ?? "Convertible lounge bed";
  const layoutNotes = compactList(
    [frontSeatConfig, galleyType, storageType, dinetteType, bedType, driveSide === "left" ? "Left-hand drive" : "Right-hand drive"],
    6
  );

  return VisualizationSpecSchema.parse({
    generatedBy: "deterministic",
    updatedAt: now(),
    currentStep,
    theme,
    stepRail,
    visionHighlights,
    exteriorScene: {
      bodyColor: backgroundLocked ? theme.bodyColor : exteriorColor,
      finish,
      wheelRadius: normalizeWheelRadius(wheelSize),
      wheelStyle,
      rackStyle: pickText(session.state.exterior, "rackStyle") ?? "Touring rail",
      auxLights: pickText(session.state.exterior, "auxLights") ?? "Minimal driving lights",
      powertrain,
      driveSide,
      frontSeatConfig,
      roofGear,
      rearCarrier,
      ladder,
      campLighting,
      badges: compactList([powertrain, finish, pickText(session.state.exterior, "terrainIntent")], 4),
      overlays: compactList(
        [
          roofGear,
          rearCarrier !== "No rear carrier" ? rearCarrier : null,
          ladder ? "Rear ladder" : null,
          campLighting
        ],
        8
      )
    },
    interiorSwatches: {
      fixtureColor: pickText(session.state.interior, "fixtureColor") ?? "Warm birch",
      primaryTexture: pickText(session.state.interior, "primaryTexture", "interiorTone") ?? "Matte linen",
      secondaryTexture: pickText(session.state.interior, "secondaryTexture") ?? "Stone wool",
      stitchingColor: pickText(session.state.interior, "stitchingColor") ?? "Sand stitch",
      seatFinish: pickText(session.state.interior, "seatFinish") ?? "Weatherproof camel",
      notes: compactList(
        [
          pickText(session.state.interior, "interiorTone"),
          pickText(session.state.interior, "workspaceIntent"),
          pickText(session.state.interior, "comfortLevel")
        ],
        6
      )
    },
    layoutFloorplan: {
      gridColumns: 12,
      gridRows: 6,
      driveSide,
      frontSeatConfig,
      notes: layoutNotes,
      zones: deriveLayoutZones(driveSide, frontSeatConfig, galleyType, storageType, dinetteType, bedType)
    },
    gearScene: {
      roofGear,
      rearCarrier,
      ladder,
      powerModule: pickText(session.state.gear, "powerModule") ?? "Lithium off-grid pack",
      campLighting,
      modules: [
        {
          id: "roof-gear",
          label: "Roof gear",
          detail: roofGear,
          status: roofGear === "Low-profile rack" ? "optional" : "active"
        },
        {
          id: "rear-carrier",
          label: "Rear carrier",
          detail: rearCarrier,
          status: rearCarrier === "No rear carrier" ? "inactive" : "active"
        },
        {
          id: "power-module",
          label: "Power module",
          detail: pickText(session.state.gear, "powerModule") ?? "Lithium off-grid pack",
          status: "active"
        },
        {
          id: "camp-lighting",
          label: "Camp lighting",
          detail: campLighting,
          status: includesLike(campLighting, "soft", "none", "minimal") ? "optional" : "active"
        }
      ]
    }
  });
}

export function withVisualizationMetadata(
  spec: VisualizationSpec,
  input: Partial<Pick<VisualizationSpec, "generatedBy">>
): VisualizationSpec {
  return VisualizationSpecSchema.parse({
    ...spec,
    generatedBy: input.generatedBy ?? spec.generatedBy,
    updatedAt: now()
  });
}
