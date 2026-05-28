import { describe, it, expect } from "vitest";
import { assessRisk, QUESTIONS } from "../../src/risk-assessor";

describe("Risk Assessor", () => {
  it("returns Safe tier for conservative answers", () => {
    const answers = {
      goal: "preserve",
      experience: "new",
      drawdown: "panic",
      timeline: "short",
    };
    const profile = assessRisk(answers);
    expect(profile.tier).toBe(0);
    expect(profile.label).toBe("Safe");
    expect(profile.stopLoss).toBe(5);
  });

  it("returns Balanced tier for moderate answers", () => {
    const answers = {
      goal: "growth",
      experience: "intermediate",
      drawdown: "wait",
      timeline: "medium",
    };
    const profile = assessRisk(answers);
    expect(profile.tier).toBe(1);
    expect(profile.label).toBe("Balanced");
    expect(profile.maxDrawdown).toBe(20);
  });

  it("returns Aggressive tier for aggressive answers", () => {
    const answers = {
      goal: "maximize",
      experience: "expert",
      drawdown: "buy",
      timeline: "long",
    };
    const profile = assessRisk(answers);
    expect(profile.tier).toBe(2);
    expect(profile.label).toBe("Aggressive");
    expect(profile.maxDrawdown).toBe(40);
  });

  it("defaults to Balanced for empty answers", () => {
    const profile = assessRisk({});
    expect(profile.tier).toBe(1);
    expect(profile.label).toBe("Balanced");
  });

  it("has 4 questions defined", () => {
    expect(QUESTIONS.length).toBe(4);
    expect(QUESTIONS[0].id).toBe("goal");
    expect(QUESTIONS[1].id).toBe("experience");
    expect(QUESTIONS[2].id).toBe("drawdown");
    expect(QUESTIONS[3].id).toBe("timeline");
  });

  it("each question has 3 options with valid tier values", () => {
    for (const q of QUESTIONS) {
      expect(q.options.length).toBe(3);
      for (const opt of q.options) {
        expect([0, 1, 2]).toContain(opt.tier);
      }
    }
  });
});
