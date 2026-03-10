import { expect, test, type Page } from "@playwright/test";

const sessionId = "session-visual";

function buildSession(currentStep: number, state: Record<string, Record<string, unknown>>) {
  return {
    id: sessionId,
    status: "draft",
    currentStep,
    createdAt: "2026-03-09T16:00:00.000Z",
    updatedAt: "2026-03-09T16:05:00.000Z",
    submittedAt: null,
    latestConfidence: null,
    theme: {
      paletteChoice: "Sunlit trail",
      visualTone: "Modern expedition"
    },
    state: {
      vision: {},
      exterior: {},
      interior: {},
      layout: {},
      gear: {},
      ...state
    }
  };
}

function buildVisualSpec(overrides: Record<string, unknown>) {
  const base = {
    generatedBy: "deterministic",
    updatedAt: "2026-03-09T16:05:00.000Z",
    currentStep: "exterior",
    theme: {
      paletteName: "Forest calm",
      backgroundLocked: true,
      requestedExteriorColor: "Forest green",
      resolvedExteriorColor: "#6c876f",
      backgroundA: "#dce8dc",
      backgroundB: "#bfd4c0",
      accent: "#537857",
      accentAlt: "#d19a59",
      ink: "#18231d",
      bodyColor: "#6c876f",
      cabinColor: "#edf3ec"
    },
    stepRail: [
      { step: "vision", label: "Vision and use case", state: "complete" },
      { step: "exterior", label: "Exterior spec", state: "current" },
      { step: "interior", label: "Interior spec", state: "upcoming" },
      { step: "layout", label: "Layout and sleeping", state: "upcoming" },
      { step: "gear", label: "Gear, review, and submit", state: "upcoming" }
    ],
    visionHighlights: {
      title: "Coastal weekender",
      summary: "Weekend surf missions with a calm, modern cabin.",
      chips: ["Surf weekends", "Calm", "Coastal"]
    },
    exteriorScene: {
      requestedColor: "Forest green",
      renderColor: "#6c876f",
      bodyColor: "#6c876f",
      finish: "Satin finish",
      wheelRadius: 32,
      wheelStyle: "All-terrain alloy",
      wheelVariant: "off-road",
      rackStyle: "Expedition rack",
      auxLights: "Trail lights",
      powertrain: "AWD",
      driveSide: "left",
      frontSeatConfig: "Twin captain seats",
      roofGear: "Solar deck",
      rearCarrier: "Swing-out bike tray",
      ladder: true,
      campLighting: "Perimeter camp lights",
      showRack: true,
      showAuxLights: true,
      showRearCarrier: true,
      showLadder: true,
      suspensionLift: 10,
      badges: ["AWD", "Satin"],
      overlays: ["Solar deck", "Swing-out bike tray", "Perimeter camp lights"]
    },
    interiorSwatches: {
      fixtureColor: "Warm birch",
      primaryTexture: "Matte linen",
      secondaryTexture: "Stone wool",
      stitchingColor: "Sand stitch",
      seatFinish: "Weatherproof camel",
      notes: ["Soft-touch surfaces", "Relaxed tone"]
    },
    layoutFloorplan: {
      gridColumns: 12,
      gridRows: 6,
      driveSide: "left",
      frontSeatConfig: "Twin captain seats",
      notes: ["Left-hand drive", "Compact galley", "Murphy bed"],
      zones: [
        { kind: "driver", x: 0, y: 0, w: 2, h: 2, label: "LHD cockpit", shortLabel: "DR", emphasis: "primary" },
        { kind: "passenger", x: 2, y: 0, w: 2, h: 2, label: "Passenger seat", shortLabel: "PS", emphasis: "secondary" },
        { kind: "galley", x: 0, y: 2, w: 4, h: 2, label: "Compact galley", shortLabel: "GA", emphasis: "primary" },
        { kind: "dinette", x: 4, y: 2, w: 4, h: 2, label: "Bench dinette", shortLabel: "DN", emphasis: "support" },
        { kind: "storage", x: 8, y: 2, w: 4, h: 2, label: "Bike garage", shortLabel: "ST", emphasis: "secondary" },
        { kind: "bed", x: 2, y: 4, w: 8, h: 2, label: "Murphy bed", shortLabel: "BD", emphasis: "primary" }
      ],
      legend: [
        { kind: "driver", label: "LHD cockpit", shortLabel: "DR", emphasis: "primary" },
        { kind: "passenger", label: "Passenger seat", shortLabel: "PS", emphasis: "secondary" },
        { kind: "galley", label: "Compact galley", shortLabel: "GA", emphasis: "primary" },
        { kind: "dinette", label: "Bench dinette", shortLabel: "DN", emphasis: "support" },
        { kind: "storage", label: "Bike garage", shortLabel: "ST", emphasis: "secondary" },
        { kind: "bed", label: "Murphy bed", shortLabel: "BD", emphasis: "primary" }
      ]
    },
    gearScene: {
      roofGear: "Solar deck",
      rearCarrier: "Swing-out bike tray",
      ladder: true,
      powerModule: "Lithium off-grid pack",
      campLighting: "Perimeter camp lights",
      attachmentStates: [
        { id: "roof-gear", label: "Solar deck", active: true },
        { id: "rear-carrier", label: "Swing-out bike tray", active: true },
        { id: "ladder", label: "Rear ladder", active: true },
        { id: "camp-lighting", label: "Perimeter camp lights", active: true }
      ],
      modules: [
        { id: "roof-gear", label: "Roof gear", detail: "Solar deck", status: "active" },
        { id: "rear-carrier", label: "Rear carrier", detail: "Swing-out bike tray", status: "active" },
        { id: "power-module", label: "Power module", detail: "Lithium off-grid pack", status: "active" },
        { id: "camp-lighting", label: "Camp lighting", detail: "Perimeter camp lights", status: "active" }
      ]
    }
  };

  const next = {
    ...base,
    ...overrides,
    theme: {
      ...base.theme,
      ...(overrides.theme as Record<string, unknown> | undefined)
    },
    visionHighlights: {
      ...base.visionHighlights,
      ...(overrides.visionHighlights as Record<string, unknown> | undefined)
    },
    exteriorScene: {
      ...base.exteriorScene,
      ...(overrides.exteriorScene as Record<string, unknown> | undefined)
    },
    interiorSwatches: {
      ...base.interiorSwatches,
      ...(overrides.interiorSwatches as Record<string, unknown> | undefined)
    },
    layoutFloorplan: {
      ...base.layoutFloorplan,
      ...(overrides.layoutFloorplan as Record<string, unknown> | undefined)
    },
    gearScene: {
      ...base.gearScene,
      ...(overrides.gearScene as Record<string, unknown> | undefined)
    }
  };

  return next;
}

async function installCustomerMocks(page: Page, streamedEvents: object[] = []) {
  await page.addInitScript((events) => {
    class MockDataChannel extends EventTarget {
      send() {}
    }

    class MockPeerConnection {
      ontrack: ((event: { streams: MediaStream[] }) => void) | null = null;
      private channel: MockDataChannel | null = null;

      addTrack() {}

      createDataChannel() {
        this.channel = new MockDataChannel();
        return this.channel as unknown as RTCDataChannel;
      }

      async createOffer() {
        return { type: "offer", sdp: "fake-offer" };
      }

      async setLocalDescription() {}

      async setRemoteDescription() {
        window.setTimeout(() => {
          this.channel?.dispatchEvent(new Event("open"));
        }, 10);
      }

      close() {}
    }

    class MockAudioContext {
      createMediaStreamSource() {
        return {
          connect() {}
        };
      }

      createAnalyser() {
        return {
          fftSize: 128,
          frequencyBinCount: 48,
          getByteFrequencyData(buffer: Uint8Array) {
            buffer.fill(128);
          }
        };
      }
    }

    class MockEventSource {
      onmessage: ((event: MessageEvent<string>) => void) | null = null;

      constructor() {
        events.forEach((payload, index) => {
          window.setTimeout(() => {
            this.onmessage?.({
              data: JSON.stringify(payload)
            } as MessageEvent<string>);
          }, 120 + index * 120);
        });
      }

      close() {}
    }

    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: async () => ({
          getTracks: () => [{ stop() {} }]
        })
      },
      configurable: true
    });

    Object.defineProperty(window, "AudioContext", {
      value: MockAudioContext,
      configurable: true
    });

    Object.defineProperty(window, "RTCPeerConnection", {
      value: MockPeerConnection,
      configurable: true
    });

    Object.defineProperty(window, "EventSource", {
      value: MockEventSource,
      configurable: true
    });

    HTMLMediaElement.prototype.play = async () => undefined;
  }, streamedEvents);

  await page.route("**/api/realtime/session", async (route) => {
    await route.fulfill({
      json: {
        sessionId,
        clientSecret: "client-secret",
        expiresAt: Date.now() + 60_000,
        session: {}
      }
    });
  });

  await page.route("**/v1/realtime/calls", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/sdp",
      body: "fake-answer"
    });
  });
}

test("renders exterior updates with the larger wheel size and stays within a widescreen viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const visualSpec = buildVisualSpec({});
  const session = buildSession(2, {
    exterior: {
      exteriorColor: "Forest green",
      wheelSize: "33 inch",
      wheelStyle: "All-terrain alloy"
    }
  });

  await installCustomerMocks(page);
  await page.route(`**/api/configurations/${sessionId}`, async (route) => {
    await route.fulfill({
      json: {
        session,
        turns: [],
        agentEvents: [],
        visualSpec
      }
    });
  });

  await page.goto("/customer.html");
  await page.getByRole("button", { name: "Let's talk" }).click();

  await expect(page.getByTestId("step-rail")).toContainText("Exterior spec");
  await expect(page.getByTestId("build-context-panel")).toContainText("Exterior direction");
  await expect(page.locator(".van-canvas-body")).toHaveAttribute("fill", "#6c876f");
  await expect(page.locator('circle[cx="206"][cy="252"]').first()).toHaveAttribute("r", "32");
  const backgroundA = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--bg-a").trim());
  expect(backgroundA).toBe("#dce8dc");

  const viewportCheck = await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 8);
  expect(viewportCheck).toBe(true);
});

test("renders interior swatches from the visual spec", async ({ page }) => {
  const visualSpec = buildVisualSpec({
    currentStep: "interior",
    stepRail: [
      { step: "vision", label: "Vision and use case", state: "complete" },
      { step: "exterior", label: "Exterior spec", state: "complete" },
      { step: "interior", label: "Interior spec", state: "current" },
      { step: "layout", label: "Layout and sleeping", state: "upcoming" },
      { step: "gear", label: "Gear, review, and submit", state: "upcoming" }
    ]
  });
  const session = buildSession(3, {
    exterior: { exteriorColor: "Forest green" },
    interior: {
      fixtureColor: "Warm birch",
      primaryTexture: "Matte linen",
      secondaryTexture: "Stone wool",
      stitchingColor: "Sand stitch",
      seatFinish: "Weatherproof camel"
    }
  });

  await installCustomerMocks(page);
  await page.route(`**/api/configurations/${sessionId}`, async (route) => {
    await route.fulfill({
      json: {
        session,
        turns: [],
        agentEvents: [],
        visualSpec
      }
    });
  });

  await page.goto("/customer.html");
  await page.getByRole("button", { name: "Let's talk" }).click();

  await expect(page.getByTestId("build-context-panel")).toContainText("Material board");
  await expect(page.getByText("Warm birch")).toBeVisible();
  await expect(page.getByText("Matte linen")).toBeVisible();
  await expect(page.getByText("Weatherproof camel")).toBeVisible();
});

test("lets the customer reopen completed build steps from the step rail", async ({ page }) => {
  const visualSpec = buildVisualSpec({
    currentStep: "layout",
    stepRail: [
      { step: "vision", label: "Vision and use case", state: "complete" },
      { step: "exterior", label: "Exterior spec", state: "complete" },
      { step: "interior", label: "Interior spec", state: "complete" },
      { step: "layout", label: "Layout and sleeping", state: "current" },
      { step: "gear", label: "Gear, review, and submit", state: "upcoming" }
    ]
  });
  const session = buildSession(4, {
    exterior: { exteriorColor: "Forest green" },
    interior: { fixtureColor: "Warm birch" },
    layout: { driveSide: "left-hand drive" }
  });

  await installCustomerMocks(page);
  await page.route(`**/api/configurations/${sessionId}`, async (route) => {
    await route.fulfill({
      json: {
        session,
        turns: [],
        agentEvents: [],
        visualSpec
      }
    });
  });

  await page.goto("/customer.html");
  await page.getByRole("button", { name: "Let's talk" }).click();

  await expect(page.getByTestId("build-context-panel")).toContainText("Layout plan");
  await page.getByRole("button", { name: /Exterior spec/i }).click();
  await expect(page.getByTestId("build-context-panel")).toContainText("Exterior direction");
  await expect(page.getByRole("button", { name: /Exterior spec/i })).toHaveAttribute("aria-pressed", "true");
});

test("applies streamed visual spec updates for layout and gear", async ({ page }) => {
  const initialVisualSpec = buildVisualSpec({
    currentStep: "layout",
    stepRail: [
      { step: "vision", label: "Vision and use case", state: "complete" },
      { step: "exterior", label: "Exterior spec", state: "complete" },
      { step: "interior", label: "Interior spec", state: "complete" },
      { step: "layout", label: "Layout and sleeping", state: "current" },
      { step: "gear", label: "Gear, review, and submit", state: "upcoming" }
    ],
    layoutFloorplan: {
      gridColumns: 12,
      gridRows: 6,
      driveSide: "right",
      frontSeatConfig: "Swivel captain seats",
      notes: ["Right-hand drive", "Full galley", "Bike garage"],
      zones: [
        { kind: "driver", x: 10, y: 0, w: 2, h: 2, label: "RHD cockpit", shortLabel: "DR", emphasis: "primary" },
        { kind: "passenger", x: 8, y: 0, w: 2, h: 2, label: "Passenger seat", shortLabel: "PS", emphasis: "secondary" },
        { kind: "galley", x: 6, y: 2, w: 4, h: 2, label: "Full galley", shortLabel: "GA", emphasis: "primary" },
        { kind: "dinette", x: 2, y: 2, w: 4, h: 2, label: "Bench dinette", shortLabel: "DN", emphasis: "support" },
        { kind: "storage", x: 0, y: 2, w: 4, h: 2, label: "Bike garage", shortLabel: "ST", emphasis: "secondary" },
        { kind: "bed", x: 2, y: 4, w: 8, h: 2, label: "Murphy bed", shortLabel: "BD", emphasis: "primary" }
      ],
      legend: [
        { kind: "driver", label: "RHD cockpit", shortLabel: "DR", emphasis: "primary" },
        { kind: "passenger", label: "Passenger seat", shortLabel: "PS", emphasis: "secondary" },
        { kind: "galley", label: "Full galley", shortLabel: "GA", emphasis: "primary" },
        { kind: "dinette", label: "Bench dinette", shortLabel: "DN", emphasis: "support" },
        { kind: "storage", label: "Bike garage", shortLabel: "ST", emphasis: "secondary" },
        { kind: "bed", label: "Murphy bed", shortLabel: "BD", emphasis: "primary" }
      ]
    },
    exteriorScene: {
      ...buildVisualSpec({}).exteriorScene,
      driveSide: "right",
      frontSeatConfig: "Swivel captain seats"
    }
  });
  const streamedVisualSpec = buildVisualSpec({
    generatedBy: "agent",
    currentStep: "gear",
    stepRail: [
      { step: "vision", label: "Vision and use case", state: "complete" },
      { step: "exterior", label: "Exterior spec", state: "complete" },
      { step: "interior", label: "Interior spec", state: "complete" },
      { step: "layout", label: "Layout and sleeping", state: "complete" },
      { step: "gear", label: "Gear, review, and submit", state: "current" }
    ]
  });
  const session = buildSession(4, {
    exterior: { exteriorColor: "Forest green" },
    layout: { driveSide: "right-hand drive" },
    gear: { ladder: true, rearCarrier: "Swing-out bike tray" }
  });

  await installCustomerMocks(page, [
    {
      type: "visual_spec_updated",
      sessionId,
      metadata: {
        visualSpec: streamedVisualSpec
      }
    }
  ]);
  await page.route(`**/api/configurations/${sessionId}`, async (route) => {
    await route.fulfill({
      json: {
        session,
        turns: [],
        agentEvents: [],
        visualSpec: initialVisualSpec
      }
    });
  });

  await page.goto("/customer.html");
  await page.getByRole("button", { name: "Let's talk" }).click();

  await expect(page.getByTestId("floorplan-zone-driver")).toContainText("DR");
  await expect(page.getByTestId("layout-legend")).toContainText("RHD cockpit");
  await expect(page.getByTestId("build-context-panel")).toContainText("Layout plan");
  await expect(page.getByTestId("build-context-panel")).not.toContainText("Systems + gear");
  await expect(page.getByTestId("build-context-panel")).not.toContainText("Swing-out bike tray");
});
