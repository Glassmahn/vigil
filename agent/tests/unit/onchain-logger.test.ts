import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { getDecisionHistory, getRegistryStatus, isInitialized, getPnlHistory } from "../../src/onchain-logger";

describe("Onchain Logger", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("isInitialized returns false by default", () => {
    expect(isInitialized()).toBe(false);
  });

  it("getPnlHistory returns empty array initially", () => {
    const history = getPnlHistory();
    expect(Array.isArray(history)).toBe(true);
    expect(history.length).toBe(0);
  });

  it("getDecisionHistory returns array", async () => {
    const decisions = await getDecisionHistory();
    expect(Array.isArray(decisions)).toBe(true);
  });

  it("getRegistryStatus returns default values", async () => {
    const status = await getRegistryStatus();
    expect(status).toHaveProperty("active");
    expect(status).toHaveProperty("riskTier");
    expect(status).toHaveProperty("totalTrades");
    expect(status).toHaveProperty("totalPnl");
    expect(status).toHaveProperty("valueManaged");
  });
});
