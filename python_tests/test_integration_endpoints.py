import json
import os
import signal
import subprocess
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import pytest


ROOT = Path(__file__).resolve().parents[1]
PORT = int(os.environ.get("DEMO_PORT", "3100"))
BASE_URL = f"http://127.0.0.1:{PORT}"


def fetch_json(path: str):
    req = Request(f"{BASE_URL}{path}", method="GET")
    with urlopen(req, timeout=5) as response:
        payload = response.read()
    return json.loads(payload.decode("utf-8"))


def wait_for_server(max_wait_seconds=8):
    deadline = time.time() + max_wait_seconds
    while time.time() < deadline:
        try:
            data = fetch_json("/health")
            if data.get("status") == "ok":
                return
        except (URLError, HTTPError, OSError, ValueError):
            time.sleep(0.25)
            continue
    raise AssertionError("Server did not become healthy in time")


@pytest.fixture(scope="session")
def running_server():
    env = os.environ.copy()
    env["PORT"] = str(PORT)
    proc = subprocess.Popen(
        ["npx", "tsx", "src/server.ts"],
        cwd=str(ROOT),
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        wait_for_server()
        yield proc
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.send_signal(signal.SIGKILL)


def post_json(path: str, payload: dict):
    body = json.dumps(payload).encode("utf-8")
    req = Request(
        f"{BASE_URL}{path}",
        data=body,
        method="POST",
        headers={"Content-Type": "application/json"},
    )
    with urlopen(req, timeout=5) as response:
        return json.loads(response.read().decode("utf-8"))


def test_health_and_root_catalog(running_server):
    del running_server
    health = fetch_json("/health")
    assert health.get("status") == "ok"

    catalog = fetch_json("/api/catalog")
    assert catalog["vanTemplates"]
    assert len(catalog["vanTemplates"]) >= 4
    assert catalog["options"]
    assert catalog["visualAssetManifest"]
    assert catalog["visualSelections"]
    sample_asset = catalog["visualAssetManifest"][0]
    assert "rights" in sample_asset
    assert "taxonomy" in sample_asset


def test_template_api_and_visual_manifest_alignment(running_server):
    del running_server
    templates = fetch_json("/api/van/templates")
    manifest = fetch_json("/api/assets/visual-manifest")
    assets = manifest["assets"]
    selections = manifest["selections"]
    asset_by_id = {item["assetId"]: item for item in assets}
    template_mapping = selections["templateAssetByTemplateId"]

    assert len(templates) >= 4
    for template in templates:
        assert template["id"] in template_mapping
        selected_asset = asset_by_id[template_mapping[template["id"]]]
        assert template["imagePath"] == selected_asset["imagePath"]
        assert template.get("imagePath")
        assert template.get("imagePrompt")


def test_accessory_images_are_config_wired(running_server):
    del running_server
    catalog = fetch_json("/api/catalog")
    options = catalog["options"]
    visual_manifest = fetch_json("/api/assets/visual-manifest")
    asset_by_id = {item["assetId"]: item for item in visual_manifest["assets"]}
    accessory_mapping = visual_manifest["selections"]["accessoryAssetByOptionId"]
    fallback_image = visual_manifest["selections"]["fallbackAccessoryImagePath"]
    required_accessories = [
        "option-solar-panels",
        "option-shower-module",
        "option-portable-fridge",
        "option-bike-rack",
        "option-ski-rack",
        "option-gear-locker",
    ]
    mapped = {}
    for option in options:
        if option["id"] in required_accessories:
            mapped[option["id"]] = option.get("imagePath")
    assert len(mapped) == len(required_accessories)
    for option_id in required_accessories:
        assert option_id in mapped
        assert mapped[option_id]
        mapped_asset_id = accessory_mapping.get(option_id)
        if mapped_asset_id:
            assert mapped_asset_id in asset_by_id
            assert asset_by_id[mapped_asset_id]["imagePath"] == mapped[option_id]
        else:
            assert mapped[option_id] == fallback_image


def test_ops_dashboard_returns_kpi_and_queue_payload(running_server):
    del running_server
    catalog = fetch_json("/api/ops/dashboard")
    assert "kpis" in catalog
    assert "performanceBugs" in catalog
    assert "featureIdeas" in catalog
    assert "recentTransactions" in catalog
