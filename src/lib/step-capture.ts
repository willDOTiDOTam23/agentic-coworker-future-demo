import type { ConfigurationValues, StepId } from "./domain.js";

const STEP_ALIASES: Record<StepId, Record<string, string[]>> = {
  vision: {
    useCase: ["primaryUseCase", "visionStatement", "projectOverview", "buildName"],
    vibeKeywords: ["styleKeywords", "vibes", "keywords"],
    intendedTrips: ["tripTypes", "tripPlans"],
    summary: []
  },
  exterior: {
    exteriorColor: ["color", "paintColor", "bodyColor", "colorway", "exteriorHue", "primaryColor", "paint"],
    finish: ["paintFinish", "finishType", "sheen", "exteriorFinish"],
    wheelSize: ["wheelDiameter", "tireSize", "wheelRadius", "wheelScale"],
    wheelStyle: ["wheels", "wheelPackage", "wheelLook", "wheelMaterial"],
    rackStyle: ["roofRack", "rack", "roofSystem"],
    auxLights: ["lights", "lighting", "barLights", "drivingLights", "fogLights"],
    powertrain: ["drivetrain", "drive", "powerPreference", "motor"],
    summary: []
  },
  interior: {
    fixtureColor: ["fixtures", "fixtureTone", "fixtureFinish", "cabinetColor", "cabinets"],
    primaryTexture: ["primaryMaterial", "primaryFinish", "primaryFabric", "mainTexture"],
    secondaryTexture: ["secondaryMaterial", "accentMaterial", "secondaryFinish", "trimTexture"],
    stitchingColor: ["stitching", "stitchColor", "threadColor"],
    seatFinish: ["seatMaterial", "seats", "upholstery", "seatTexture"],
    summary: []
  },
  layout: {
    driveSide: ["steeringSide", "handDrive", "driveConfiguration"],
    frontSeatConfig: ["seatConfig", "seatConfiguration", "frontSeats"],
    galleyType: ["galley", "kitchen", "kitchenette"],
    storageType: ["storage", "garage", "storagePlan"],
    dinetteType: ["dinette", "lounge", "benchSeating"],
    bedType: ["sleepingConfiguration", "bedLayout", "sleepPlan"],
    summary: []
  },
  gear: {
    roofGear: ["roofRack", "roofSystem", "solar"],
    rearCarrier: ["bikeRack", "rearRack", "carrier"],
    ladder: [],
    powerModule: ["battery", "electrical", "offGridPower"],
    campLighting: ["lighting", "campLights", "perimeterLighting"],
    summary: []
  }
};

const MEANINGFUL_STEP_KEYS: Record<StepId, string[]> = {
  vision: ["useCase", "vibeKeywords", "intendedTrips", "summary"],
  exterior: ["exteriorColor", "finish", "wheelSize", "wheelStyle", "rackStyle", "auxLights", "powertrain"],
  interior: ["fixtureColor", "primaryTexture", "secondaryTexture", "stitchingColor", "seatFinish"],
  layout: ["driveSide", "frontSeatConfig", "galleyType", "storageType", "dinetteType", "bedType"],
  gear: ["roofGear", "rearCarrier", "ladder", "powerModule", "campLighting"]
};

function isMeaningful(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.length > 0;
  return false;
}

function asText(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (typeof value === "boolean") {
    return value ? "yes" : "no";
  }

  return null;
}

function asList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => asText(item))
      .filter((item): item is string => Boolean(item));
  }

  const text = asText(value);
  if (!text) return [];
  return text
    .split(/[;,/]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function titleCase(value: string): string {
  return compactWhitespace(value)
    .replace(/^(?:and|with)\s+/i, "")
    .split(" ")
    .map((part) => part ? `${part[0]!.toUpperCase()}${part.slice(1)}` : part)
    .join(" ");
}

function assignText(target: ConfigurationValues, key: string, value: string | null | undefined) {
  if (!value || isMeaningful(target[key])) {
    return;
  }

  target[key] = compactWhitespace(value);
}

function assignList(target: ConfigurationValues, key: string, value: string[]) {
  if (!value.length || isMeaningful(target[key])) {
    return;
  }

  target[key] = value.map((item) => compactWhitespace(item));
}

function pickFirstText(values: ConfigurationValues, keys: string[]): string | null {
  for (const key of keys) {
    const value = asText(values[key]);
    if (value) {
      return value;
    }
  }

  return null;
}

function pickFirstList(values: ConfigurationValues, keys: string[]): string[] {
  for (const key of keys) {
    const value = asList(values[key]);
    if (value.length) {
      return value;
    }
  }

  return [];
}

function extractExteriorColor(summary: string): string | null {
  const directMatch = summary.match(/\b((?:[a-z]+(?:\s+[a-z]+){0,2}))\s+exterior\b/i);
  if (directMatch?.[1]) {
    const cleaned = compactWhitespace(
      directMatch[1].replace(/\b(?:matte|satin|glossy|gloss|metallic|subtle|deep|rich)\b/gi, "")
    );
    return cleaned ? titleCase(cleaned) : null;
  }

  const colorMatch = summary.match(
    /\b((?:[a-z]+(?:\s+[a-z]+){0,2})\s(?:blue|green|white|black|silver|graphite|orange|yellow|gold|red|burgundy|tan|camel|sand|beige|sage|slate|ivory|bronze|copper))\b/i
  );
  return colorMatch?.[1] ? titleCase(colorMatch[1]) : null;
}

function extractFinish(summary: string): string | null {
  if (/\bmatte\b/i.test(summary)) return "Matte finish";
  if (/\bsatin\b/i.test(summary)) return "Satin finish";
  if (/\bgloss(?:y)?\b/i.test(summary)) return "Gloss finish";
  if (/\bmetallic\b/i.test(summary)) return "Metallic finish";
  return null;
}

function extractWheelSize(summary: string): string | null {
  const matched = summary.match(/\b(\d{2})\s?(?:inch|in)\b/i);
  return matched?.[1] ? `${matched[1]} inch` : null;
}

function extractWheelStyle(summary: string): string | null {
  const matched = summary.match(/\b([a-z][a-z\s-]{0,32}wheels?)\b/i);
  if (!matched?.[1]) return null;
  const cleaned = compactWhitespace(matched[1].replace(/\bnormal\b/gi, ""));
  return cleaned ? titleCase(cleaned) : null;
}

function extractRackStyle(summary: string): string | null {
  const lowProfile = summary.match(/\b(low-profile|low profile)[^.,;]*rack\b/i);
  if (lowProfile) return "Low-profile rack";
  if (/\bsolar panels?\b/i.test(summary)) return "Solar deck";
  const roofRack = summary.match(/\b([a-z][a-z\s-]{0,24}rack)\b/i);
  return roofRack?.[1] ? titleCase(roofRack[1]) : null;
}

function extractAuxLights(summary: string): string | null {
  const matched = summary.match(/\b([a-z][a-z\s-]{0,28}lights?)\b/i);
  return matched?.[1] ? titleCase(matched[1]) : null;
}

function extractPowertrain(summary: string): string | null {
  if (/\b(all-wheel drive|awd|4x4)\b/i.test(summary)) return "AWD";
  if (/\b(rear-wheel drive|rwd)\b/i.test(summary)) return "RWD";
  if (/\b(front-wheel drive|fwd)\b/i.test(summary)) return "FWD";
  if (/\belectric\b/i.test(summary)) return "Electric";
  if (/\bhybrid\b/i.test(summary)) return "Hybrid";
  if (/\bdiesel\b/i.test(summary)) return "Diesel";
  return null;
}

function extractSegmentValue(summary: string, pattern: RegExp): string | null {
  const matched = summary.match(pattern);
  return matched?.[1] ? titleCase(matched[1]) : null;
}

function extractInteriorFallbacks(summary: string) {
  const segments = summary
    .split(/[;,]/)
    .map((segment) => compactWhitespace(segment))
    .filter(Boolean);
  const unclaimed = segments.filter(
    (segment) => !/\bfixtures?\b|\bstitching\b|\bseats?\b/i.test(segment)
  );

  return {
    primaryTexture: unclaimed[0] ? titleCase(unclaimed[0]) : null,
    secondaryTexture: unclaimed[1] ? titleCase(unclaimed[1]) : null
  };
}

function extractDriveSide(summary: string): string | null {
  if (/\bright-hand drive\b|\brhd\b/i.test(summary)) return "right-hand drive";
  if (/\bleft-hand drive\b|\blhd\b/i.test(summary)) return "left-hand drive";
  return null;
}

function extractFrontSeatConfig(summary: string): string | null {
  if (/\bswivel\b/i.test(summary)) return "Swivel captain seats";
  if (/\bfixed\b/i.test(summary)) return "Fixed front seats";
  if (/\bcaptain\b/i.test(summary)) return "Twin captain seats";
  return null;
}

function extractKeywordSegment(summary: string, pattern: RegExp): string | null {
  const matched = summary.match(pattern);
  return matched?.[0] ? titleCase(matched[0]) : null;
}

function extractLayoutField(summary: string, keywords: string[]): string | null {
  const segment = summary
    .split(/[;,]/)
    .map((item) => compactWhitespace(item))
    .find((item) => keywords.some((keyword) => item.toLowerCase().includes(keyword)));
  return segment ? titleCase(segment) : null;
}

function extractRoofGear(summary: string): string | null {
  if (/\bsolar panels?\b/i.test(summary)) return "Solar deck";
  return extractLayoutField(summary, ["roof", "rack", "solar"]);
}

function extractRearCarrier(summary: string): string | null {
  if (/\bbike rack\b/i.test(summary)) return "Bike rack";
  return extractLayoutField(summary, ["rear", "bike", "carrier", "rack on the back"]);
}

function extractLadder(summary: string): boolean | null {
  if (/\bno ladder\b/i.test(summary)) return false;
  if (/\bladder\b/i.test(summary)) return true;
  return null;
}

function extractPowerModule(summary: string): string | null {
  return extractLayoutField(summary, ["battery", "lithium", "off-grid", "off grid", "inverter"]);
}

function extractCampLighting(summary: string): string | null {
  if (/\bambient\b/i.test(summary)) return "Ambient camp lighting";
  if (/\bperimeter\b/i.test(summary)) return "Perimeter camp lights";
  return extractLayoutField(summary, ["lighting", "lights", "camp"]);
}

function canonicalizeVision(values: ConfigurationValues, summary: string | null) {
  const next = { ...values };
  const aliases = STEP_ALIASES.vision;
  assignText(next, "useCase", pickFirstText(values, ["useCase", ...aliases.useCase]));
  assignList(next, "vibeKeywords", pickFirstList(values, ["vibeKeywords", ...aliases.vibeKeywords]));
  assignList(next, "intendedTrips", pickFirstList(values, ["intendedTrips", ...aliases.intendedTrips]));
  assignText(next, "summary", asText(values.summary) ?? summary);

  if (summary && !isMeaningful(next.useCase)) {
    assignText(next, "useCase", summary);
  }

  if (summary && !isMeaningful(next.vibeKeywords)) {
    const vibeMatch = summary.match(/\bvibe[:\s]+([^.;]+)/i);
    if (vibeMatch?.[1]) {
      assignList(next, "vibeKeywords", vibeMatch[1].split(/[,/]/).map((item) => titleCase(item.trim())));
    }
  }

  return next;
}

function canonicalizeExterior(values: ConfigurationValues, summary: string | null) {
  const next = { ...values };
  const aliases = STEP_ALIASES.exterior;
  assignText(next, "exteriorColor", pickFirstText(values, ["exteriorColor", ...aliases.exteriorColor]));
  assignText(next, "finish", pickFirstText(values, ["finish", ...aliases.finish]));
  assignText(next, "wheelSize", pickFirstText(values, ["wheelSize", ...aliases.wheelSize]));
  assignText(next, "wheelStyle", pickFirstText(values, ["wheelStyle", ...aliases.wheelStyle]));
  assignText(next, "rackStyle", pickFirstText(values, ["rackStyle", ...aliases.rackStyle]));
  assignText(next, "auxLights", pickFirstText(values, ["auxLights", ...aliases.auxLights]));
  assignText(next, "powertrain", pickFirstText(values, ["powertrain", ...aliases.powertrain]));
  assignText(next, "summary", asText(values.summary) ?? summary);

  if (!summary) return next;

  assignText(next, "exteriorColor", extractExteriorColor(summary));
  assignText(next, "finish", extractFinish(summary));
  assignText(next, "wheelSize", extractWheelSize(summary));
  assignText(next, "wheelStyle", extractWheelStyle(summary));
  assignText(next, "rackStyle", extractRackStyle(summary));
  assignText(next, "auxLights", extractAuxLights(summary));
  assignText(next, "powertrain", extractPowertrain(summary));
  return next;
}

function canonicalizeInterior(values: ConfigurationValues, summary: string | null) {
  const next = { ...values };
  const aliases = STEP_ALIASES.interior;
  assignText(next, "fixtureColor", pickFirstText(values, ["fixtureColor", ...aliases.fixtureColor]));
  assignText(next, "primaryTexture", pickFirstText(values, ["primaryTexture", ...aliases.primaryTexture]));
  assignText(next, "secondaryTexture", pickFirstText(values, ["secondaryTexture", ...aliases.secondaryTexture]));
  assignText(next, "stitchingColor", pickFirstText(values, ["stitchingColor", ...aliases.stitchingColor]));
  assignText(next, "seatFinish", pickFirstText(values, ["seatFinish", ...aliases.seatFinish]));
  assignText(next, "summary", asText(values.summary) ?? summary);

  if (!summary) return next;

  const fallbackTextures = extractInteriorFallbacks(summary);
  assignText(next, "fixtureColor", extractSegmentValue(summary, /\b([^,.;]+?)\s+fixtures?\b/i));
  assignText(next, "stitchingColor", extractSegmentValue(summary, /\b([^,.;]+?)\s+stitching\b/i));
  assignText(next, "seatFinish", extractSegmentValue(summary, /\b([^,.;]+?)\s+seats?\b/i));
  assignText(next, "primaryTexture", fallbackTextures.primaryTexture);
  assignText(next, "secondaryTexture", fallbackTextures.secondaryTexture);
  return next;
}

function canonicalizeLayout(values: ConfigurationValues, summary: string | null) {
  const next = { ...values };
  const aliases = STEP_ALIASES.layout;
  assignText(next, "driveSide", pickFirstText(values, ["driveSide", ...aliases.driveSide]));
  assignText(next, "frontSeatConfig", pickFirstText(values, ["frontSeatConfig", ...aliases.frontSeatConfig]));
  assignText(next, "galleyType", pickFirstText(values, ["galleyType", ...aliases.galleyType]));
  assignText(next, "storageType", pickFirstText(values, ["storageType", ...aliases.storageType]));
  assignText(next, "dinetteType", pickFirstText(values, ["dinetteType", ...aliases.dinetteType]));
  assignText(next, "bedType", pickFirstText(values, ["bedType", ...aliases.bedType]));
  assignText(next, "summary", asText(values.summary) ?? summary);

  if (!summary) return next;

  assignText(next, "driveSide", extractDriveSide(summary));
  assignText(next, "frontSeatConfig", extractFrontSeatConfig(summary));
  assignText(next, "galleyType", extractLayoutField(summary, ["galley", "kitchenette", "kitchen"]));
  assignText(next, "storageType", extractLayoutField(summary, ["storage", "garage"]));
  assignText(next, "dinetteType", extractLayoutField(summary, ["dinette", "bench", "lounge"]));
  assignText(next, "bedType", extractLayoutField(summary, ["bed", "murphy", "fold-away", "fold away"]));
  return next;
}

function canonicalizeGear(values: ConfigurationValues, summary: string | null) {
  const next = { ...values };
  const aliases = STEP_ALIASES.gear;
  assignText(next, "roofGear", pickFirstText(values, ["roofGear", ...aliases.roofGear]));
  assignText(next, "rearCarrier", pickFirstText(values, ["rearCarrier", ...aliases.rearCarrier]));
  if (!isMeaningful(next.ladder) && isMeaningful(values.ladder)) {
    next.ladder = values.ladder;
  }
  assignText(next, "powerModule", pickFirstText(values, ["powerModule", ...aliases.powerModule]));
  assignText(next, "campLighting", pickFirstText(values, ["campLighting", ...aliases.campLighting]));
  assignText(next, "summary", asText(values.summary) ?? summary);

  if (!summary) return next;

  assignText(next, "roofGear", extractRoofGear(summary));
  assignText(next, "rearCarrier", extractRearCarrier(summary));
  const ladder = extractLadder(summary);
  if (!isMeaningful(next.ladder) && ladder !== null) {
    next.ladder = ladder;
  }
  assignText(next, "powerModule", extractPowerModule(summary));
  assignText(next, "campLighting", extractCampLighting(summary));
  return next;
}

export function canonicalizeStepValues(step: StepId, values: ConfigurationValues, summary?: string | null) {
  const normalizedSummary = summary?.trim() ? summary.trim() : null;

  switch (step) {
    case "vision":
      return canonicalizeVision(values, normalizedSummary);
    case "exterior":
      return canonicalizeExterior(values, normalizedSummary);
    case "interior":
      return canonicalizeInterior(values, normalizedSummary);
    case "layout":
      return canonicalizeLayout(values, normalizedSummary);
    case "gear":
      return canonicalizeGear(values, normalizedSummary);
  }
}

export function hasMeaningfulStepValues(step: StepId, values: ConfigurationValues) {
  return MEANINGFUL_STEP_KEYS[step].some((key) => isMeaningful(values[key]));
}
