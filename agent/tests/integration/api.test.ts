import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import express from "express";
import { apiKeyAuth } from "../../src/auth";
import { sanitizeLLMOutput } from "../../src/sanitize";

describe("Auth Middleware", () => {
  const mockReq = (apiKey?: string) => ({ headers: { "x-api-key": apiKey || "" } } as any);
  const mockRes = () => {
    const res: any = {};
    res.status = (code: number) => { res.statusCode = code; return res; };
    res.json = (obj: any) => { res.body = obj; return res; };
    return res;
  };
  const mockNext = vi.fn();

  it("rejects missing API key when configured", () => {
    process.env.VIGIL_API_KEY = "test-key";
    const req = mockReq();
    const res = mockRes();
    apiKeyAuth(req, res, mockNext);
    expect(res.statusCode).toBe(401);
  });

  it("rejects wrong API key when configured", () => {
    process.env.VIGIL_API_KEY = "test-key";
    const req = mockReq("wrong-key");
    const res = mockRes();
    apiKeyAuth(req, res, mockNext);
    expect(res.statusCode).toBe(401);
  });

  it("accepts correct API key", () => {
    process.env.VIGIL_API_KEY = "test-key";
    const req = mockReq("test-key");
    const res = mockRes();
    apiKeyAuth(req, res, mockNext);
    expect(mockNext).toHaveBeenCalled();
  });

  afterAll(() => { delete process.env.VIGIL_API_KEY; });
});

describe("Sanitizer", () => {
  it("removes markdown images", () => {
    const result = sanitizeLLMOutput("Hello ![image](url) world");
    expect(result).not.toContain("![image]");
  });

  it("removes JSON code blocks", () => {
    const result = sanitizeLLMOutput("Here is ```json\n{\"key\":\"value\"}\n``` the data");
    expect(result).not.toContain("```json");
  });

  it("redacts potential secret keys", () => {
    const result = sanitizeLLMOutput("My key is sk-abcdef1234567890abcdef1234567890abcdef12");
    expect(result).not.toContain("sk-abcdef1234567890abcdef1234567890abcdef12");
    expect(result).toContain("[REDACTED]");
  });

  it("redacts potential private keys", () => {
    const result = sanitizeLLMOutput("Key: 0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890");
    expect(result).toContain("[REDACTED]");
  });

  it("passes clean text through unchanged", () => {
    const text = "Your portfolio value is $1,234.56 with 12.5% APR";
    expect(sanitizeLLMOutput(text)).toBe(text);
  });
});
