# Visual ingestion notes

## Source-drop policy

- Primary ingestion path: `public/assets/source-drop/configurate`
- Required metadata contract: `public/assets/source-drop/configurate/rights.json`
- Ingestion command: `npm run assets:ingest`
- Generated runtime manifest: `public/assets/configurate/visual-manifest.generated.json`
- Exclusion policy: Noovo-origin assets are excluded from automated ingestion.

## Runtime behavior

- `GET /api/assets/visual-manifest` returns explicit rights + taxonomy payloads and deterministic selection maps.
- Selection rules:
  - 4 hero template images from high-quality `van_exterior` assets.
  - Accessory image by accessory type when available.
  - Fallback placeholder only when a required accessory type has no qualified match.
