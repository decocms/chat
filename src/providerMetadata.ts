import "server-only";
import { record } from "../shared/validation";
/** AI SDK usage.raw is provider JSON, not a fixed cost DTO. Preserve finite
 * numeric/string charges (including zero/refunds); never coerce containers. */
export function providerCost(usage: unknown): number {
  const raw = record(usage) && record(usage.raw) ? usage.raw : null;
  const value = raw?.cost;
  if (typeof value !== "number" && typeof value !== "string") return 0;
  const cost = Number(value);
  return Number.isFinite(cost) ? cost : 0;
}
/** Narrow caught values without assuming Error or invoking object coercion. */
export function caughtMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (record(error) && typeof error.message === "string") return error.message;
  if (
    error === null ||
    error === undefined ||
    typeof error === "string" ||
    typeof error === "number" ||
    typeof error === "boolean"
  )
    return String(error);
  return "Unknown error";
}
