import { test, expect } from "@playwright/test";

test("renders agent thought bubbles and artifact cards", async ({ page }) => {
  await page.addInitScript(() => {
    class MockEventSource {
      onmessage: ((event: MessageEvent<string>) => void) | null = null;

      constructor() {
        window.setTimeout(() => {
          this.onmessage?.({
            data: JSON.stringify({
              type: "agent_status",
              sessionId: "session-123",
              agentName: "Session Monitor",
              detail: "Confidence crossed threshold and design planning is starting.",
              status: "monitoring",
              timestamp: new Date().toISOString()
            })
          } as MessageEvent<string>);
        }, 120);
      }

      close() {}
    }

    // @ts-expect-error test-only mock
    window.EventSource = MockEventSource;
  });

  const session = {
    id: "session-123",
    status: "submitted",
    currentStep: 5,
    createdAt: "2026-03-09T16:00:00.000Z",
    updatedAt: "2026-03-09T16:10:00.000Z",
    submittedAt: "2026-03-09T16:10:00.000Z",
    latestConfidence: 0.92,
    artifactCount: 2,
    lastEventAt: "2026-03-09T16:10:00.000Z",
    theme: {
      paletteChoice: "Forest Calm",
      visualTone: "Modern expedition"
    },
    state: {
      vision: { useCase: "Weekend escapes" },
      exterior: { exteriorColor: "Forest green" },
      interior: { interiorTone: "Warm oak" },
      layout: { sleepingConfiguration: "Murphy bed" },
      gear: { accessories: ["Bike rack"] }
    }
  };

  await page.route("**/api/configurations", async (route) => {
    await route.fulfill({
      json: {
        items: [session]
      }
    });
  });

  await page.route("**/api/configurations/session-123", async (route) => {
    await route.fulfill({
      json: {
        session,
        turns: [
          {
            id: 1,
            sessionId: "session-123",
            speaker: "customer",
            text: "Customer wants a quiet all-season build.",
            step: "vision",
            createdAt: "2026-03-09T16:02:00.000Z"
          }
        ],
        agentEvents: []
      }
    });
  });

  await page.route("**/api/configurations/session-123/artifacts", async (route) => {
    await route.fulfill({
      json: {
        items: [
          {
            id: 2,
            sessionId: "session-123",
            agentName: "Design Planner",
            templateType: "design-brief",
            renderedContent: "<article><h2>Forest Calm Build</h2><p>Design Brief ready.</p></article>",
            createdAt: "2026-03-09T16:09:00.000Z"
          }
        ]
      }
    });
  });

  await page.goto("/ops.html");

  await expect(page.getByText("Northstar Vans Ops Theater")).toBeVisible();
  await expect(
    page.getByText("Confidence crossed threshold and design planning is starting.").first()
  ).toBeVisible();
  await expect(page.getByText("Design Planner revision")).toBeVisible();
  await expect(page.getByText("Forest Calm Build")).toBeVisible();
});
