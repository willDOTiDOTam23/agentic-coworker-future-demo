import { describe, expect, it } from "vitest";
import type { ConfigurationSession } from "../src/lib/domain.js";
import { deriveVisualizationSpec, VisualizationSpecSchema } from "../src/lib/visualization.js";

function createSession(overrides?: Partial<ConfigurationSession>): ConfigurationSession {
  return {
    id: "session-visual-test",
    status: "draft",
    currentStep: 1,
    createdAt: "2026-03-10T00:00:00.000Z",
    updatedAt: "2026-03-10T00:00:00.000Z",
    submittedAt: null,
    latestConfidence: null,
    theme: {
      paletteChoice: "Sunlit trail",
      visualTone: "Warm expedition"
    },
    state: {
      vision: {},
      exterior: {},
      interior: {},
      layout: {},
      gear: {}
    },
    ...overrides
  };
}

describe("deriveVisualizationSpec", () => {
  it("normalizes partial state into a valid deterministic visualization spec", () => {
    const session = createSession({
      currentStep: 4,
      state: {
        vision: {
          useCase: "Surf weekends",
          vibeKeywords: ["Calm", "coastal", "minimal"]
        },
        exterior: {
          exteriorColor: "Storm blue",
          wheelSize: "33 inch",
          rackStyle: "Expedition rack",
          powertrain: "AWD"
        },
        interior: {
          fixtureColor: "White oak",
          seatFinish: "Weatherproof camel"
        },
        layout: {
          driveSide: "right-hand drive",
          frontSeatConfig: "Swivel captain seats",
          galleyType: "Full galley",
          storageType: "Bike garage",
          dinetteType: "Bench dinette",
          bedType: "Murphy bed"
        },
        gear: {
          roofGear: "Solar deck",
          ladder: true,
          powerModule: "Dual battery pack"
        }
      }
    });

    const spec = deriveVisualizationSpec(session);

    expect(() => VisualizationSpecSchema.parse(spec)).not.toThrow();
    expect(spec.currentStep).toBe("layout");
    expect(spec.theme.backgroundLocked).toBe(true);
    expect(spec.theme.requestedExteriorColor).toBe("Storm blue");
    expect(spec.theme.resolvedExteriorColor).toBe("#56788f");
    expect(spec.exteriorScene.wheelRadius).toBe(32);
    expect(spec.exteriorScene.wheelVariant).toBe("off-road");
    expect(spec.layoutFloorplan.driveSide).toBe("right");
    expect(spec.layoutFloorplan.zones.some((zone) => zone.kind === "driver")).toBe(true);
    expect(spec.layoutFloorplan.legend.every((item) => item.shortLabel.length <= 3)).toBe(true);
    expect(spec.gearScene.modules.some((module) => module.id === "power-module")).toBe(true);
  });

  it("keeps the exterior-driven background locked after later steps", () => {
    const exteriorSession = createSession({
      currentStep: 2,
      state: {
        vision: {},
        exterior: { exteriorColor: "Forest green" },
        interior: {},
        layout: {},
        gear: {}
      }
    });

    const lockedSpec = deriveVisualizationSpec(exteriorSession);
    const laterSpec = deriveVisualizationSpec(
      createSession({
        currentStep: 4,
        state: {
          vision: {},
          exterior: { exteriorColor: "Forest green" },
          interior: { fixtureColor: "Warm birch" },
          layout: { driveSide: "left-hand drive" },
          gear: { roofGear: "Surfboard rail" }
        }
      }),
      lockedSpec
    );

    expect(lockedSpec.theme.backgroundLocked).toBe(true);
    expect(laterSpec.theme.backgroundA).toBe(lockedSpec.theme.backgroundA);
    expect(laterSpec.theme.backgroundB).toBe(lockedSpec.theme.backgroundB);
    expect(laterSpec.theme.resolvedExteriorColor).toBe(lockedSpec.theme.resolvedExteriorColor);
    expect(laterSpec.exteriorScene.renderColor).toBe(lockedSpec.exteriorScene.renderColor);
  });

  it("maps common spoken exterior colors into a renderable palette", () => {
    const spec = deriveVisualizationSpec(
      createSession({
        currentStep: 2,
        state: {
          vision: {},
          exterior: {
            exteriorColor: "sage green",
            wheelStyle: "city wheel"
          },
          interior: {},
          layout: {},
          gear: {}
        }
      })
    );

    expect(spec.theme.backgroundLocked).toBe(true);
    expect(spec.theme.requestedExteriorColor).toBe("sage green");
    expect(spec.theme.resolvedExteriorColor).toBe("#6c876f");
    expect(spec.exteriorScene.renderColor).toBe("#6c876f");
    expect(spec.exteriorScene.wheelVariant).toBe("compact");
  });

  it("clamps long layout labels into schema-safe visualization values", () => {
    const spec = deriveVisualizationSpec(
      createSession({
        currentStep: 4,
        state: {
          vision: {},
          exterior: {
            exteriorColor: "Marine blue"
          },
          interior: {},
          layout: {
            driveSide: "left-hand drive",
            frontSeatConfig: "Swivel captain seats with extended navigation console and storage cubby",
            galleyType: "Full chef galley with induction hob, walnut prep counter, and appliance tower",
            storageType: "Tall gear wall with overhead cabinets, hidden cubbies, and bike tunnel storage",
            dinetteType: "Convertible wraparound lounge with removable table and integrated charging shelf",
            bedType: "Powered slide-out queen bed with reading sconces and under-bed utility drawers"
          },
          gear: {}
        }
      })
    );

    expect(() => VisualizationSpecSchema.parse(spec)).not.toThrow();
    expect(spec.layoutFloorplan.zones.every((zone) => zone.label.length <= 40)).toBe(true);
    expect(spec.layoutFloorplan.legend.every((item) => item.label.length <= 40)).toBe(true);
    expect(spec.layoutFloorplan.zones.every((zone) => zone.shortLabel.length <= 3)).toBe(true);
  });
});
