/** Filter that restricts db.transactions to real consumption.
 *
 *  LibreChat writes THREE tokenType values, not two: "prompt", "completion" and "credits".
 *  The last one has context "autoRefill" and represents the daily budget top-up — credit
 *  granted by the system, not tokens spent by a person. Any query that sums rawAmount,
 *  counts active users or dates activity needs this filter. Without it a top-up is read as
 *  usage: in production one user showed 573k tokens having consumed 173k, and the per-role
 *  radar inflated by up to 228%.
 *
 *  Deliberately an INCLUDE list. Excluding "credits" by name would break again the moment
 *  LibreChat introduces a fourth type, which is exactly how this bug appeared in the first
 *  place: "credits" showed up after the integration was already written.
 */
export const CONSUMPTION_ONLY = { tokenType: { $in: ["prompt", "completion"] } } as const;
