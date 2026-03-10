"""Legacy generator retained as an optional fallback, not the primary visual sourcing path."""
import argparse
import base64
import json
import os
import re
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from openai import OpenAI
from openai import BadRequestError


STYLE_ANCHOR = (
  "A cinematic stylized realism and hyper-real CGI image in a consistent visual family called "
  "\"muted-adventure-suite\": clean architectural concept-art composition, matte painting look, "
  "cinematic color grading, coherent outdoor palette, polished materials, coherent product-shape language."
)

USE_CASE = "stylized-concept"

PALETTE = (
  "Palette: muted earth, forest greens, matte graphite, silver-gray accent metal, warm dune beige, "
  "soft amber dusk and restrained peach highlights."
)

COMMON_MOTION = (
  "Keep the same camera feel across all renders with natural three-quarter hero angle, soft horizon bloom, "
  "consistent light direction and balanced contrast."
)

CONSISTENCY_NOTE = (
  "Use one shared style system for all assets: same 45mm lens perspective, same depth feel, "
  "same environmental haze, same paint material response, same edge lighting, same shadow architecture, "
  "same weather-neutral outdoor mood."
)

NO_TEXT_RULES = (
  "Do not include any readable text, labels, captions, numbers, logos, decals, signage, UI, "
  "watermarks, license plates, or model badges anywhere in the image."
)


@dataclass(frozen=True)
class VisualJob:
  assetId: str
  assetType: str
  target: Path
  role: str
  title: str
  subject: str
  details: str


def build_prompt(job: VisualJob) -> str:
  return (
    f"{STYLE_ANCHOR} {PALETTE} "
    f"{COMMON_MOTION} {CONSISTENCY_NOTE} {NO_TEXT_RULES} "
    f"Asset type: {job.assetType}. "
    f"Reference role: {job.role}. "
    f"Title: {job.title}. "
    f"Subject: {job.subject}. "
    f"Details: {job.details}."
  )


def fetch_image_data(response) -> bytes:
  image = response.data[0]
  if getattr(image, "b64_json", None):
    return base64.b64decode(image.b64_json)
  if not image.url:
    raise RuntimeError("OpenAI image result did not include b64_json or url.")
  with urllib.request.urlopen(image.url, timeout=30) as image_stream:
    return image_stream.read()


def generate_image(client: OpenAI, model: str, prompt: str):
  request_args = {
    "model": model,
    "prompt": prompt,
    "n": 1,
    "size": "1024x1024",
  }
  try:
    return client.images.generate(**request_args, response_format="url")
  except BadRequestError as e:
    if "response_format" not in str(e):
      raise
    return client.images.generate(**request_args)


def write_manifest(manifest_path: Path, jobs, generation_results):
  rows = []
  for job in jobs:
    result = generation_results.get(job.assetId, {})
    rows.append({
      "assetId": job.assetId,
      "assetType": job.assetType,
      "path": str(job.target),
      "prompt": build_prompt(job),
      "style": {
        "styleKey": "muted-adventure-suite",
        "palette": PALETTE,
        "generatedAt": result.get("generatedAt", ""),
        "modelHint": result.get("modelHint", "not-generated"),
        "seedHint": result.get("seedHint", "adventure-v1"),
        "useCase": USE_CASE
      }
    })
  manifest_path.write_text(json.dumps({
    "generatedAt": datetime.now(timezone.utc).isoformat(),
    "totalAssets": len(rows),
    "status": "generated" if generation_results else "manifest-only",
    "assets": rows
  }, indent=2) + "\n")


def normalize_path(value: str) -> Path:
  return Path(value.strip().strip('\"').strip("'"))


def normalize_key(value: str) -> str:
  return str(value).strip().strip('"').strip("'")


def has_valid_key_shape(value: str) -> bool:
  if not value or not value.startswith("sk-"):
    return False
  if "..." in value:
    return False
  return len(value) >= 40


def load_env_key(env_path: Path = Path(".env")) -> str:
  env_key = normalize_key(os.getenv("OPENAI_API_KEY", ""))
  if has_valid_key_shape(env_key):
    return env_key

  if not env_path.exists():
    raise RuntimeError("OPENAI_API_KEY is not set and .env file was not found.")

  pattern = re.compile(r"^\s*OPENAI_API_KEY\s*=\s*(.+?)\s*$")
  for raw in env_path.read_text().splitlines():
    match = pattern.match(raw)
    if not match:
      continue
    value = normalize_key(match.group(1).strip())
    if has_valid_key_shape(value):
      return value
  raise RuntimeError("OPENAI_API_KEY not found in .env.")


def parse_args():
  parser = argparse.ArgumentParser(
    description=(
      "Legacy: regenerate adventure visual assets with a coherent prompt template. "
      "Kept for optional fallback and experimentation only; stock-first sourcing is preferred."
    )
  )
  parser.add_argument("--dry-run", action="store_true", help="Print planned prompts without calling the image API.")
  parser.add_argument(
    "--manifest-only",
    action="store_true",
    help="Write manifest without generating images (legacy path only)."
  )
  parser.add_argument("--out-dir", default="public/assets", help="Output root directory for rendered visuals.")
  return parser.parse_args()


def main():
  args = parse_args()
  client = OpenAI(api_key=load_env_key())

  jobs = [
    VisualJob(
      "template-sable-escape",
      "template",
      normalize_path("public/assets/van-styles/sable-escape.png"),
      "adventure van concept render",
      "Sable Escape",
      "Beach-to-forest adventure van, warm horizon scene",
      "Lifted expedition van with matte sand-beige skin, compact camp kit integration, subtle rear utility shell and compact mountain-ready proportion."
    ),
    VisualJob(
      "template-ridge-ramble",
      "template",
      normalize_path("public/assets/van-styles/ridge-ramble.png"),
      "adventure van concept render",
      "Ridge Ramble",
      "Mountain trail adventure van, muted green setting",
      "Wide-tired expedition shell with reinforced rack hardware, utility rail contrast, and disciplined cool-green highlights."
    ),
    VisualJob(
      "template-dune-nomad",
      "template",
      normalize_path("public/assets/van-styles/dune-nomad.png"),
      "adventure van concept render",
      "Dune Nomad",
      "Modern desert-and-city crossover concept with work-ready interior tone",
      "Sleek gray-toned adventure shell with angular architecture, low-profile cargo silhouette, and quiet utility interior cue."
    ),
    VisualJob(
      "template-lumina-lounger",
      "template",
      normalize_path("public/assets/van-styles/luminis-lounger.png"),
      "adventure van concept render",
      "Luminis Lounger",
      "Luxury concept with warm night-ready ambience",
      "Premium shell geometry, premium cabin geometry cues, amber and peach ambient interior glow and soft matte reflection."
    ),
    VisualJob(
      "option-solar-panels",
      "accessory",
      normalize_path("public/assets/accessories/solar-panels.png"),
      "accessory module",
      "Solar Panel Kit",
      "Roof-mounted solar concept",
      "Roof-integrated solar module with clean fastener lines and compact cable conduit integration."
    ),
    VisualJob(
      "option-shower-module",
      "accessory",
      normalize_path("public/assets/accessories/shower-module.png"),
      "accessory module",
      "Shower Module",
      "Mobile utility shower add-on concept",
      "Privacy-shell shower module with matte shell materials and practical utility geometry."
    ),
    VisualJob(
      "option-portable-fridge",
      "accessory",
      normalize_path("public/assets/accessories/fridge-module.png"),
      "accessory module",
      "Fridge Module",
      "Refrigeration utility pod",
      "Compact cooling module with integrated hatch and subtle directional line art in matte finish."
    ),
    VisualJob(
      "option-bike-rack",
      "accessory",
      normalize_path("public/assets/accessories/bike-rack.png"),
      "accessory module",
      "Bike Rack",
      "Rear cargo rack concept",
      "Rear rail bike rack system with compact loops and lock-ready geometry."
    ),
    VisualJob(
      "option-ski-rack",
      "accessory",
      normalize_path("public/assets/accessories/ski-rack.png"),
      "accessory module",
      "Ski Rack",
      "Roof-forward snow rack concept",
      "Protective ski platform with reinforced tie-down structure and clean aerodynamic roofline placement."
    ),
    VisualJob(
      "option-gear-locker",
      "accessory",
      normalize_path("public/assets/accessories/gear-locker.png"),
      "accessory module",
      "Gear Locker",
      "Secure storage add-on concept",
      "Under-seat lockable compartment visualized as a clean, durable matte utility shell."
    )
  ]

  if args.dry_run:
    for job in jobs:
      print(f"{job.assetId} -> {job.target}\n{build_prompt(job)}\n")
    manifest_path = Path(args.out_dir) / "visual-generation-manifest.json"
    write_manifest(manifest_path, jobs, {})
    print(f"Manifest written to {manifest_path}")
    return

  if args.manifest_only:
    manifest_path = Path(args.out_dir) / "visual-generation-manifest.json"
    write_manifest(manifest_path, jobs, {})
    print(f"Manifest written to {manifest_path}")
    return

  model = "dall-e-3"
  results = {}

  for job in jobs:
    job.target.parent.mkdir(parents=True, exist_ok=True)
    prompt = build_prompt(job)
    print(f"Generating {job.assetId} ...")
    response = generate_image(client=client, model=model, prompt=prompt)
    data = fetch_image_data(response)
    job.target.write_bytes(data)
    results[job.assetId] = {
      "generatedAt": datetime.now(timezone.utc).isoformat(),
      "modelHint": model,
      "seedHint": "adventure-v1"
    }

  manifest_path = Path(args.out_dir) / "visual-generation-manifest.json"
  write_manifest(manifest_path, jobs, results)
  print(f"Wrote {len(jobs)} images and manifest to {manifest_path}")


if __name__ == "__main__":
  main()
