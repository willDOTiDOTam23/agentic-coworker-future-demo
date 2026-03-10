import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "public" / "assets" / "configurate" / "visual-manifest.generated.json"


def load_manifest():
    if not MANIFEST_PATH.exists():
        pytest.skip(f"Generated manifest not found at {MANIFEST_PATH}; run npm run assets:ingest")
    return json.loads(MANIFEST_PATH.read_text())


def test_taxonomy_shape_and_ranges():
    manifest = load_manifest()
    assets = manifest["assets"]
    assert assets

    required_keys = {
        "subjectType",
        "sceneType",
        "accessoryType",
        "angle",
        "environment",
        "lighting",
        "occupancySignal",
        "colorway",
        "styleTone",
        "qualityScore",
    }

    for asset in assets:
        taxonomy = asset["taxonomy"]
        assert required_keys.issubset(taxonomy.keys())
        assert 0 <= taxonomy["qualityScore"] <= 100
        assert "rights" in asset
        assert asset["rights"]["owner"]


def test_selection_payload_is_deterministic_shape():
    manifest = load_manifest()
    selections = manifest["selections"]

    assert len(selections["heroTemplateAssetIds"]) <= 4
    assert len(set(selections["heroTemplateAssetIds"])) == len(selections["heroTemplateAssetIds"])
    assert "templateAssetByTemplateId" in selections
    assert "accessoryAssetByOptionId" in selections
    assert selections["fallbackAccessoryImagePath"]

    all_ids = {asset["assetId"] for asset in manifest["assets"]}
    for template_asset in selections["templateAssetByTemplateId"].values():
        assert template_asset in all_ids
    for option_asset in selections["accessoryAssetByOptionId"].values():
        assert option_asset in all_ids
