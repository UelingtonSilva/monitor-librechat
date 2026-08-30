import { describe, it, expect } from "vitest";
import { scanText, maskEvidence } from "./detectors.js";

describe("scanText, deterministic detection", () => {
  it("flags a synthetic API key as SEC-001", () => {
    const hits = scanText("minha chave e sk-FAKEFAKEFAKEFAKEFAKEFAKE123456");
    expect(hits.map((h) => h.policyId)).toContain("SEC-001");
  });

  it("flags an explicit password as SEC-002", () => {
    const hits = scanText("use password: naoUseIssoDeVerdade1");
    expect(hits.map((h) => h.policyId)).toContain("SEC-002");
  });

  it("flags a private key header as SEC-003", () => {
    const hits = scanText("-----BEGIN RSA PRIVATE KEY-----");
    expect(hits.map((h) => h.policyId)).toContain("SEC-003");
  });

  it("flags a national-ID pattern as PRIV-001", () => {
    const hits = scanText("o cpf de teste e 123.456.789-00");
    expect(hits.map((h) => h.policyId)).toContain("PRIV-001");
  });

  it("does not fire on ordinary professional text", () => {
    expect(scanText("Resuma este relatorio de vendas do trimestre.")).toHaveLength(0);
  });
});

describe("maskEvidence", () => {
  it("masks the middle while keeping the edges for investigation", () => {
    const masked = maskEvidence("sk-ABCDEFGHIJKLMNOP");
    expect(masked.startsWith("sk-A")).toBe(true);
    expect(masked.endsWith("MNOP")).toBe(true);
    expect(masked).toContain("*");
  });

  it("fully masks short values", () => {
    expect(maskEvidence("abc123")).toBe("******");
  });
});
