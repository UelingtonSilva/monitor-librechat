import { describe, it, expect } from "vitest";
import { isWithinBackoffWindow } from "./mongo.js";

describe("isWithinBackoffWindow", () => {
  it("allows a connection attempt when there is no prior failure", () => {
    expect(isWithinBackoffWindow(null, Date.now())).toBe(false);
  });

  it("skips a retry immediately after a failure", () => {
    const failedAt = 1_000_000;
    expect(isWithinBackoffWindow(failedAt, failedAt + 1, 10_000)).toBe(true);
  });

  it("still skips just before the window elapses", () => {
    const failedAt = 1_000_000;
    expect(isWithinBackoffWindow(failedAt, failedAt + 9_999, 10_000)).toBe(true);
  });

  it("allows a retry once the window has elapsed", () => {
    const failedAt = 1_000_000;
    expect(isWithinBackoffWindow(failedAt, failedAt + 10_000, 10_000)).toBe(false);
  });
});
