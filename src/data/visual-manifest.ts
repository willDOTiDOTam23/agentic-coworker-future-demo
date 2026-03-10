import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { OptionItem, VanTemplate, VisualAssetRecord, VisualManifestPayload, VisualSelectionPayload, VisualTaxonomy } from "../types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const generatedManifestPath = path.join(repoRoot, "public/assets/configurate/visual-manifest.generated.json");

const REQUIRED_ACCESSORY_OPTION_IDS = [
  "option-solar-panels",
  "option-shower-module",
  "option-portable-fridge",
  "option-bike-rack",
  "option-ski-rack",
  "option-gear-locker"
];

function defaultTaxonomyForAsset(assetType: VisualAssetRecord["assetType"]): VisualTaxonomy {
  return {
    subjectType: assetType === "template" ? "van_exterior" : assetType === "option" ? "accessory_detail" : "unknown",
    sceneType: assetType === "template" ? "hero" : "detail",
    accessoryType: assetType === "template" ? "none" : "unknown",
    angle: assetType === "template" ? "front_three_quarter" : "close_up",
    environment: assetType === "template" ? "mountain" : "studio",
    lighting: "daylight",
    occupancySignal: "empty_scene",
    colorway: "mixed",
    styleTone: assetType === "template" ? "premium" : "minimal",
    qualityScore: 60
  };
}

function normalizeAssetRecord(record: VisualAssetRecord): VisualAssetRecord {
  return {
    ...record,
    taxonomy: {
      ...defaultTaxonomyForAsset(record.assetType),
      ...(record.taxonomy ?? {})
    },
    rights: {
      owner: record.rights?.owner ?? "Unknown owner",
      usageScope: record.rights?.usageScope ?? "local-demo",
      attributionRequired: Boolean(record.rights?.attributionRequired ?? record.attributionRequired),
      source: record.rights?.source ?? record.sourceUrl ?? record.sourceNote ?? "unknown-source"
    }
  };
}

function buildDefaultSelections(
  assets: VisualAssetRecord[],
  templates: VanTemplate[],
  options: OptionItem[]
): VisualSelectionPayload {
  const normalizedAssets = assets.map(normalizeAssetRecord);
  const templateAssets = normalizedAssets
    .filter((asset) => asset.assetType === "template")
    .sort((a, b) => (b.taxonomy.qualityScore ?? 0) - (a.taxonomy.qualityScore ?? 0));

  const templateAssetByTemplateId: Record<string, string> = {};
  templates.forEach((template, index) => {
    const selected = templateAssets[index] ?? templateAssets[0];
    if (selected) {
      templateAssetByTemplateId[template.id] = selected.assetId;
    }
  });

  const accessoryAssetByOptionId: Record<string, string> = {};
  options.forEach((option) => {
    const selected = normalizedAssets.find((asset) => asset.assetId === option.id && asset.assetType === "option");
    if (selected) {
      accessoryAssetByOptionId[option.id] = selected.assetId;
    }
  });

  return {
    heroTemplateAssetIds: Object.values(templateAssetByTemplateId),
    templateAssetByTemplateId,
    accessoryAssetByOptionId,
    fallbackAccessoryImagePath: "/assets/accessories/accessory-default.svg"
  };
}

function buildFallbackPayload(
  assets: VisualAssetRecord[],
  templates: VanTemplate[],
  options: OptionItem[]
): VisualManifestPayload {
  const normalizedAssets = assets.map(normalizeAssetRecord);
  return {
    generatedAt: new Date(0).toISOString(),
    sourceDropFolder: "public/assets/source-drop/configurate",
    rightsFile: "public/assets/source-drop/configurate/rights.json",
    excludedAssets: [],
    assets: normalizedAssets,
    selections: buildDefaultSelections(normalizedAssets, templates, options)
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseGeneratedPayload(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export function resolveVisualManifestPayload(
  defaultAssets: VisualAssetRecord[],
  templates: VanTemplate[],
  options: OptionItem[]
): VisualManifestPayload {
  const fallback = buildFallbackPayload(defaultAssets, templates, options);

  if (!fs.existsSync(generatedManifestPath)) {
    return fallback;
  }

  const parsed = parseGeneratedPayload(fs.readFileSync(generatedManifestPath, "utf8"));
  if (!isRecord(parsed)) {
    return fallback;
  }

  const parsedAssets = Array.isArray(parsed.assets) ? (parsed.assets as VisualAssetRecord[]).map(normalizeAssetRecord) : fallback.assets;
  const selections = isRecord(parsed.selections)
    ? {
        heroTemplateAssetIds: Array.isArray(parsed.selections.heroTemplateAssetIds)
          ? (parsed.selections.heroTemplateAssetIds as string[])
          : [],
        templateAssetByTemplateId: isRecord(parsed.selections.templateAssetByTemplateId)
          ? (parsed.selections.templateAssetByTemplateId as Record<string, string>)
          : {},
        accessoryAssetByOptionId: isRecord(parsed.selections.accessoryAssetByOptionId)
          ? (parsed.selections.accessoryAssetByOptionId as Record<string, string>)
          : {},
        fallbackAccessoryImagePath:
          typeof parsed.selections.fallbackAccessoryImagePath === "string"
            ? parsed.selections.fallbackAccessoryImagePath
            : fallback.selections.fallbackAccessoryImagePath
      }
    : fallback.selections;

  return {
    generatedAt: typeof parsed.generatedAt === "string" ? parsed.generatedAt : fallback.generatedAt,
    sourceDropFolder: typeof parsed.sourceDropFolder === "string" ? parsed.sourceDropFolder : fallback.sourceDropFolder,
    rightsFile: typeof parsed.rightsFile === "string" ? parsed.rightsFile : fallback.rightsFile,
    excludedAssets: Array.isArray(parsed.excludedAssets)
      ? (parsed.excludedAssets as Array<{ file: string; reason: string }>)
      : fallback.excludedAssets,
    assets: parsedAssets,
    selections: {
      heroTemplateAssetIds:
        selections.heroTemplateAssetIds.length > 0 ? selections.heroTemplateAssetIds : fallback.selections.heroTemplateAssetIds,
      templateAssetByTemplateId:
        Object.keys(selections.templateAssetByTemplateId).length > 0
          ? selections.templateAssetByTemplateId
          : fallback.selections.templateAssetByTemplateId,
      accessoryAssetByOptionId:
        Object.keys(selections.accessoryAssetByOptionId).length > 0
          ? selections.accessoryAssetByOptionId
          : fallback.selections.accessoryAssetByOptionId,
      fallbackAccessoryImagePath: selections.fallbackAccessoryImagePath
    }
  };
}

export function applyVisualSelectionsToCatalog(
  templates: VanTemplate[],
  options: OptionItem[],
  manifest: VisualManifestPayload
) {
  const assetById = new Map(manifest.assets.map((asset) => [asset.assetId, asset]));

  const resolvedTemplates = templates.map((template) => {
    const assetId = manifest.selections.templateAssetByTemplateId[template.id];
    const selected = assetId ? assetById.get(assetId) : undefined;
    return {
      ...template,
      imagePath: selected?.imagePath ?? template.imagePath
    };
  });

  const resolvedOptions = options.map((option) => {
    const mappedAssetId = manifest.selections.accessoryAssetByOptionId[option.id];
    const selected = mappedAssetId ? assetById.get(mappedAssetId) : undefined;
    const requiresImage = REQUIRED_ACCESSORY_OPTION_IDS.includes(option.id);
    const fallback = requiresImage ? manifest.selections.fallbackAccessoryImagePath : option.imagePath;

    return {
      ...option,
      imagePath: selected?.imagePath ?? (requiresImage ? fallback : option.imagePath ?? fallback)
    };
  });

  return {
    resolvedTemplates,
    resolvedOptions
  };
}

export { generatedManifestPath, REQUIRED_ACCESSORY_OPTION_IDS };
