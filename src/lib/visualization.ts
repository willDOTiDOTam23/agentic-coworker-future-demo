import { z } from "zod";
import {
  STEP_DEFINITIONS,
  getStepIdForNumber,
  type ConfigurationSession,
  type ConfigurationValues,
  type LayoutZoneKind,
  type StepId,
  type VisualizationSpec
} from "./domain.js";

interface ExteriorPaletteToken {
  match: RegExp;
  paletteName: string;
  resolvedExteriorColor: string;
  backgroundA: string;
  backgroundB: string;
  accent: string;
  accentAlt: string;
  ink: string;
  cabinColor: string;
}

const DEFAULT_THEME = {
  paletteName: "Sunlit trail",
  backgroundLocked: false,
  requestedExteriorColor: "Sunlit sand",
  resolvedExteriorColor: "#d7b892",
  backgroundA: "#f7e6c7",
  backgroundB: "#ebd7a4",
  accent: "#cf7b3f",
  accentAlt: "#3f7288",
  ink: "#182125",
  bodyColor: "#d7b892",
  cabinColor: "#f7f1e8"
} as const;

const EXTERIOR_PALETTE_LIBRARY: ExteriorPaletteToken[] = [
  {
    match: /forest|green|sage|moss|olive/i,
    paletteName: "Forest calm",
    resolvedExteriorColor: "#6c876f",
    backgroundA: "#dce8dc",
    backgroundB: "#bfd4c0",
    accent: "#537857",
    accentAlt: "#d19a59",
    ink: "#18231d",
    cabinColor: "#edf3ec"
  },
  {
    match: /blue|ocean|storm|navy|coast|slate/i,
    paletteName: "Coastal current",
    resolvedExteriorColor: "#56788f",
    backgroundA: "#dbe8ef",
    backgroundB: "#bfd4df",
    accent: "#2f6f8b",
    accentAlt: "#d2874b",
    ink: "#16242c",
    cabinColor: "#f0f6f8"
  },
  {
    match: /black|charcoal|graphite|night/i,
    paletteName: "Graphite horizon",
    resolvedExteriorColor: "#69717b",
    backgroundA: "#e5e5e7",
    backgroundB: "#d1d4da",
    accent: "#4d5662",
    accentAlt: "#d08d55",
    ink: "#151a1d",
    cabinColor: "#f2f2f4"
  },
  {
    match: /white|silver|alpine|glacier|stone|ivory/i,
    paletteName: "Alpine light",
    resolvedExteriorColor: "#cfd5d5",
    backgroundA: "#eff1f1",
    backgroundB: "#d8ddd9",
    accent: "#65808c",
    accentAlt: "#d29954",
    ink: "#172126",
    cabinColor: "#fbfcfc"
  },
  {
    match: /sand|beige|desert|clay|terra|bronze|copper|tan|camel/i,
    paletteName: "Desert heat",
    resolvedExteriorColor: "#c9a27c",
    backgroundA: "#f3e1c8",
    backgroundB: "#dec094",
    accent: "#cf7744",
    accentAlt: "#54758a",
    ink: "#201d18",
    cabinColor: "#f6eee3"
  },
  {
    match: /orange|yellow|gold|sun|amber|saffron/i,
    paletteName: "Golden hour",
    resolvedExteriorColor: "#d4a44d",
    backgroundA: "#f5e6bf",
    backgroundB: "#e4cb87",
    accent: "#c36d3c",
    accentAlt: "#3e738b",
    ink: "#231b12",
    cabinColor: "#fbf2dd"
  },
  {
    match: /red|rust|burgundy|maroon/i,
    paletteName: "Canyon ember",
    resolvedExteriorColor: "#8d4f49",
    backgroundA: "#efd9d3",
    backgroundB: "#dcb5ab",
    accent: "#7f3f39",
    accentAlt: "#4e7488",
    ink: "#261816",
    cabinColor: "#f6ece8"
  }
];

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

const ZoneKindSchema = z.enum(ALLOWED_LAYOUT_ZONE_KINDS);

export const LayoutZoneSchema = z.object({
  kind: ZoneKindSchema,
  x: z.number().int().min(0).max(11),
  y: z.number().int().min(0).max(5),
  w: z.number().int().min(1).max(12),
  h: z.number().int().min(1).max(6),
  label: z.string().trim().min(1).max(40),
  shortLabel: z.string().trim().min(1).max(3),
  emphasis: z.enum(["primary", "secondary", "support"])
});

const LayoutLegendItemSchema = z.object({
  kind: ZoneKindSchema,
  label: z.string().trim().min(1).max(40),
  shortLabel: z.string().trim().min(1).max(3),
  emphasis: z.enum(["primary", "secondary", "support"])
});

export const VisualizationSpecSchema = z.object({
  generatedBy: z.enum(["deterministic", "agent"]),
  updatedAt: z.string().datetime(),
  currentStep: z.enum(STEP_DEFINITIONS.map((step) => step.id) as [StepId, ...StepId[]]),
  theme: z.object({
    paletteName: z.string().trim().min(1).max(80),
    backgroundLocked: z.boolean(),
    requestedExteriorColor: z.string().trim().min(1).max(80),
    resolvedExteriorColor: z.string().trim().min(4).max(32),
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
    requestedColor: z.string().trim().min(1).max(80),
    renderColor: z.string().trim().min(4).max(32),
    bodyColor: z.string().trim().min(4).max(32),
    finish: z.string().trim().min(1).max(40),
    wheelRadius: z.number().int().min(18).max(36),
    wheelStyle: z.string().trim().min(1).max(40),
    wheelVariant: z.enum(["compact", "touring", "off-road"]),
    rackStyle: z.string().trim().min(1).max(40),
    auxLights: z.string().trim().min(1).max(40),
    powertrain: z.string().trim().min(1).max(40),
    driveSide: z.enum(["left", "right"]),
    frontSeatConfig: z.string().trim().min(1).max(60),
    roofGear: z.string().trim().min(1).max(60),
    rearCarrier: z.string().trim().min(1).max(60),
    ladder: z.boolean(),
    campLighting: z.string().trim().min(1).max(60),
    showRack: z.boolean(),
    showAuxLights: z.boolean(),
    showRearCarrier: z.boolean(),
    showLadder: z.boolean(),
    suspensionLift: z.number().int().min(0).max(14),
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
    zones: z.array(LayoutZoneSchema).min(4).max(8),
    legend: z.array(LayoutLegendItemSchema).min(4).max(8)
  }),
  gearScene: z.object({
    roofGear: z.string().trim().min(1).max(60),
    rearCarrier: z.string().trim().min(1).max(60),
    ladder: z.boolean(),
    powerModule: z.string().trim().min(1).max(60),
    campLighting: z.string().trim().min(1).max(60),
    attachmentStates: z.array(
      z.object({
        id: z.string().trim().min(1).max(40),
        label: z.string().trim().min(1).max(60),
        active: z.boolean()
      })
    ),
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

function compactList(items: Array<string | null | undefined>, limit: number) {
  return items
    .filter((item): item is string => Boolean(item))
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit);
}

function clampText(value: string, limit: number) {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}

function includesLike(value: string | null | undefined, ...needles: string[]) {
  const normalized = (value ?? "").toLowerCase();
  return needles.some((needle) => normalized.includes(needle));
}

function normalizeDriveSide(value: string | null | undefined): "left" | "right" {
  return /right/i.test(value ?? "") ? "right" : "left";
}

function normalizeWheelVariant(value: string | null | undefined, style: string | null | undefined) {
  const seed = `${value ?? ""} ${style ?? ""}`;
  if (includesLike(seed, "compact", "small", "18", "19", "city")) return "compact";
  if (includesLike(seed, "33", "34", "35", "off-road", "off road", "all-terrain", "all terrain", "mud")) {
    return "off-road";
  }
  return "touring";
}

function normalizeWheelRadius(value: string | null | undefined, style: string | null | undefined) {
  const variant = normalizeWheelVariant(value, style);
  if (variant === "compact") return 22;
  if (variant === "off-road") return 32;

  const numeric = Number.parseInt(value ?? "", 10);
  if (Number.isFinite(numeric) && numeric >= 21) {
    return 28;
  }

  return 26;
}

function getZoneShortLabel(kind: LayoutZoneKind) {
  switch (kind) {
    case "driver":
      return "DR";
    case "passenger":
      return "PS";
    case "galley":
      return "GA";
    case "storage":
      return "ST";
    case "dinette":
      return "DN";
    case "bed":
      return "BD";
    case "bath":
      return "BA";
    case "utility":
      return "UT";
  }
}

function resolveTheme(
  requestedExteriorColor: string,
  locked: boolean,
  previousTheme: VisualizationSpec["theme"] | undefined
): VisualizationSpec["theme"] {
  if (!locked) {
    return {
      ...DEFAULT_THEME,
      requestedExteriorColor
    };
  }

  const match = EXTERIOR_PALETTE_LIBRARY.find((candidate) => candidate.match.test(requestedExteriorColor));
  const theme = match
    ? {
        paletteName: match.paletteName,
        backgroundLocked: true,
        requestedExteriorColor,
        resolvedExteriorColor: match.resolvedExteriorColor,
        backgroundA: match.backgroundA,
        backgroundB: match.backgroundB,
        accent: match.accent,
        accentAlt: match.accentAlt,
        ink: match.ink,
        bodyColor: match.resolvedExteriorColor,
        cabinColor: match.cabinColor
      }
    : previousTheme
      ? {
          ...previousTheme,
          backgroundLocked: true,
          requestedExteriorColor
        }
      : {
          ...DEFAULT_THEME,
          backgroundLocked: true,
          requestedExteriorColor
        };

  return theme;
}

function deriveCurrentStep(session: ConfigurationSession): StepId {
  if (session.status === "submitted") {
    return "gear";
  }

  return getStepIdForNumber(session.currentStep);
}

function deriveVisionHighlights(session: ConfigurationSession, currentStep: StepId): VisualizationSpec["visionHighlights"] {
  const useCase = pickText(session.state.vision, "useCase", "primaryUseCase", "visionStatement") ?? "Weekend basecamp";
  const vibe = pickList(session.state.vision, "vibeKeywords", "styleKeywords");
  const trips = pickList(session.state.vision, "intendedTrips", "tripTypes");
  const chips = compactList([useCase, ...vibe, ...trips, currentStep === "vision" ? "Vision shaping" : null], 6).map((item) =>
    clampText(item, 40)
  );

  return {
    title: clampText(pickText(session.state.vision, "projectTitle", "buildName") ?? "Northstar custom build", 80),
    summary:
      clampText(
        pickText(session.state.vision, "summary", "visionStatement") ??
          `A ${chips.slice(0, 3).join(", ").toLowerCase()} build shaped around how the van will be used.`,
        180
      ),
    chips: chips.length ? chips : ["Weekend escape", "Calm cabin", "Adventure-ready"]
  };
}

function buildLayoutLegend(
  zones: VisualizationSpec["layoutFloorplan"]["zones"]
): VisualizationSpec["layoutFloorplan"]["legend"] {
  return zones.map((zone) => ({
    kind: zone.kind,
    label: zone.label,
    shortLabel: zone.shortLabel,
    emphasis: zone.emphasis
  }));
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
      shortLabel: getZoneShortLabel("driver"),
      emphasis: "primary"
    },
    {
      kind: "passenger",
      x: passengerX,
      y: 0,
      w: 2,
      h: 2,
      label: frontSeatConfig,
      shortLabel: getZoneShortLabel("passenger"),
      emphasis: "secondary"
    },
    {
      kind: "galley",
      x: driveSide === "left" ? 0 : 6,
      y: 2,
      w: 4,
      h: 2,
      label: galleyType,
      shortLabel: getZoneShortLabel("galley"),
      emphasis: "primary"
    },
    {
      kind: "storage",
      x: driveSide === "left" ? 8 : 0,
      y: 2,
      w: 4,
      h: 2,
      label: storageType,
      shortLabel: getZoneShortLabel("storage"),
      emphasis: "secondary"
    },
    {
      kind: "dinette",
      x: 4,
      y: 2,
      w: 4,
      h: 2,
      label: dinetteType,
      shortLabel: getZoneShortLabel("dinette"),
      emphasis: "support"
    },
    {
      kind: "bed",
      x: 2,
      y: 4,
      w: 8,
      h: 2,
      label: bedType,
      shortLabel: getZoneShortLabel("bed"),
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
      shortLabel: getZoneShortLabel("bath"),
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
      shortLabel: getZoneShortLabel("utility"),
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
  const requestedExteriorColor =
    pickText(session.state.exterior, "exteriorColor", "color") ??
    previousSpec?.theme.requestedExteriorColor ??
    DEFAULT_THEME.requestedExteriorColor;
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
  const theme = resolveTheme(requestedExteriorColor, backgroundLocked, previousSpec?.theme);
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
  const wheelStyle = pickText(session.state.exterior, "wheelStyle") ?? "All-terrain alloy";
  const wheelSize =
    pickText(session.state.exterior, "wheelSize") ??
    pickText(session.state.exterior, "wheelRadius") ??
    previousSpec?.exteriorScene.wheelRadius?.toString() ??
    "All-terrain";
  const wheelVariant = normalizeWheelVariant(wheelSize, wheelStyle);
  const wheelRadius = normalizeWheelRadius(wheelSize, wheelStyle);
  const powertrain =
    pickText(session.state.exterior, "powertrain", "drivetrain", "powerPreference") ?? "AWD";
  const rackStyle = pickText(session.state.exterior, "rackStyle") ?? "Touring rail";
  const auxLights = pickText(session.state.exterior, "auxLights") ?? "Minimal driving lights";
  const showRack = !/none|no rack|clean roof/i.test(`${rackStyle} ${roofGear}`);
  const showAuxLights = !/none|minimal|soft/i.test(`${auxLights} ${campLighting}`);
  const showRearCarrier = !/none|no rear carrier/i.test(rearCarrier);
  const showLadder = ladder;
  const suspensionLift = wheelVariant === "off-road" ? 10 : wheelVariant === "touring" ? 4 : 0;
  const visionHighlights = deriveVisionHighlights(session, currentStep);
  const stepRail = STEP_DEFINITIONS.map((step, index) => {
    if (session.status === "submitted") {
      return {
        step: step.id,
        label: step.label,
        state: "complete" as const
      };
    }

    if (index + 1 < session.currentStep) {
      return {
        step: step.id,
        label: step.label,
        state: "complete" as const
      };
    }

    if (index + 1 === session.currentStep) {
      return {
        step: step.id,
        label: step.label,
        state: "current" as const
      };
    }

    return {
      step: step.id,
      label: step.label,
      state: "upcoming" as const
    };
  });
  const galleyType = pickText(session.state.layout, "galleyType") ?? "Compact galley";
  const storageType = pickText(session.state.layout, "storageType") ?? "Tall garage storage";
  const dinetteType = pickText(session.state.layout, "dinetteType") ?? "Two-seat dinette";
  const bedType = pickText(session.state.layout, "bedType") ?? "Convertible lounge bed";
  const layoutZones = deriveLayoutZones(driveSide, frontSeatConfig, galleyType, storageType, dinetteType, bedType);
  const layoutNotes = compactList(
    [
      driveSide === "left" ? "Left-hand drive" : "Right-hand drive",
      frontSeatConfig,
      galleyType,
      storageType,
      bedType
    ],
    5
  );
  const attachmentStates = [
    {
      id: "roof-gear",
      label: roofGear,
      active: showRack
    },
    {
      id: "rear-carrier",
      label: rearCarrier,
      active: showRearCarrier
    },
    {
      id: "ladder",
      label: "Rear ladder",
      active: showLadder
    },
    {
      id: "camp-lighting",
      label: campLighting,
      active: !/none|minimal|soft/i.test(campLighting)
    }
  ];

  return VisualizationSpecSchema.parse({
    generatedBy: "deterministic",
    updatedAt: now(),
    currentStep,
    theme,
    stepRail,
    visionHighlights,
    exteriorScene: {
      requestedColor: requestedExteriorColor,
      renderColor: theme.resolvedExteriorColor,
      bodyColor: theme.resolvedExteriorColor,
      finish,
      wheelRadius,
      wheelStyle,
      wheelVariant,
      rackStyle,
      auxLights,
      powertrain,
      driveSide,
      frontSeatConfig,
      roofGear,
      rearCarrier,
      ladder,
      campLighting,
      showRack,
      showAuxLights,
      showRearCarrier,
      showLadder,
      suspensionLift,
      badges: compactList(
        [powertrain, finish, wheelVariant === "off-road" ? "Trail pack" : wheelVariant === "compact" ? "City spec" : "Touring"],
        4
      ),
      overlays: compactList(
        [
          showRack ? roofGear : null,
          showRearCarrier ? rearCarrier : null,
          showLadder ? "Rear ladder" : null,
          !/none|minimal|soft/i.test(campLighting) ? campLighting : null
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
      zones: layoutZones,
      legend: buildLayoutLegend(layoutZones)
    },
    gearScene: {
      roofGear,
      rearCarrier,
      ladder,
      powerModule: pickText(session.state.gear, "powerModule") ?? "Lithium off-grid pack",
      campLighting,
      attachmentStates,
      modules: [
        {
          id: "roof-gear",
          label: "Roof gear",
          detail: roofGear,
          status: showRack ? "active" : "inactive"
        },
        {
          id: "rear-carrier",
          label: "Rear carrier",
          detail: rearCarrier,
          status: showRearCarrier ? "active" : "inactive"
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
          status: !/none|minimal|soft/i.test(campLighting) ? "active" : "optional"
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
