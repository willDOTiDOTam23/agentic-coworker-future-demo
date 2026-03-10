import type { ConfigurationDetail } from "./domain.js";
import type { DesignBrief, SupplyOrder } from "./schemas.js";

function asText(value: unknown, fallback: string) {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return fallback;
}

function asList(value: unknown, fallback: string[]) {
  if (Array.isArray(value)) {
    const values = value
      .map((item) => (typeof item === "string" ? item.trim() : String(item ?? "").trim()))
      .filter(Boolean);
    return values.length ? values : fallback;
  }

  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }

  return fallback;
}

function compact(items: Array<string | null | undefined>) {
  return items.filter((item): item is string => Boolean(item && item.trim()));
}

export function buildFallbackDesignBrief(detail: ConfigurationDetail): DesignBrief {
  const { session } = detail;
  const vision = session.state.vision;
  const exterior = session.state.exterior;
  const interior = session.state.interior;
  const layout = session.state.layout;
  const gear = session.state.gear;
  const vibeKeywords = asList(vision.vibeKeywords, ["Adventure-ready", "Calm cabin"]);
  const intendedTrips = asList(vision.intendedTrips, ["Weekend escapes"]);
  const gearItems = compact([
    typeof gear.roofGear === "string" ? gear.roofGear : null,
    typeof gear.rearCarrier === "string" ? gear.rearCarrier : null,
    gear.ladder ? "Rear ladder" : null,
    typeof gear.powerModule === "string" ? gear.powerModule : null,
    typeof gear.campLighting === "string" ? gear.campLighting : null
  ]);

  return {
    projectOverview: {
      buildName: `Northstar Build ${session.id.slice(0, 8)}`,
      customerArchetype: asText(vision.useCase, "Adventure traveler"),
      buildStage: session.status === "submitted" ? "Submitted to ops" : `Step ${session.currentStep} captured`,
      summary: `${asText(vision.useCase, "Adventure van")} with ${asText(exterior.exteriorColor, "custom exterior")} and ${asText(layout.bedType, "flexible sleeping layout")}.`
    },
    useCaseAndVision: {
      primaryUseCase: asText(vision.useCase, "Adventure travel"),
      visionStatement: `${vibeKeywords.slice(0, 3).join(", ")} cabin tuned for ${intendedTrips[0]}.`,
      vibeKeywords: vibeKeywords.slice(0, 6),
      intendedTrips: intendedTrips.slice(0, 5)
    },
    exteriorSpec: {
      exteriorColor: asText(exterior.exteriorColor, "Custom exterior"),
      finish: asText(exterior.finish, "Satin finish"),
      drivetrain: asText(exterior.powertrain, "AWD"),
      powerPreference: asText(exterior.powertrain, "All-terrain ready"),
      notes: compact([
        typeof exterior.wheelSize === "string" ? `${exterior.wheelSize} wheels` : null,
        typeof exterior.wheelStyle === "string" ? exterior.wheelStyle : null,
        typeof exterior.rackStyle === "string" ? exterior.rackStyle : null,
        typeof exterior.auxLights === "string" ? exterior.auxLights : null
      ]).slice(0, 6)
    },
    interiorSpec: {
      interiorTone: asText(interior.fixtureColor, "Warm modern cabin"),
      materials: compact([
        typeof interior.fixtureColor === "string" ? interior.fixtureColor : null,
        typeof interior.primaryTexture === "string" ? interior.primaryTexture : null,
        typeof interior.seatFinish === "string" ? interior.seatFinish : null
      ]).slice(0, 6),
      comfortLevel: "Premium adventure comfort",
      workspaceIntent: asText(layout.frontSeatConfig, "Flexible lounge seating"),
      notes: compact([
        typeof interior.secondaryTexture === "string" ? interior.secondaryTexture : null,
        typeof interior.stitchingColor === "string" ? interior.stitchingColor : null
      ]).slice(0, 6)
    },
    layoutAndSleepingConfig: {
      occupancy: layout.frontSeatConfig ? "Two-traveler primary layout" : "Two-to-three traveler layout",
      sleepingConfiguration: asText(layout.bedType, "Convertible bed"),
      layoutPriorities: compact([
        typeof layout.galleyType === "string" ? layout.galleyType : null,
        typeof layout.storageType === "string" ? layout.storageType : "Clean gear storage",
        typeof layout.dinetteType === "string" ? layout.dinetteType : "Compact lounge zone"
      ]).slice(0, 6),
      storageStrategy: asText(layout.storageType, "Mixed overhead and rear garage storage")
    },
    gearAndAccessories: {
      items: (gearItems.length ? gearItems : ["Off-grid power", "Camp lighting"]).slice(0, 5).map((item) => ({
        name: item,
        purpose: "Supports the customer's adventure travel setup.",
        priority: item === asText(gear.powerModule, "") ? "core" : "nice-to-have" as const
      }))
    },
    bomSummary: {
      componentBuckets: [
        {
          category: "Exterior",
          items: compact([
            asText(exterior.exteriorColor, "Exterior paint"),
            typeof exterior.wheelStyle === "string" ? exterior.wheelStyle : "All-terrain wheel package",
            typeof exterior.rackStyle === "string" ? exterior.rackStyle : "Roof system"
          ]).slice(0, 6),
          estimatedCostRange: "$12k - $22k"
        },
        {
          category: "Interior",
          items: compact([
            asText(interior.fixtureColor, "Cabinet finish"),
            typeof interior.primaryTexture === "string" ? interior.primaryTexture : "Primary soft goods",
            typeof interior.seatFinish === "string" ? interior.seatFinish : "Seat finish"
          ]).slice(0, 6),
          estimatedCostRange: "$10k - $18k"
        },
        {
          category: "Systems & Gear",
          items: (gearItems.length ? gearItems : ["Power module", "Camp lighting"]).slice(0, 6),
          estimatedCostRange: "$8k - $20k"
        }
      ],
      estimatedTotalRange: "$68k - $115k"
    },
    buildNotes: {
      assumptions: compact([
        "Initial artifact generated from captured customer selections.",
        session.status === "submitted" ? "Customer approved the build for ops handoff." : null
      ]).slice(0, 6),
      risks: compact([
        !layout.storageType ? "Storage plan needs final sizing confirmation." : null,
        !gear.powerModule ? "Electrical package may need more off-grid detail." : null
      ]).slice(0, 6),
      unresolvedDecisions: compact([
        !exterior.rackStyle ? "Confirm final roof system." : null,
        !layout.dinetteType ? "Confirm lounge / dinette preference." : null,
        !gear.rearCarrier ? "Confirm rear carrier requirements." : null
      ]).slice(0, 6)
    }
  };
}

export function buildFallbackSupplyOrder(detail: ConfigurationDetail): SupplyOrder {
  const exterior = detail.session.state.exterior;
  const interior = detail.session.state.interior;
  const layout = detail.session.state.layout;
  const gear = detail.session.state.gear;

  return {
    orderSummary: {
      buildPhase: detail.session.status === "submitted" ? "Initial submitted sourcing plan" : "Pre-submit sourcing draft",
      sourcingPosture: "Blend stocked platform parts with made-to-order conversion components.",
      totalEstimatedRange: "$28k - $54k",
      summary: "Seed purchasing plan generated automatically from the captured customer configuration."
    },
    componentLineItems: [
      {
        name: asText(exterior.exteriorColor, "Exterior paint package"),
        category: "Exterior",
        estimatedCostRange: "$4k - $8k",
        supplierType: "Coachbuilder",
        leadTime: "2-4 weeks"
      },
      {
        name: asText(exterior.wheelStyle, "Wheel and tire package"),
        category: "Exterior",
        estimatedCostRange: "$2k - $5k",
        supplierType: "Aftermarket",
        leadTime: "1-3 weeks"
      },
      {
        name: asText(interior.fixtureColor, "Cabinet and fixture kit"),
        category: "Interior",
        estimatedCostRange: "$6k - $12k",
        supplierType: "Fabrication shop",
        leadTime: "4-6 weeks"
      },
      {
        name: asText(layout.bedType, "Sleeping system"),
        category: "Layout",
        estimatedCostRange: "$3k - $8k",
        supplierType: "In-house build",
        leadTime: "2-5 weeks"
      },
      {
        name: asText(gear.powerModule, "Power module"),
        category: "Electrical",
        estimatedCostRange: "$5k - $14k",
        supplierType: "Electrical integrator",
        leadTime: "3-6 weeks"
      }
    ],
    sequencingNotes: [
      "Lock exterior color and wheel package before opening supplier purchase orders.",
      "Sequence cabinetry and sleeping layout after the floorplan is frozen.",
      "Stage electrical and accessory installs after core interior dimensions are confirmed."
    ],
    openQuestions: compact([
      !layout.storageType ? "What storage volume and gear garage constraints should ops plan around?" : null,
      !gear.rearCarrier ? "Does the customer want a rear carrier or a clean rear door?" : null,
      !gear.campLighting ? "Confirm whether perimeter camp lighting is core or optional." : null
    ]).slice(0, 8)
  };
}
