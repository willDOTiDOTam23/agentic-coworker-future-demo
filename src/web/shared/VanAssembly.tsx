import { STEP_DEFINITIONS, getStepIdForNumber, type ConfigurationSession, type StepId, type VisualizationSpec } from "../../lib/domain.js";

interface VanAssemblyProps {
  session?: ConfigurationSession | null;
  visualSpec?: VisualizationSpec | null;
  activeStep?: StepId;
  onSelectStep?: (step: StepId) => void;
}

const FALLBACK_SPEC: VisualizationSpec = {
  generatedBy: "deterministic",
  updatedAt: new Date(0).toISOString(),
  currentStep: "vision",
  theme: {
    paletteName: "Sunlit trail",
    backgroundLocked: false,
    requestedExteriorColor: "Sunlit sand",
    resolvedExteriorColor: "#d7b892",
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
    summary: "Shape the story first. The van updates as the guide captures each build choice.",
    chips: ["Weekend escape", "Calm cabin", "Adventure-ready"]
  },
  exteriorScene: {
    requestedColor: "Sunlit sand",
    renderColor: "#d7b892",
    bodyColor: "#d7b892",
    finish: "Satin finish",
    wheelRadius: 26,
    wheelStyle: "All-terrain alloy",
    wheelVariant: "touring",
    rackStyle: "Touring rail",
    auxLights: "Minimal driving lights",
    powertrain: "AWD",
    driveSide: "left",
    frontSeatConfig: "Twin captain seats",
    roofGear: "Low-profile rack",
    rearCarrier: "No rear carrier",
    ladder: false,
    campLighting: "Soft perimeter lighting",
    showRack: true,
    showAuxLights: false,
    showRearCarrier: false,
    showLadder: false,
    suspensionLift: 4,
    badges: ["AWD", "Touring"],
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
      { kind: "driver", x: 0, y: 0, w: 2, h: 2, label: "LHD cockpit", shortLabel: "DR", emphasis: "primary" },
      { kind: "passenger", x: 2, y: 0, w: 2, h: 2, label: "Passenger seat", shortLabel: "PS", emphasis: "secondary" },
      { kind: "galley", x: 0, y: 2, w: 4, h: 2, label: "Compact galley", shortLabel: "GA", emphasis: "primary" },
      { kind: "dinette", x: 4, y: 2, w: 4, h: 2, label: "Two-seat dinette", shortLabel: "DN", emphasis: "support" },
      { kind: "storage", x: 8, y: 2, w: 4, h: 2, label: "Tall storage", shortLabel: "ST", emphasis: "secondary" },
      { kind: "bed", x: 2, y: 4, w: 8, h: 2, label: "Convertible bed", shortLabel: "BD", emphasis: "primary" }
    ],
    legend: [
      { kind: "driver", label: "LHD cockpit", shortLabel: "DR", emphasis: "primary" },
      { kind: "passenger", label: "Passenger seat", shortLabel: "PS", emphasis: "secondary" },
      { kind: "galley", label: "Compact galley", shortLabel: "GA", emphasis: "primary" },
      { kind: "dinette", label: "Two-seat dinette", shortLabel: "DN", emphasis: "support" },
      { kind: "storage", label: "Tall storage", shortLabel: "ST", emphasis: "secondary" },
      { kind: "bed", label: "Convertible bed", shortLabel: "BD", emphasis: "primary" }
    ]
  },
  gearScene: {
    roofGear: "Low-profile rack",
    rearCarrier: "No rear carrier",
    ladder: false,
    powerModule: "Lithium off-grid pack",
    campLighting: "Soft perimeter lighting",
    attachmentStates: [
      { id: "roof-gear", label: "Low-profile rack", active: true },
      { id: "rear-carrier", label: "No rear carrier", active: false },
      { id: "ladder", label: "Rear ladder", active: false },
      { id: "camp-lighting", label: "Soft perimeter lighting", active: false }
    ],
    modules: [
      { id: "roof-gear", label: "Roof gear", detail: "Low-profile rack", status: "optional" },
      { id: "rear-carrier", label: "Rear carrier", detail: "No rear carrier", status: "inactive" },
      { id: "power-module", label: "Power module", detail: "Lithium off-grid pack", status: "active" },
      { id: "camp-lighting", label: "Camp lighting", detail: "Soft perimeter lighting", status: "optional" }
    ]
  }
};

function displayStepFromSession(session?: ConfigurationSession | null) {
  if (!session) return null;
  if (session.status === "submitted") return "gear";
  return getStepIdForNumber(session.currentStep);
}

function currentStepTitle(step: StepId) {
  switch (step) {
    case "vision":
      return "Build intent";
    case "exterior":
      return "Exterior direction";
    case "interior":
      return "Material board";
    case "layout":
      return "Layout plan";
    case "gear":
      return "Systems + gear";
  }
}

function renderStepRail(session: ConfigurationSession | null | undefined, fallback: VisualizationSpec["stepRail"]) {
  if (!session) {
    return fallback;
  }

  return STEP_DEFINITIONS.map((step, index) => {
    if (session.status === "submitted") {
      return {
        step: step.id,
        label: step.label,
        state: "complete" as const
      };
    }

    if (index + 1 < session.currentStep) {
      return {
        step: step.id,
        label: step.label,
        state: "complete" as const
      };
    }

    if (index + 1 === session.currentStep) {
      return {
        step: step.id,
        label: step.label,
        state: "current" as const
      };
    }

    return {
      step: step.id,
      label: step.label,
      state: "upcoming" as const
    };
  });
}

function renderVisionPanel(spec: VisualizationSpec) {
  return (
    <div className="build-context-stack compact">
      <div className="vision-chip-cloud">
        {spec.visionHighlights.chips.map((chip) => (
          <span key={chip} className="build-chip hero">
            {chip}
          </span>
        ))}
      </div>
      <p className="build-muted-copy">{spec.visionHighlights.summary}</p>
    </div>
  );
}

function renderExteriorPanel(spec: VisualizationSpec) {
  return (
    <div className="build-context-stack">
      <div className="exterior-showcase">
        <div className="paint-card">
          <div className="paint-preview" style={{ background: spec.exteriorScene.renderColor }} aria-hidden="true" />
          <div className="paint-copy">
            <span>Paint</span>
            <strong>{spec.exteriorScene.requestedColor}</strong>
            <p>{spec.exteriorScene.finish}</p>
          </div>
        </div>

        <div className="wheel-card">
          <span className={`wheel-illustration ${spec.exteriorScene.wheelVariant}`} aria-hidden="true">
            <span className="wheel-inner" />
          </span>
          <div className="wheel-copy">
            <span>Wheel package</span>
            <strong>{spec.exteriorScene.wheelStyle}</strong>
            <p>{spec.exteriorScene.wheelRadius}" diameter</p>
          </div>
        </div>
      </div>

      <div className="chip-row">
        {[spec.exteriorScene.powertrain, ...spec.exteriorScene.overlays].slice(0, 5).map((chip) => (
          <span key={chip} className="build-chip">
            {chip}
          </span>
        ))}
      </div>
    </div>
  );
}

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
  if (normalized.includes("gold") || normalized.includes("sun")) return "#d7b35c";

  return fallback;
}

function renderInteriorPanel(spec: VisualizationSpec) {
  const swatches = [
    { label: "Fixtures", value: spec.interiorSwatches.fixtureColor, fallback: "#c8a57f" },
    { label: "Primary", value: spec.interiorSwatches.primaryTexture, fallback: "#ece5d9" },
    { label: "Seat", value: spec.interiorSwatches.seatFinish, fallback: "#b28a64" }
  ];

  return (
    <div className="build-context-stack">
      <div className="material-board">
        {swatches.map((swatch) => (
          <div key={swatch.label} className="material-card">
            <span className="material-tile" style={{ background: colorSwatch(swatch.value, swatch.fallback) }} aria-hidden="true" />
            <span className="material-label">{swatch.label}</span>
            <strong className="material-value">{swatch.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function zoneClass(emphasis: VisualizationSpec["layoutFloorplan"]["legend"][number]["emphasis"]) {
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
  const highlightedLegend = spec.layoutFloorplan.legend.filter((item) =>
    ["driver", "galley", "bed"].includes(item.kind)
  );

  return (
    <div className="build-context-stack">
      <div className="floorplan-card compact">
        <div className="floorplan-meta">
          <span>{spec.layoutFloorplan.driveSide === "left" ? "Left-hand drive" : "Right-hand drive"}</span>
          <strong>{spec.layoutFloorplan.frontSeatConfig}</strong>
        </div>

        <div className="floorplan-grid simplified" data-testid="layout-floorplan">
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
              <span className="zone-token">{zone.shortLabel}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="legend-grid" data-testid="layout-legend">
        {highlightedLegend.map((item) => (
          <div key={`${item.kind}-${item.label}`} className="legend-card">
            <span className={`legend-token ${item.emphasis}`}>{item.shortLabel}</span>
            <div>
              <span className="legend-label">{item.kind}</span>
              <strong className="legend-value">{item.label}</strong>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function renderGearPanel(spec: VisualizationSpec) {
  const featuredAttachments = (spec.gearScene.attachmentStates.filter((attachment) => attachment.active).length
    ? spec.gearScene.attachmentStates.filter((attachment) => attachment.active)
    : spec.gearScene.attachmentStates
  );
  const featuredModules = (
    spec.gearScene.modules.filter((module) => module.status !== "inactive").length
      ? spec.gearScene.modules.filter((module) => module.status !== "inactive")
      : spec.gearScene.modules
  );

  return (
    <div className="build-context-stack gear-panel">
      <div className="attachment-row">
        {featuredAttachments.map((attachment) => (
          <div key={attachment.id} className={`attachment-card ${attachment.active ? "active" : "inactive"}`}>
            <span className="attachment-dot" aria-hidden="true" />
            <strong>{attachment.label}</strong>
          </div>
        ))}
      </div>

      <div className="gear-module-stack">
        {featuredModules.map((module) => (
          <div key={module.id} className="gear-module-card">
            <div>
              <span className="gear-module-label">{module.label}</span>
              <strong className="gear-module-detail">{module.detail}</strong>
            </div>
            <span className={`gear-module-status ${module.status}`}>{module.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function renderContextPanel(step: StepId, spec: VisualizationSpec) {
  switch (step) {
    case "vision":
      return renderVisionPanel(spec);
    case "exterior":
      return renderExteriorPanel(spec);
    case "interior":
      return renderInteriorPanel(spec);
    case "layout":
      return renderLayoutPanel(spec);
    case "gear":
      return renderGearPanel(spec);
  }
}

function renderLayoutOverlay(spec: VisualizationSpec) {
  const blocks = {
    driver: spec.layoutFloorplan.driveSide === "left" ? { x: 160, y: 155, width: 34, height: 26 } : { x: 282, y: 155, width: 34, height: 26 },
    galley: spec.layoutFloorplan.driveSide === "left" ? { x: 186, y: 198, width: 86, height: 18 } : { x: 326, y: 198, width: 86, height: 18 },
    storage: spec.layoutFloorplan.driveSide === "left" ? { x: 360, y: 196, width: 78, height: 20 } : { x: 126, y: 196, width: 78, height: 20 },
    bed: { x: 234, y: 222, width: 150, height: 18 }
  };

  return (
    <g className="layout-overlay-group">
      <rect {...blocks.driver} className="layout-overlay primary" rx="8" />
      <rect {...blocks.galley} className="layout-overlay secondary" rx="9" />
      <rect {...blocks.storage} className="layout-overlay support" rx="9" />
      <rect {...blocks.bed} className="layout-overlay primary" rx="9" />
    </g>
  );
}

export function VanAssembly({ session, visualSpec, activeStep, onSelectStep }: VanAssemblyProps) {
  const spec = visualSpec ?? FALLBACK_SPEC;
  const displayStep = activeStep ?? displayStepFromSession(session) ?? spec.currentStep;
  const stepRail = renderStepRail(session, spec.stepRail);
  const steeringX = spec.exteriorScene.driveSide === "left" ? 226 : 286;
  const seatX = spec.exteriorScene.driveSide === "left" ? 198 : 268;
  const bodyLift = spec.exteriorScene.suspensionLift;
  const wheelRadius = spec.exteriorScene.wheelRadius;
  const wheelStroke = spec.exteriorScene.wheelVariant === "off-road" ? "#d4d9dd" : spec.exteriorScene.wheelVariant === "compact" ? "#9aa5af" : "#bec6ce";
  const showLayoutCue = displayStep === "layout" || displayStep === "gear" || (session?.currentStep ?? 1) >= 4;

  return (
    <div className="build-stage">
      <div className="step-rail" data-testid="step-rail">
        {stepRail.map((step) => (
          <button
            key={step.step}
            type="button"
            className={`step-pill ${step.state} ${displayStep === step.step ? "selected" : ""} ${
              step.state !== "upcoming" ? "clickable" : ""
            }`.trim()}
            disabled={step.state === "upcoming"}
            aria-pressed={displayStep === step.step}
            onClick={() => onSelectStep?.(step.step)}
          >
            <span className="step-pill-number">
              {STEP_DEFINITIONS.findIndex((item) => item.id === step.step) + 1}
            </span>
            <span className="step-pill-label">{step.label}</span>
          </button>
        ))}
      </div>

      <div className="build-stage-grid">
        <div className="build-canvas-card">
          <div
            className="build-canvas-backdrop"
            style={{
              background: `radial-gradient(circle at 28% 30%, ${spec.theme.accent}22, transparent 38%),
                radial-gradient(circle at 74% 28%, ${spec.theme.accentAlt}22, transparent 36%),
                linear-gradient(180deg, rgba(255,255,255,0.88), rgba(255,255,255,0.58))`
            }}
          />

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

            <ellipse cx="310" cy={278 - Math.floor(bodyLift / 2)} rx="220" ry="22" fill="url(#canvas-shadow)" />
            <g transform={`translate(0 ${-bodyLift})`}>
              <path
                className="van-canvas-body"
                d="M98 156c0-24 18-42 42-42h198c40 0 77 14 107 40l44 37c13 11 21 28 21 45v14H98v-94z"
                fill={spec.exteriorScene.renderColor}
              />
              <path
                d="M111 164c0-17 13-30 30-30h168c29 0 56 10 79 28l33 28c9 8 15 19 18 31H111v-57z"
                fill="url(#body-shine)"
              />
              <rect x="138" y="133" width="178" height="58" rx="18" fill={spec.theme.cabinColor} opacity="0.96" />
              <rect x="332" y="140" width="76" height="50" rx="14" fill="rgba(255,255,255,0.72)" />
              <rect x="420" y="148" width="54" height="40" rx="12" fill="rgba(255,255,255,0.62)" />

              {showLayoutCue ? renderLayoutOverlay(spec) : null}

              <rect x={seatX} y="155" width="22" height="24" rx="8" fill="rgba(24,33,37,0.18)" />
              <circle cx={steeringX} cy="160" r="12" fill="none" stroke="rgba(24,33,37,0.54)" strokeWidth="4" />
              <circle cx={steeringX} cy="160" r="3" fill="rgba(24,33,37,0.46)" />

              {spec.exteriorScene.showRack ? (
                <>
                  <rect x="170" y="108" width="252" height="8" rx="4" fill="rgba(24,33,37,0.72)" />
                  <rect x="182" y="100" width="8" height="18" rx="4" fill="rgba(24,33,37,0.64)" />
                  <rect x="406" y="100" width="8" height="18" rx="4" fill="rgba(24,33,37,0.64)" />
                  {!/low-profile/i.test(spec.exteriorScene.roofGear) ? (
                    <rect x="246" y="88" width="110" height="22" rx="10" fill="rgba(24,33,37,0.22)" />
                  ) : null}
                </>
              ) : null}

              {spec.exteriorScene.showAuxLights ? (
                <>
                  <circle cx="505" cy="188" r="8" fill={spec.theme.accent} opacity="0.92" />
                  <circle cx="195" cy="114" r="6" fill={spec.theme.accentAlt} opacity="0.88" />
                  <circle cx="393" cy="114" r="6" fill={spec.theme.accentAlt} opacity="0.88" />
                </>
              ) : null}

              {spec.exteriorScene.showLadder ? (
                <g stroke="rgba(24,33,37,0.72)" strokeWidth="4">
                  <line x1="505" y1="148" x2="505" y2="236" />
                  <line x1="524" y1="148" x2="524" y2="236" />
                  <line x1="505" y1="168" x2="524" y2="168" />
                  <line x1="505" y1="188" x2="524" y2="188" />
                  <line x1="505" y1="208" x2="524" y2="208" />
                </g>
              ) : null}

              {spec.exteriorScene.showRearCarrier ? (
                <g>
                  <rect x="488" y="206" width="70" height="12" rx="6" fill="rgba(24,33,37,0.76)" />
                  <rect x="518" y="184" width="18" height="42" rx="9" fill="rgba(24,33,37,0.56)" />
                </g>
              ) : null}
            </g>

            <circle cx="206" cy="252" r={wheelRadius} fill="#242a2d" />
            <circle cx="206" cy="252" r={Math.max(wheelRadius - 11, 10)} fill="none" stroke={wheelStroke} strokeWidth="6" />
            <circle cx="206" cy="252" r="9" fill="rgba(255,255,255,0.54)" />
            <circle cx="430" cy="252" r={wheelRadius} fill="#242a2d" />
            <circle cx="430" cy="252" r={Math.max(wheelRadius - 11, 10)} fill="none" stroke={wheelStroke} strokeWidth="6" />
            <circle cx="430" cy="252" r="9" fill="rgba(255,255,255,0.54)" />

            <g className="van-badges">
              {spec.exteriorScene.badges.slice(0, 3).map((badge, index) => (
                <g key={badge} transform={`translate(${136 + index * 96} 214)`}>
                  <rect width="84" height="28" rx="14" fill="rgba(255,255,255,0.82)" stroke="rgba(24,33,37,0.1)" />
                  <text x="42" y="18" textAnchor="middle">
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

        <div
          className={`build-context-card${displayStep === "gear" ? " build-context-card-scrollable" : ""}`}
          data-testid="build-context-panel"
        >
          <div className="build-context-kicker">{currentStepTitle(displayStep)}</div>
          {renderContextPanel(displayStep, spec)}
        </div>
      </div>
    </div>
  );
}
