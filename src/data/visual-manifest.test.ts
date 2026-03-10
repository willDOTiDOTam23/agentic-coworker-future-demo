import { describe, expect, it } from "vitest";
import { options, vanTemplates, visualAssetManifest } from "./catalog.js";
import { applyVisualSelectionsToCatalog, resolveVisualManifestPayload } from "./visual-manifest.js";
import { VisualManifestPayload } from "../types.js";

describe("visual manifest runtime wiring", () => {
  it("returns rights and taxonomy fields for each runtime asset", () => {
    const payload = resolveVisualManifestPayload(visualAssetManifest, vanTemplates, options);

    expect(payload.assets.length).toBeGreaterThan(0);
    const sample = payload.assets[0];
    expect(sample.rights).toBeDefined();
    expect(sample.rights.owner).toBeTruthy();
    expect(sample.taxonomy).toBeDefined();
    expect(typeof sample.taxonomy.qualityScore).toBe("number");
  });

  it("applies template mapping and required accessory fallback deterministically", () => {
    const manifest: VisualManifestPayload = {
      generatedAt: "2026-03-08T00:00:00.000Z",
      sourceDropFolder: "public/assets/source-drop/configurate",
      rightsFile: "public/assets/source-drop/configurate/rights.json",
      excludedAssets: [],
      assets: [
        {
          assetId: "asset-template-1",
          assetType: "source",
          imagePath: "/assets/configurate/demo-template.webp",
          rights: {
            owner: "Demo",
            usageScope: "local-demo",
            attributionRequired: false,
            source: "unit-test"
          },
          taxonomy: {
            subjectType: "van_exterior",
            sceneType: "hero",
            accessoryType: "none",
            angle: "front_three_quarter",
            environment: "mountain",
            lighting: "daylight",
            occupancySignal: "empty_scene",
            colorway: "mixed",
            styleTone: "premium",
            qualityScore: 90
          }
        }
      ],
      selections: {
        heroTemplateAssetIds: ["asset-template-1"],
        templateAssetByTemplateId: {
          "template-sable-escape": "asset-template-1"
        },
        accessoryAssetByOptionId: {},
        fallbackAccessoryImagePath: "/assets/accessories/accessory-default.svg"
      }
    };

    const { resolvedTemplates, resolvedOptions } = applyVisualSelectionsToCatalog(
      [vanTemplates[0]],
      [options.find((option) => option.id === "option-bike-rack")!],
      manifest
    );

    expect(resolvedTemplates[0].imagePath).toBe("/assets/configurate/demo-template.webp");
    expect(resolvedOptions[0].imagePath).toBe("/assets/accessories/accessory-default.svg");
  });
});
