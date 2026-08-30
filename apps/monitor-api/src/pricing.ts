// Placeholder price table, per 1000 tokens, USD. These are approximations and must be
// reviewed against real provider invoices before any figure derived here is treated as
// authoritative. Used only when no aggregate cost collection is configured (see
// env.costCollectionName) — this is what makes cost figures work out of the box for any
// LibreChat deployment, not just one with its own cost-apportioning pipeline.
export const PRICE_PER_1K_TOKENS_USD: Record<string, number> = {
  "gpt-5.5": 0.03,
  "gpt-5-mini": 0.01,
  "gpt-4o": 0.025,
  "gemini-3.5-flash": 0.008,
  "gemini-2.5-flash": 0.006,
  "sonnet-4.6": 0.02,
  "sonnet-4.5": 0.02,
  "opus-5": 0.06,
  "opus-4.8": 0.05,
};

export const DEFAULT_PRICE_PER_1K_TOKENS_USD = 0.02;

export function estimateCost(model: string, tokens: number): number {
  const rate = PRICE_PER_1K_TOKENS_USD[model] ?? DEFAULT_PRICE_PER_1K_TOKENS_USD;
  return (tokens / 1000) * rate;
}
