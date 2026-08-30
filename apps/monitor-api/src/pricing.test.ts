import { describe, it, expect } from "vitest";
import { estimateCost, DEFAULT_PRICE_PER_1K_TOKENS_USD } from "./pricing.js";

describe("estimateCost", () => {
  it("uses the configured rate for a known model", () => {
    expect(estimateCost("gpt-5-mini", 1000)).toBeCloseTo(0.01);
  });

  it("falls back to the default rate for an unknown model", () => {
    expect(estimateCost("model-unknown", 1000)).toBeCloseTo(DEFAULT_PRICE_PER_1K_TOKENS_USD);
  });

  it("scales linearly with token count", () => {
    expect(estimateCost("gpt-5-mini", 2000)).toBeCloseTo(0.02);
  });
});
