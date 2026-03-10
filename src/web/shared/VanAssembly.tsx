import type { ConfigurationSession, StepId, VisualizationSpec } from "../../lib/domain.js";

interface VanAssemblyProps {
  session?: ConfigurationSession | null;
  visualSpec?: VisualizationSpec | null;
}

const FALLBACK_SPEC: VisualizationSpec = {
  generatedBy: "deterministic",
  updatedAt: new Date(0).toISOString(),
  currentStep: "vision",
  theme: {
    paletteName: "Sunlit trail",
    backgroundLocked: false,
    backgroundA: "#f7e6c7",
    backgroundB: "#ebd7a4",
    accent: "#cf7b3f",
    accentAlt: "#3f7288",
    ink: "#182125",
    bodyColor: "#d7b892",
    cabinColor: "#f7f1e8"
  },
  stepRail: [
    { step: "vision", label: "Vision and use case", state: "current" },
    { step: "exterior", label: "Exterior spec", state: "upcoming" },
    { step: "interior", label: "Interior spec", state: "upcoming" },
    { step: "layout", label: "Layout and sleeping", state: "upcoming" },
    { step: "gear", label: "Gear, review, and submit", state: "upcoming" }
  ],
  visionHighlights: {
    title: "Northstar custom build",
    summary: "Shape the story first. The van updates as the guide collects the build intent.",
    chips: ["Weekend escape", "Calm cabin", "Adventure-ready"]
  },
  exteriorScene: {
    bodyColor: "#d7b892",
    finish: "Satin finish",
    wheelRadius: 26,
    wheelStyle: "All-terrain alloy",
    rackStyle: "Touring rail",
    auxLights: "Minimal driving lights",
    powertrain: "AWD",
    driveSide: "left",
    frontSeatConfig: "Twin captain seats",
    roofGear: "Low-profile rack",
    rearCarrier: "No rear carrier",
    ladder: false,
    campLighting: "Soft perimeter lighting",
    badges: ["AWD", "Satin"],
    overlays: ["Low-profile rack", "Soft perimeter lighting"]
  },
  interiorSwatches: {
    fixtureColor: "Warm birch",
    primaryTexture: "Matte linen",
    secondaryTexture: "Stone wool",
    stitchingColor: "Sand stitch",
    seatFinish: "Weatherproof camel",
    notes: ["Light cabinetry", "Soft-touch surfaces"]
  },
  layoutFloorplan: {
    gridColumns: 12,
    gridRows: 6,
    driveSide: "left",
    frontSeatConfig: "Twin captain seats",
    notes: ["Left-hand drive", "Compact galley", "Convertible lounge bed"],
    zones: [
      { kind: "driver", x: 0, y: 0, w: 2, h: 2, label: "LHD cockpit", emphasis: "primary" },
      { kind: "passenger", x: 2, y: 0, w: 2, h: 2, label: "Passenger seat", emphasis: "secondary" },
      { kind: "galley", x: 0, y: 2, w: 4, h: 2, label: "Compact galley", emphasis: "primary" },
      { kind: "dinette", x: 4, y: 2, w: 4, h: 2, label: "Two-seat dinette", emphasis: "support" },
      { kind: "storage", x: 8, y: 2, w: 4, h: 2, label: "Tall storage", emphasis: "secondary" },
      { kind: "bed", x: 2, y: 4, w: 8, h: 2, label: "Convertible bed", emphasis: "primary" }
    ]
  },
  gearScene: {
    roofGear: "Low-profile rack",
    rearCarrier: "No rear carrier",
    ladder: false,
    powerModule: "Lithium off-grid pack",
    campLighting: "Soft perimeter lighting",
    modules: [
      { id: "roof-gear", label: "Roof gear", detail: "Low-profile rack", status: "optional" },
      { id: "rear-carrier", label: "Rear carrier", detail: "No rear carrier", status: "inactive" },
      { id: "power-module", label: "Power module", detail: "Lithium off-grid pack", status: "active" },
      { id: "camp-lighting", label: "Camp lighting", detail: "Soft perimeter lighting", status: "optional" }
    ]
  }
};

function colorSwatch(value: string, fallback: string) {
  const normalized = value.toLowerCase();

  if (normalized.includes("forest") || normalized.includes("sage") || normalized.includes("moss")) return "#6f8a6f";
  if (normalized.includes("blue") || normalized.includes("ocean") || normalized.includes("storm")) return "#587e98";
  if (normalized.includes("sand") || normalized.includes("camel") || normalized.includes("dune")) return "#c49d72";
  if (normalized.includes("charcoal") || normalized.includes("graphite") || normalized.includes("black")) return "#5d6570";
  if (normalized.includes("linen") || normalized.includes("ivory") || normalized.includes("cream")) return "#ece5d9";
  if (normalized.includes("oak") || normalized.includes("birch") || normalized.includes("wood")) return "#c8a57f";
  if (normalized.includes("stone") || normalized.includes("ash") || normalized.includes("grey")) return "#b7b7b2";
  if (normalized.includes("white")) return "#f8f7f2";

  return fallback;
}

function currentStepTitle(step: StepId) {
  switch (step) {
    case "vision":
      return "Build intent";
    case "exterior":
      return "Exterior direction";
    case "interior":
      return "Interior materials";
    case "layout":
      return "Layout plan";
    case "gear":
      return "Gear systems";
  }
}

function renderVisionPanel(spec: VisualizationSpec) {
  return (
    <div className="build-context-stack">
      <div>
        <div className="build-context-kicker">Vision</div>
        <h3 className="build-context-title">{spec.visionHighlights.title}</h3>
        <p className="build-context-copy">{spec.visionHighlights.summary}</p>
      </div>
      <div className="chip-row">
        {spec.visionHighlights.chips.map((chip) => (
          <span key={chip} className="build-chip">
            {chip}
          </span>
        ))}
      </div>
    </div>
  );
}

function renderExteriorPanel(spec: VisualizationSpec, session?: ConfigurationSession | null) {
  const colorLabel = String(session?.state.exterior.exteriorColor ?? session?.state.exterior.color ?? spec.theme.paletteName);

  return (
    <div className="build-context-stack">
      <div className="build-detail-grid">
        <div className="build-detail-card">
          <span>Color</span>
          <strong>{colorLabel}</strong>
        </div>
        <div className="build-detail-card">
          <span>Finish</span>
          <strong>{spec.exteriorScene.finish}</strong>
        </div>
        <div className="build-detail-card">
          <span>Wheels</span>
          <strong>
            {spec.exteriorScene.wheelStyle} · {spec.exteriorScene.wheelRadius}"
          </strong>
        </div>
        <div className="build-detail-card">
          <span>Powertrain</span>
          <strong>{spec.exteriorScene.powertrain}</strong>
        </div>
      </div>
      <div className="chip-row">
        {[spec.exteriorScene.rackStyle, spec.exteriorScene.auxLights, ...spec.exteriorScene.overlays].slice(0, 5).map((chip) => (
          <span key={chip} className="build-chip">
            {chip}
          </span>
        ))}
      </div>
    </div>
  );
}

function renderInteriorPanel(spec: VisualizationSpec) {
  const swatches = [
    { label: "Fixtures", value: spec.interiorSwatches.fixtureColor, fallback: "#c8a57f" },
    { label: "Primary", value: spec.interiorSwatches.primaryTexture, fallback: "#ece5d9" },
    { label: "Secondary", value: spec.interiorSwatches.secondaryTexture, fallback: "#b7b7b2" },
    { label: "Stitching", value: spec.interiorSwatches.stitchingColor, fallback: "#d89c5d" },
    { label: "Seat finish", value: spec.interiorSwatches.seatFinish, fallback: "#b28a64" }
  ];

  return (
    <div className="build-context-stack">
      <div className="swatch-grid">
        {swatches.map((swatch) => (
          <div key={swatch.label} className="swatch-card">
            <span
              className="swatch-tile"
              style={{ background: colorSwatch(swatch.value, swatch.fallback) }}
              aria-hidden="true"
            />
            <div>
              <span className="swatch-label">{swatch.label}</span>
              <strong className="swatch-value">{swatch.value}</strong>
            </div>
          </div>
        ))}
      </div>

      <div className="chip-row">
        {spec.interiorSwatches.notes.length ? (
          spec.interiorSwatches.notes.map((note) => (
            <span key={note} className="build-chip subtle">
              {note}
            </span>
          ))
        ) : (
          <span className="build-chip subtle">Materials are still taking shape.</span>
        )}
      </div>
    </div>
  );
}

function zoneClass(emphasis: VisualizationSpec["layoutFloorplan"]["zones"][number]["emphasis"]) {
  switch (emphasis) {
    case "primary":
      return "floorplan-zone primary";
    case "secondary":
      return "floorplan-zone secondary";
    default:
      return "floorplan-zone support";
  }
}

function renderLayoutPanel(spec: VisualizationSpec) {
  return (
    <div className="build-context-stack">
      <div className="floorplan-card">
        <div className="floorplan-meta">
          <span>{spec.layoutFloorplan.driveSide === "left" ? "Left-hand drive" : "Right-hand drive"}</span>
          <strong>{spec.layoutFloorplan.frontSeatConfig}</strong>
        </div>

        <div className="floorplan-grid" data-testid="layout-floorplan">
          {spec.layoutFloorplan.zones.map((zone) => (
            <div
              key={`${zone.kind}-${zone.label}`}
              className={zoneClass(zone.emphasis)}
              data-testid={`floorplan-zone-${zone.kind}`}
              style={{
                gridColumn: `${zone.x + 1} / span ${zone.w}`,
                gridRow: `${zone.y + 1} / span ${zone.h}`
              }}
            >
              <span>{zone.kind}</span>
              <strong>{zone.label}</strong>
            </div>
          ))}
        </div>
      </div>

      <div className="chip-row">
        {spec.layoutFloorplan.notes.map((note) => (
          <span key={note} className="build-chip subtle">
            {note}
          </span>
        ))}
      </div>
    </div>
  );
}

function renderGearPanel(spec: VisualizationSpec) {
  return (
    <div className="build-context-stack">
      <div className="gear-module-stack">
        {spec.gearScene.modules.map((module) => (
          <div key={module.id} className="gear-module-card">
            <div>
              <span className="gear-module-label">{module.label}</span>
              <strong className="gear-module-detail">{module.detail}</strong>
            </div>
            <span className={`gear-module-status ${module.status}`}>{module.status}</span>
          </div>
        ))}
      </div>

      <div className="chip-row">
        {[spec.gearScene.roofGear, spec.gearScene.rearCarrier, spec.gearScene.powerModule, spec.gearScene.campLighting].map(
          (chip) => (
            <span key={chip} className="build-chip">
              {chip}
            </span>
          )
        )}
      </div>
    </div>
  );
}

function renderContextPanel(spec: VisualizationSpec, session?: ConfigurationSession | null) {
  switch (spec.currentStep) {
    case "vision":
      return renderVisionPanel(spec);
    case "exterior":
      return renderExteriorPanel(spec, session);
    case "interior":
      return renderInteriorPanel(spec);
    case "layout":
      return renderLayoutPanel(spec);
    case "gear":
      return renderGearPanel(spec);
  }
}

export function VanAssembly({ session, visualSpec }: VanAssemblyProps) {
  const spec = visualSpec ?? FALLBACK_SPEC;
  const steeringX = spec.exteriorScene.driveSide === "left" ? 224 : 284;
  const seatX = spec.exteriorScene.driveSide === "left" ? 198 : 268;
  const roofRackVisible = spec.exteriorScene.rackStyle.toLowerCase() !== "none";
  const rearCarrierVisible = !/no rear carrier/i.test(spec.exteriorScene.rearCarrier);
  const wheelRadius = spec.exteriorScene.wheelRadius;
  const showLights =
    !/none|minimal/i.test(spec.exteriorScene.auxLights) || !/soft|minimal/i.test(spec.exteriorScene.campLighting);
  const wheelStroke =
    spec.exteriorScene.wheelStyle.toLowerCase().includes("forged") || spec.exteriorScene.wheelStyle.toLowerCase().includes("sport")
      ? "#d7dce1"
      : "#aeb7bf";

  return (
    <div className="build-stage">
      <div className="step-rail" data-testid="step-rail">
        {spec.stepRail.map((step) => (
          <div key={step.step} className={`step-pill ${step.state}`}>
            <span className="step-pill-number">
              {spec.stepRail.findIndex((item) => item.step === step.step) + 1}
            </span>
            <span className="step-pill-label">{step.label}</span>
          </div>
        ))}
      </div>

      <div className="build-stage-grid">
        <div className="build-canvas-card">
          <svg viewBox="0 0 620 330" className="build-canvas-svg" role="img" aria-label="Northstar van configuration preview">
            <defs>
              <linearGradient id="canvas-shadow" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(24,33,37,0.12)" />
                <stop offset="100%" stopColor="rgba(24,33,37,0.02)" />
              </linearGradient>
              <linearGradient id="body-shine" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.24)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0)" />
              </linearGradient>
            </defs>

            <ellipse cx="310" cy="274" rx="212" ry="24" fill="url(#canvas-shadow)" />
            <path
              className="van-canvas-body"
              d="M98 156c0-24 18-42 42-42h198c40 0 77 14 107 40l44 37c13 11 21 28 21 45v14H98v-94z"
              fill={spec.exteriorScene.bodyColor}
            />
            <path
              d="M111 164c0-17 13-30 30-30h168c29 0 56 10 79 28l33 28c9 8 15 19 18 31H111v-57z"
              fill="url(#body-shine)"
            />
            <rect x="138" y="133" width="178" height="58" rx="18" fill={spec.theme.cabinColor} opacity="0.96" />
            <rect x="332" y="140" width="76" height="50" rx="14" fill="rgba(255,255,255,0.72)" />
            <rect x="420" y="148" width="54" height="40" rx="12" fill="rgba(255,255,255,0.62)" />

            <rect x={seatX} y="155" width="22" height="24" rx="8" fill="rgba(24,33,37,0.18)" />
            <circle cx={steeringX} cy="160" r="12" fill="none" stroke="rgba(24,33,37,0.54)" strokeWidth="4" />
            <circle cx={steeringX} cy="160" r="3" fill="rgba(24,33,37,0.46)" />

            {roofRackVisible ? (
              <>
                <rect x="170" y="108" width="252" height="8" rx="4" fill="rgba(24,33,37,0.72)" />
                <rect x="182" y="100" width="8" height="18" rx="4" fill="rgba(24,33,37,0.64)" />
                <rect x="406" y="100" width="8" height="18" rx="4" fill="rgba(24,33,37,0.64)" />
                {!/low-profile/i.test(spec.exteriorScene.roofGear) ? (
                  <rect x="246" y="88" width="110" height="22" rx="10" fill="rgba(24,33,37,0.22)" />
                ) : null}
              </>
            ) : null}

            {showLights ? (
              <>
                <circle cx="505" cy="188" r="8" fill={spec.theme.accent} opacity="0.9" />
                <circle cx="195" cy="114" r="6" fill={spec.theme.accentAlt} opacity="0.86" />
                <circle cx="393" cy="114" r="6" fill={spec.theme.accentAlt} opacity="0.86" />
              </>
            ) : null}

            {spec.exteriorScene.ladder ? (
              <g stroke="rgba(24,33,37,0.72)" strokeWidth="4">
                <line x1="505" y1="148" x2="505" y2="236" />
                <line x1="524" y1="148" x2="524" y2="236" />
                <line x1="505" y1="168" x2="524" y2="168" />
                <line x1="505" y1="188" x2="524" y2="188" />
                <line x1="505" y1="208" x2="524" y2="208" />
              </g>
            ) : null}

            {rearCarrierVisible ? (
              <g>
                <rect x="488" y="206" width="70" height="12" rx="6" fill="rgba(24,33,37,0.76)" />
                <rect x="518" y="184" width="18" height="42" rx="9" fill="rgba(24,33,37,0.56)" />
              </g>
            ) : null}

            <circle cx="206" cy="252" r={wheelRadius} fill="#242a2d" />
            <circle cx="206" cy="252" r={Math.max(wheelRadius - 11, 10)} fill="none" stroke={wheelStroke} strokeWidth="6" />
            <circle cx="206" cy="252" r="9" fill="rgba(255,255,255,0.54)" />
            <circle cx="430" cy="252" r={wheelRadius} fill="#242a2d" />
            <circle cx="430" cy="252" r={Math.max(wheelRadius - 11, 10)} fill="none" stroke={wheelStroke} strokeWidth="6" />
            <circle cx="430" cy="252" r="9" fill="rgba(255,255,255,0.54)" />

            <g className="van-badges">
              {spec.exteriorScene.badges.slice(0, 3).map((badge, index) => (
                <g key={badge} transform={`translate(${142 + index * 92} 214)`}>
                  <rect width="80" height="28" rx="14" fill="rgba(255,255,255,0.82)" stroke="rgba(24,33,37,0.1)" />
                  <text x="40" y="18" textAnchor="middle">
                    {badge}
                  </text>
                </g>
              ))}
            </g>
          </svg>

          <div className="build-overlay-row">
            {spec.exteriorScene.overlays.slice(0, 4).map((overlay) => (
              <span key={overlay} className="build-chip subtle">
                {overlay}
              </span>
            ))}
          </div>
        </div>

        <div className="build-context-card" data-testid="build-context-panel">
          <div className="build-context-kicker">{currentStepTitle(spec.currentStep)}</div>
          {renderContextPanel(spec, session)}
        </div>
      </div>
    </div>
  );
}
