import { describe, it, expect, vi } from "vitest";

vi.mock("../../src/skills/byreal-wrapper", () => ({
  byreal: {
    pools: { list: vi.fn(), info: vi.fn() },
    swap: { execute: vi.fn() },
    positions: { list: vi.fn(), open: vi.fn(), close: vi.fn() },
    overview: vi.fn(),
  },
  byrealPerps: {
    order: { market: vi.fn() },
    position: { closeMarket: vi.fn() },
  },
}));

vi.mock("../../src/onchain-logger", () => ({
  logDecision: vi.fn().mockResolvedValue("0xtx"),
  logPerformance: vi.fn().mockResolvedValue(""),
}));

vi.mock("../../src/skills/wallet-derivation", () => ({
  writeKeypairFile: vi.fn().mockResolvedValue("/tmp/keypair.json"),
  cleanupKeypairFile: vi.fn(),
  deriveKeypair: vi.fn().mockReturnValue({ publicKey: "testPubKey", secretKey: new Uint8Array(32) }),
}));

vi.mock("../../src/trade-events", () => ({ tradeEvents: { emit: vi.fn() } }));

import { executeStrategy } from "../../src/executor";

const mockProfile = { tier: 1, label: "Balanced", score: 1, maxDrawdown: 20, preferredStrategies: [], stopLoss: 15 };

describe("Executor", () => {
  it("returns failure for unknown action", async () => {
    const result = await executeStrategy(mockProfile as any, "unknown_action", {});
    expect(result.success).toBe(false);
    expect(result.details).toContain("Unknown action");
  });

  it("returns failure for execute_swap without params", async () => {
    const result = await executeStrategy(mockProfile as any, "execute_swap", {});
    expect(result.success).toBe(false);
    expect(result.details).toContain("Validation failed");
  });

  it("returns failure for open_position without params", async () => {
    const result = await executeStrategy(mockProfile as any, "open_position", {});
    expect(result.success).toBe(false);
    expect(result.details).toContain("Validation failed");
  });

  it("returns failure for close_position without position", async () => {
    const result = await executeStrategy(mockProfile as any, "close_position", {});
    expect(result.success).toBe(false);
    expect(result.details).toContain("Validation failed");
  });

  it("returns failure for close_perp without coin", async () => {
    const result = await executeStrategy(mockProfile as any, "close_perp", {});
    expect(result.success).toBe(false);
    expect(result.details).toContain("Validation failed");
  });

  it("returns failure for open_perp without params", async () => {
    const result = await executeStrategy(mockProfile as any, "open_perp", {});
    expect(result.success).toBe(false);
    expect(result.details).toContain("Validation failed");
  });

  it("handles pools_list action", async () => {
    const { byreal } = await import("../../src/skills/byreal-wrapper");
    (byreal.pools.list as any).mockResolvedValue({ success: true, data: [{ pool: "test" }] });
    const result = await executeStrategy(mockProfile as any, "pools_list", {});
    expect(result.success).toBe(true);
  });

  it("handles check_balance action", async () => {
    const { byreal } = await import("../../src/skills/byreal-wrapper");
    (byreal.overview as any).mockResolvedValue({ success: true, data: { totalUsd: 1000 } });
    const result = await executeStrategy(mockProfile as any, "check_balance", {});
    expect(result.success).toBe(true);
  });

  it("returns derived wallet address from get_wallet_address", async () => {
    const result = await executeStrategy(mockProfile as any, "get_wallet_address", { userAddress: "0x1234567890123456789012345678901234567890" });
    expect(result.success).toBe(true);
    expect(result.details).toContain("testPubKey");
  });
});
