import { describe, expect, it } from "vitest";
import {
  advanceGuidedSession,
  getOpsBoard,
  resetDemoState,
  startGuidedSession,
  submitSession
} from "./store";

describe("guided journey and ops board", () => {
  it("starts in step 1 when context is incomplete", () => {
    resetDemoState();
    const result = startGuidedSession({ terrain: "city", region: "CO" });

    expect(result.journeyState.step).toBe(1);
    expect(result.nextQuestion).toMatch(/context/i);
  });

  it("advances to recommendation and enforces compact structure", () => {
    resetDemoState();
    const result = startGuidedSession({
      customerName: "Ari Quill",
      budgetBand: "premium",
      terrain: "winter",
      region: "CO",
      tripStyle: "family",
      moods: ["family", "winter"]
    });

    expect(result.session.journey.step).toBe(3);
    expect(result.stepCards.length).toBeGreaterThan(0);
    expect(result.requiredInputs).toBeDefined();

    const advanced = advanceGuidedSession({
      sessionId: result.session.id,
      optionId: "option-snow-traction"
    });

    expect(advanced?.session.journey.step).toBe(5);
    expect(advanced?.session.selectedOptionIds).toContain("option-snow-traction");

    const shownOptions = advanceGuidedSession({
      sessionId: result.session.id,
      action: "show_options"
    });

    expect(shownOptions?.session.journey.step).toBe(4);
  });

  it("uses safe defaults when preference details are intentionally skipped", () => {
    resetDemoState();
    const result = startGuidedSession({
      customerName: "Jamie",
      budgetBand: "balanced",
      terrain: "city",
      region: "NW",
      tripStyle: "family-roadtrip"
    });

    expect(result.session.journey.step).toBe(2);

    const defaulted = advanceGuidedSession({
      sessionId: result.session.id,
      action: "use_default_preferences"
    });

    expect(defaulted?.session.journey.step).toBe(3);
    expect(defaulted?.session.chosenVanId).toBeTruthy();
  });

  it("creates a blocked issue for incompatible options and surfaces P0/P1 fixes", () => {
    resetDemoState();
    const result = startGuidedSession({
      customerName: "Ari Quill",
      budgetBand: "premium",
      terrain: "water",
      region: "CO",
      tripStyle: "adventure",
      moods: ["adventure", "water"]
    });

    const withOption = advanceGuidedSession({
      sessionId: result.session.id,
      optionId: "option-snow-traction"
    });

    const submit = submitSession(withOption!.session.id);
    expect(submit?.status).toBe("blocked");

    const board = getOpsBoard();
    expect(board.fixCandidates[0]).toBeDefined();
    expect(board.immediateFixes[0]).toBeDefined();
    expect(board.priorityQueue[0].priority).toMatch(/P[0-2]/);
  });
});
