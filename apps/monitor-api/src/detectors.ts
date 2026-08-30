export interface DetectorHit {
  policyId: string;
  match: string;
}

interface Detector {
  policyId: string;
  pattern: RegExp;
}

// Deterministic detectors, the cheapest stage of the detection cascade. None of these send
// content to a language model: they are plain regular expressions evaluated locally, which
// keeps message content inside this process.
const DETECTORS: Detector[] = [
  { policyId: "SEC-001", pattern: /\bsk-[A-Za-z0-9]{20,}\b/g },
  { policyId: "SEC-001", pattern: /\bAKIA[0-9A-Z]{16}\b/g },
  { policyId: "SEC-001", pattern: /\bghp_[A-Za-z0-9]{36}\b/g },
  { policyId: "SEC-001", pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { policyId: "SEC-002", pattern: /\b(?:password|password|token|bearer)\s*[:=]\s*\S{6,}/gi },
  { policyId: "SEC-003", pattern: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/g },
  { policyId: "PRIV-001", pattern: /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g },
];

export function maskEvidence(match: string): string {
  if (match.length <= 8) return "*".repeat(match.length);
  return `${match.slice(0, 4)}${"*".repeat(Math.min(match.length - 8, 20))}${match.slice(-4)}`;
}

export function scanText(text: string): DetectorHit[] {
  const hits: DetectorHit[] = [];
  for (const detector of DETECTORS) {
    for (const match of text.matchAll(detector.pattern)) {
      hits.push({ policyId: detector.policyId, match: match[0] });
    }
  }
  return hits;
}
