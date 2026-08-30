import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "./auth.js";

describe("password hashing", () => {
  it("accepts the correct password", () => {
    const h = hashPassword("test-password-do-not-use");
    expect(verifyPassword("test-password-do-not-use", h)).toBe(true);
  });

  it("rejects a wrong password", () => {
    const h = hashPassword("test-password-do-not-use");
    expect(verifyPassword("outra-password", h)).toBe(false);
  });

  it("generates a different salt on every call", () => {
    expect(hashPassword("mesma")).not.toBe(hashPassword("mesma"));
  });

  it("rejects a malformed hash instead of throwing", () => {
    expect(verifyPassword("x", "lixo")).toBe(false);
    expect(verifyPassword("x", "")).toBe(false);
  });
});
