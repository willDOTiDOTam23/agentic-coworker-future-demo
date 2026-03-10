#!/usr/bin/env python3
"""Ingest rights-cleared Configurate images, generate derivatives, classify taxonomy, and emit runtime manifest."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Tuple

from PIL import Image, ImageFilter, ImageOps, ImageStat

SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}

TEMPLATE_IDS = [
    "template-sable-escape",
    "template-ridge-ramble",
    "template-dune-nomad",
    "template-lumina-lounger",
]

OPTION_ACCESSORY_TYPE = {
    "option-solar-panels": "solar_panels",
    "option-shower-module": "shower_module",
    "option-portable-fridge": "fridge_module",
    "option-bike-rack": "bike_rack",
    "option-ski-rack": "ski_rack",
    "option-gear-locker": "gear_locker",
}


@dataclass
class RightsRecord:
    file: str
    owner: str
    usage_scope: str
    attribution_required: bool
    source: str


@dataclass
class Classification:
    subject_type: str
    scene_type: str
    accessory_type: str
    angle: str
    environment: str
    lighting: str
    occupancy_signal: str
    colorway: str
    style_tone: str


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def slugify(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "-", value.lower())
    return normalized.strip("-") or "asset"


def rel_web_path(path: Path, project_root: Path) -> str:
    rel = path.relative_to(project_root / "public")
    return f"/{'/'.join(rel.parts)}"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Ingest rights-cleared images from public/assets/source-drop/configurate, "
            "generate normalized derivatives, classify taxonomy, and output a deterministic runtime manifest."
        )
    )
    parser.add_argument(
        "--source-dir",
        default="public/assets/source-drop/configurate",
        help="Directory containing source images and rights.json",
    )
    parser.add_argument(
        "--output-dir",
        default="public/assets/configurate",
        help="Output directory for normalized derivatives and generated manifest",
    )
    return parser.parse_args()


def load_rights(rights_path: Path) -> Dict[str, RightsRecord]:
    if not rights_path.exists():
        raise FileNotFoundError(
            f"rights.json not found at {rights_path}. Add one file entry per image with owner/usageScope/attributionRequired/source."
        )

    raw = json.loads(rights_path.read_text())

    rows: List[dict]
    if isinstance(raw, list):
        rows = raw
    elif isinstance(raw, dict) and isinstance(raw.get("files"), list):
        rows = raw["files"]
    elif isinstance(raw, dict):
        rows = []
        for file_name, metadata in raw.items():
            if not isinstance(metadata, dict):
                continue
            rows.append({"file": file_name, **metadata})
    else:
        raise ValueError("rights.json has an unsupported structure.")

    rights: Dict[str, RightsRecord] = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        file_name = str(row.get("file", "")).strip()
        if not file_name:
            continue

        rights[file_name] = RightsRecord(
            file=file_name,
            owner=str(row.get("owner", "Unknown owner")).strip() or "Unknown owner",
            usage_scope=str(row.get("usageScope", "local-demo")).strip() or "local-demo",
            attribution_required=bool(row.get("attributionRequired", False)),
            source=str(row.get("source", "unknown-source")).strip() or "unknown-source",
        )

    return rights


def load_source_images(source_dir: Path) -> List[Path]:
    return sorted(
        [
            candidate
            for candidate in source_dir.iterdir()
            if candidate.is_file() and candidate.suffix.lower() in SUPPORTED_EXTENSIONS
        ],
        key=lambda path: path.name.lower(),
    )


def token_set(*values: str) -> set[str]:
    merged = " ".join(values).lower()
    tokens = re.split(r"[^a-z0-9]+", merged)
    return {token for token in tokens if token}


def choose_accessory_type(tokens: set[str]) -> str:
    mapping = {
        "solar_panels": {"solar", "renogy", "panel", "panels"},
        "shower_module": {"shower", "bath", "water"},
        "fridge_module": {"fridge", "refrigerator", "cooler"},
        "bike_rack": {"bike", "bicycle", "mtb"},
        "ski_rack": {"ski", "snowboard", "winter"},
        "gear_locker": {"locker", "storage", "box", "cargo"},
        "roof_rack": {"roof", "rack", "thule"},
        "awning": {"awning"},
        "storage_module": {"table", "module"},
    }
    for label, keys in mapping.items():
        if tokens & keys:
            return label
    return "unknown"


def average_rgb(image: Image.Image) -> Tuple[float, float, float]:
    stat = ImageStat.Stat(image.convert("RGB"))
    return float(stat.mean[0]), float(stat.mean[1]), float(stat.mean[2])


def infer_colorway(tokens: set[str], image: Image.Image) -> str:
    if tokens & {"olive", "green", "forest"}:
        return "olive"
    if tokens & {"graphite", "black", "charcoal", "matte"}:
        return "graphite"
    if tokens & {"white", "arctic", "snow"}:
        return "arctic_white"
    if tokens & {"sand", "beige", "dune", "tan"}:
        return "warm_sand"

    r, g, b = average_rgb(image)
    mean = (r + g + b) / 3
    if mean > 205:
        return "arctic_white"
    if g > r + 12 and g > b + 10:
        return "olive"
    if mean < 105 and abs(r - g) < 20 and abs(g - b) < 20:
        return "graphite"
    if r > g > b and r > 145:
        return "warm_sand"
    return "mixed"


def classify_image(file_name: str, rights_source: str, image: Image.Image) -> Classification:
    tokens = token_set(file_name, rights_source)
    accessory_type = choose_accessory_type(tokens)

    if tokens & {"interior", "cockpit", "kitchen", "bed", "mattress", "table", "cabin"}:
        subject_type = "van_interior"
    elif accessory_type != "unknown":
        subject_type = "accessory_detail"
    elif tokens & {"van", "sprinter", "camper", "unimog", "build", "exterior", "hero", "landscape"}:
        subject_type = "van_exterior"
    elif tokens & {"camp", "trip", "lifestyle", "family", "experience"}:
        subject_type = "lifestyle_scene"
    else:
        subject_type = "unknown"

    if tokens & {"hero", "landscape", "overview", "exterior"}:
        scene_type = "hero"
    elif tokens & {"detail", "close", "closeup", "module", "storage", "box"}:
        scene_type = "detail"
    elif tokens & {"people", "family", "experience", "camp"}:
        scene_type = "in_use"
    elif tokens & {"studio", "product", "isolated", "white"}:
        scene_type = "studio"
    else:
        scene_type = "unknown"

    if tokens & {"front", "hero"}:
        angle = "front_three_quarter"
    elif tokens & {"side", "landscape", "profile"}:
        angle = "side_profile"
    elif tokens & {"rear", "back"}:
        angle = "rear_three_quarter"
    elif tokens & {"interior", "cockpit", "cabin"}:
        angle = "interior_wide"
    elif tokens & {"detail", "close", "closeup", "macro"}:
        angle = "close_up"
    else:
        angle = "unknown"

    if tokens & {"mountain", "ridge", "snow", "winter", "alpine"}:
        environment = "mountain"
    elif tokens & {"forest", "wood", "trail"}:
        environment = "forest"
    elif tokens & {"desert", "dune"}:
        environment = "desert"
    elif tokens & {"beach", "coast", "coastal", "surf", "lake", "water"}:
        environment = "coastal"
    elif tokens & {"city", "urban", "street"}:
        environment = "urban"
    elif tokens & {"studio", "product", "white", "isolated"}:
        environment = "studio"
    else:
        environment = "unknown"

    if tokens & {"golden", "sunset", "dusk"}:
        lighting = "golden_hour"
    elif tokens & {"night", "evening"}:
        lighting = "night"
    elif tokens & {"overcast", "cloud"}:
        lighting = "overcast"
    elif tokens & {"studio", "product", "isolated"}:
        lighting = "studio"
    else:
        lighting = "daylight"

    if tokens & {"family", "kids", "kid", "child", "children"}:
        occupancy_signal = "family_context"
    elif tokens & {"people", "person", "human", "couple"}:
        occupancy_signal = "people_present"
    else:
        occupancy_signal = "empty_scene"

    if tokens & {"rugged", "offroad", "beast", "unimog"}:
        style_tone = "rugged"
    elif tokens & {"premium", "luxury", "lounge"}:
        style_tone = "premium"
    elif tokens & {"minimal", "clean"}:
        style_tone = "minimal"
    elif tokens & {"sport", "performance"}:
        style_tone = "sport"
    elif tokens & {"boho", "relax", "retreat"}:
        style_tone = "relaxed"
    else:
        style_tone = "unknown"

    return Classification(
        subject_type=subject_type,
        scene_type=scene_type,
        accessory_type=accessory_type,
        angle=angle,
        environment=environment,
        lighting=lighting,
        occupancy_signal=occupancy_signal,
        colorway=infer_colorway(tokens, image),
        style_tone=style_tone,
    )


def cover_resize(image: Image.Image, width: int, height: int) -> Image.Image:
    return ImageOps.fit(image, (width, height), method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))


def bounded_resize(image: Image.Image, max_edge: int) -> Image.Image:
    copy = image.copy()
    copy.thumbnail((max_edge, max_edge), Image.Resampling.LANCZOS)
    return copy


def quality_score(image: Image.Image) -> int:
    width, height = image.size
    pixels = width * height
    target_pixels = 1600 * 900
    pixel_component = min(pixels / target_pixels, 1.0) * 45

    aspect = width / max(height, 1)
    target_aspect = 16 / 9 if width >= height else 4 / 3
    aspect_component = max(0.0, 1 - abs(aspect - target_aspect) / target_aspect) * 20

    luminance = image.convert("L")
    contrast = ImageStat.Stat(luminance).stddev[0]
    contrast_component = min(contrast / 64.0, 1.0) * 20

    edge_mean = ImageStat.Stat(luminance.filter(ImageFilter.FIND_EDGES)).mean[0]
    sharpness_component = min(edge_mean / 60.0, 1.0) * 15

    score = int(round(pixel_component + aspect_component + contrast_component + sharpness_component))
    return max(35, min(97, score))


def write_derivatives(image: Image.Image, output_dir: Path) -> Dict[str, str]:
    output_dir.mkdir(parents=True, exist_ok=True)

    source = bounded_resize(image, 1920)
    source_path = output_dir / "source.webp"
    source.save(source_path, "WEBP", quality=88, method=6)

    hero_path = output_dir / "hero.webp"
    cover_resize(image, 1600, 900).save(hero_path, "WEBP", quality=86, method=6)

    card_path = output_dir / "card.webp"
    cover_resize(image, 1200, 900).save(card_path, "WEBP", quality=84, method=6)

    thumb_path = output_dir / "thumb.webp"
    cover_resize(image, 640, 480).save(thumb_path, "WEBP", quality=82, method=6)

    return {
        "source": str(source_path),
        "hero": str(hero_path),
        "card": str(card_path),
        "thumb": str(thumb_path),
    }


def select_hero_templates(assets: List[dict]) -> List[str]:
    preferred = [
        asset
        for asset in assets
        if asset["taxonomy"]["subjectType"] == "van_exterior"
        and asset["taxonomy"]["qualityScore"] >= 65
        and asset["taxonomy"]["sceneType"] in {"hero", "in_use", "detail", "unknown"}
    ]

    if len(preferred) < 4:
        extra = [asset for asset in assets if asset["taxonomy"]["subjectType"] == "van_exterior" and asset not in preferred]
        preferred.extend(extra)

    if len(preferred) < 4:
        extra = [asset for asset in assets if asset not in preferred]
        preferred.extend(extra)

    ranked = sorted(preferred, key=lambda item: (-item["taxonomy"]["qualityScore"], item["assetId"]))
    return [asset["assetId"] for asset in ranked[:4]]


def select_accessory_assets(assets: List[dict]) -> Dict[str, str]:
    rankings = sorted(assets, key=lambda item: (-item["taxonomy"]["qualityScore"], item["assetId"]))
    mapping: Dict[str, str] = {}

    for option_id, accessory_type in OPTION_ACCESSORY_TYPE.items():
        exact = [
            asset
            for asset in rankings
            if asset["taxonomy"]["accessoryType"] == accessory_type and asset["taxonomy"]["qualityScore"] >= 55
        ]
        if exact:
            mapping[option_id] = exact[0]["assetId"]

    return mapping


def should_exclude(file_name: str, rights: RightsRecord) -> Tuple[bool, str]:
    lower = f"{file_name.lower()} {rights.source.lower()} {rights.owner.lower()}"
    if "noovo" in lower:
        return True, "Excluded by policy: Noovo-origin content is not ingested automatically."
    return False, ""


def as_web_manifest_record(
    *,
    asset_id: str,
    rights: RightsRecord,
    classification: Classification,
    quality_score_value: int,
    image_path: str,
    derivatives: Dict[str, str],
    dimensions: Tuple[int, int],
    source_file: str,
) -> dict:
    width, height = dimensions
    return {
        "assetId": asset_id,
        "assetType": "source",
        "imagePath": image_path,
        "taxonomy": {
            "subjectType": classification.subject_type,
            "sceneType": classification.scene_type,
            "accessoryType": classification.accessory_type,
            "angle": classification.angle,
            "environment": classification.environment,
            "lighting": classification.lighting,
            "occupancySignal": classification.occupancy_signal,
            "colorway": classification.colorway,
            "styleTone": classification.style_tone,
            "qualityScore": quality_score_value,
        },
        "rights": {
            "owner": rights.owner,
            "usageScope": rights.usage_scope,
            "attributionRequired": rights.attribution_required,
            "source": rights.source,
        },
        "derivatives": derivatives,
        "sourceFile": source_file,
        "generatedFromIngestion": True,
        "sourceUrl": rights.source,
        "attributionRequired": rights.attribution_required,
    }


def main() -> None:
    args = parse_args()

    project_root = Path(__file__).resolve().parents[1]
    source_dir = (project_root / args.source_dir).resolve()
    output_root = (project_root / args.output_dir).resolve()
    normalized_root = output_root / "normalized"
    manifest_path = output_root / "visual-manifest.generated.json"
    rights_path = source_dir / "rights.json"

    source_dir.mkdir(parents=True, exist_ok=True)
    output_root.mkdir(parents=True, exist_ok=True)

    rights_map = load_rights(rights_path)
    source_images = load_source_images(source_dir)

    assets: List[dict] = []
    excluded_assets: List[dict] = []
    skipped_missing_rights: List[str] = []

    for source_path in source_images:
        rights = rights_map.get(source_path.name)
        if rights is None:
            skipped_missing_rights.append(source_path.name)
            continue

        exclude, reason = should_exclude(source_path.name, rights)
        if exclude:
            excluded_assets.append({"file": source_path.name, "reason": reason})
            continue

        with Image.open(source_path) as img:
            image = img.convert("RGB")
            width, height = image.size

            digest = hashlib.sha1(f"{source_path.name}:{rights.source}".encode("utf-8")).hexdigest()[:10]
            asset_id = f"source-{slugify(source_path.stem)}-{digest}"
            derivative_dir = normalized_root / asset_id
            derivative_paths = write_derivatives(image, derivative_dir)

            classification = classify_image(source_path.name, rights.source, image)
            score = quality_score(image)

            record = as_web_manifest_record(
                asset_id=asset_id,
                rights=rights,
                classification=classification,
                quality_score_value=score,
                image_path=rel_web_path(Path(derivative_paths["hero"]), project_root),
                derivatives={
                    key: rel_web_path(Path(path), project_root)
                    for key, path in derivative_paths.items()
                },
                dimensions=(width, height),
                source_file=source_path.name,
            )
            record["taxonomy"]["qualityScore"] = score
            record["dimensions"] = {"width": width, "height": height}
            assets.append(record)

    sorted_assets = sorted(assets, key=lambda item: (-item["taxonomy"]["qualityScore"], item["assetId"]))

    hero_asset_ids = select_hero_templates(sorted_assets)
    template_asset_by_template_id = {
        template_id: hero_asset_ids[index]
        for index, template_id in enumerate(TEMPLATE_IDS)
        if index < len(hero_asset_ids)
    }

    accessory_asset_by_option_id = select_accessory_assets(sorted_assets)

    manifest = {
        "generatedAt": now_iso(),
        "sourceDropFolder": "public/assets/source-drop/configurate",
        "rightsFile": "public/assets/source-drop/configurate/rights.json",
        "excludedAssets": excluded_assets,
        "assets": sorted_assets,
        "selections": {
            "heroTemplateAssetIds": hero_asset_ids,
            "templateAssetByTemplateId": template_asset_by_template_id,
            "accessoryAssetByOptionId": accessory_asset_by_option_id,
            "fallbackAccessoryImagePath": "/assets/accessories/accessory-default.svg",
        },
        "warnings": {
            "missingRightsEntries": skipped_missing_rights,
            "totalScanned": len(source_images),
            "totalIngested": len(sorted_assets),
        },
    }

    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")

    print(f"Ingested {len(sorted_assets)} image(s).")
    if skipped_missing_rights:
        print(f"Skipped {len(skipped_missing_rights)} file(s) missing rights metadata.")
    if excluded_assets:
        print(f"Excluded {len(excluded_assets)} file(s) by source policy.")
    print(f"Manifest: {manifest_path}")


if __name__ == "__main__":
    main()
