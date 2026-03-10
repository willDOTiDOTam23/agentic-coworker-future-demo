import { describe, expect, it } from "vitest";
import {
  assembleDashboardPayload,
  advanceGuidedSession,
  getOpsBoard,
  getVanTemplates,
  resetDemoState,
  seedDeterministicIssueScenario,
  startGuidedSession,
  submitSession
} from "./store.js";

describe("guided journey and ops board", () => {
  it("starts in step 1 when context is incomplete", () => {
    resetDemoState();
    const result = startGuidedSession({ terrain: "city", region: "CO" });

    expect(result.journeyState.step).toBe(1);
    expect(result.nextQuestion).toMatch(/template|scratch|step 1/i);
  });

  it("starts at step 1 when no template or scratch mode is selected", () => {
    resetDemoState();
    const result = startGuidedSession({ terrain: "water", region: "CO" });

    expect(result.journeyState.step).toBe(1);
    expect(result.requiredInputs).toEqual(expect.arrayContaining(["templateId", "startFromScratch"]));
  });

  it("starts at step 2 with a selected template", () => {
    resetDemoState();
    const template = getVanTemplates()[0];

    const result = startGuidedSession({
      customerName: "Template Client",
      budgetBand: "premium",
      terrain: "winter",
      region: "CO",
      templateId: template.id
    });

    expect(result.session.journey.step).toBe(2);
    expect(result.session.templateId).toBe(template.id);
  });

  it("starts at step 2 with start-from-scratch mode", () => {
    resetDemoState();
    const result = startGuidedSession({
      customerName: "Scratch Client",
      budgetBand: "premium",
      terrain: "city",
      region: "CO",
      startFromScratch: true
    });

    expect(result.session.journey.step).toBe(2);
    expect(result.session.isFromScratch).toBe(true);
  });

  it("advances through five steps and submits", () => {
    resetDemoState();
    const template = getVanTemplates()[0];
    const result = startGuidedSession({
      customerName: "Ari Quill",
      budgetBand: "luxury",
      terrain: "winter",
      region: "CO",
      templateId: template.id,
      tripStyle: "adventure"
    });

    const afterExterior = advanceGuidedSession({
      sessionId: result.session.id,
      exterior: {
        paintColor: "paint-warm-sand",
        roofRack: "rack-rugged",
        wheels: "wheel-all-terrain",
        lights: "light-led"
      },
      nextStep: 3
    });
    expect(afterExterior?.session.journey.step).toBe(3);

    const afterInterior = advanceGuidedSession({
      sessionId: result.session.id,
      interior: {
        level: "minimal-build-out",
        lifestyleMode: "relax"
      },
      nextStep: 4
    });
    expect(afterInterior?.session.journey.step).toBe(4);

    const afterPower = advanceGuidedSession({
      sessionId: result.session.id,
      power: {
        drivetrain: "hybrid"
      },
      nextStep: 5
    });
    expect(afterPower?.session.journey.step).toBe(5);

    const afterAccessories = advanceGuidedSession({
      sessionId: result.session.id,
      optionIds: ["option-solar-panels", "option-portable-fridge"]
    });
    expect(afterAccessories?.session.journey.step).toBe(5);

    const submitted = submitSession(result.session.id);
    expect(submitted?.status).toBe("submitted");
  });

  it("blocks submit until step 5 is reached", () => {
    resetDemoState();
    const result = startGuidedSession({
      customerName: "Early Submit",
      budgetBand: "balanced",
      terrain: "city",
      region: "CA",
      templateId: getVanTemplates()[0]?.id
    });

    const attemptedSubmit = submitSession(result.session.id);
    expect(attemptedSubmit?.status).toBe("needs_attention");
    expect(attemptedSubmit?.error).toBe("Please complete the guided flow before submitting.");
  });

  it("surfaces dashboard cards and issue-based ops rows", () => {
    resetDemoState();
    const template = getVanTemplates()[0];

    const completed = startGuidedSession({
      customerName: "Jamie",
      budgetBand: "luxury",
      terrain: "city",
      region: "CO",
      templateId: template.id
    });

    advanceGuidedSession({
      sessionId: completed.session.id,
      exterior: {
        paintColor: "paint-warm-sand",
        roofRack: "rack-rugged",
        wheels: "wheel-all-terrain",
        lights: "light-led"
      },
      nextStep: 3
    });
    advanceGuidedSession({
      sessionId: completed.session.id,
      interior: {
        level: "minimal-build-out",
        lifestyleMode: "true-adventure"
      },
      nextStep: 4
    });
    advanceGuidedSession({
      sessionId: completed.session.id,
      power: {
        drivetrain: "all-electric"
      },
      nextStep: 5
    });
    advanceGuidedSession({ sessionId: completed.session.id, action: "safe_baseline" });
    const submitted = submitSession(completed.session.id);
    expect(submitted?.status).toBe("submitted");

    const blockedTemplate = startGuidedSession({
      customerName: "Roadblock",
      budgetBand: "luxury",
      terrain: "water",
      region: "CO",
      templateId: template.id
    });
    advanceGuidedSession({
      sessionId: blockedTemplate.session.id,
      exterior: {
        paintColor: "paint-matte-graphite",
        roofRack: "rack-sleek",
        wheels: "wheel-all-terrain",
        lights: "light-led"
      },
      nextStep: 3
    });
    advanceGuidedSession({
      sessionId: blockedTemplate.session.id,
      interior: {
        level: "moderate-build-out",
        lifestyleMode: "true-adventure"
      },
      nextStep: 4
    });
    advanceGuidedSession({
      sessionId: blockedTemplate.session.id,
      power: {
        drivetrain: "internal-combustion"
      },
      nextStep: 5
    });
    advanceGuidedSession({
      sessionId: blockedTemplate.session.id,
      optionId: "option-snow-traction"
    });
    const blocked = submitSession(blockedTemplate.session.id);
    expect(blocked?.status).toBe("blocked");

    const board = getOpsBoard();
    expect(board.fixCandidates.length).toBeGreaterThan(0);
    expect((board.performanceBugs ?? []).length).toBeGreaterThan(0);

    const dashboard = assembleDashboardPayload();
    expect(dashboard.kpis.length).toBeGreaterThan(0);
    expect(dashboard.featureIdeas.length).toBeGreaterThan(0);
    expect(dashboard.recentTransactions.length).toBeGreaterThan(0);
  });

  it("creates a deterministic issue scenario for the stage runbook", () => {
    resetDemoState();
    const seeded = seedDeterministicIssueScenario({ customerName: "Stage Demo" });

    expect(seeded.sessionId).toBeTruthy();
    expect(seeded.issue).toBeTruthy();
    expect(seeded.submissionStatus).toBe("blocked");
    expect(seeded.board.immediateFixes.length).toBeGreaterThan(0);
  });
});
