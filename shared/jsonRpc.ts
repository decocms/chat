// JSON-RPC 2.0 on our WebSockets (https://www.jsonrpc.org/specification). Browser-safe: zod/mini only.
//
// Inside the code a message is a typed tagged object, `{ t: "doc.get", epic }`. On the wire it is a JSON-RPC message
// with `method = t` and `params = the other fields`:
// - a command that wants an answer is a request (`id`); the answer is a response with the same `id`;
// - a command without an answer, and each event the server pushes, is a notification (no `id`).
// Yjs (DocRoom) is binary and is not JSON-RPC.
import * as z from "zod/mini";

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const JSONRPC = "2.0";

/** Our request ids are short strings ("r-12"); numbers are valid JSON-RPC ids too. */
export const RPC_ID_MAX = 64;
export const RpcId = z.union([
  z.string().check(z.minLength(1), z.maxLength(RPC_ID_MAX)),
  z.number(),
]);
export type RpcId = z.infer<typeof RpcId>;

/** Standard codes, plus REFUSED for a command the room turned down (the message says why). */
export const RpcErrorCode = {
  PARSE: -32700,
  INVALID_REQUEST: -32600,
  INVALID_PARAMS: -32602,
  INTERNAL: -32603,
  REFUSED: -32000,
} as const;

export type RpcError = { code: number; message: string };
export type RpcResponse =
  | { jsonrpc: typeof JSONRPC; id: RpcId; result: unknown }
  | { jsonrpc: typeof JSONRPC; id: RpcId | null; error: RpcError };

type Tagged = { t: string };
/** The wire shape of a tagged message: a request with `id`, else a notification. */
export function encodeCall<T extends Tagged>(message: T, id?: RpcId): string {
  const { t, ...params } = message;
  return JSON.stringify(
    id === undefined
      ? { jsonrpc: JSONRPC, method: t, params }
      : { jsonrpc: JSONRPC, id, method: t, params },
  );
}

export function encodeResult(id: RpcId, result: unknown = null): string {
  return JSON.stringify({ jsonrpc: JSONRPC, id, result });
}

export function encodeError(id: RpcId | null, error: RpcError): string {
  return JSON.stringify({ jsonrpc: JSONRPC, id, error });
}

/** A request or notification off the wire, as a tagged object (not yet checked against a schema). `id` is read even
 *  when the call is malformed, so a request still gets its error back; an invalid id counts as none. */
export type DecodedCall =
  | { ok: true; id?: RpcId; message: Tagged & Record<string, unknown> }
  | { ok: false; id?: RpcId; error: RpcError };
export function decodeCall(raw: string): DecodedCall {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      error: { code: RpcErrorCode.PARSE, message: "parse error" },
    };
  }
  const id =
    record(value) && RpcId.safeParse(value.id).success
      ? (value.id as RpcId)
      : undefined;
  if (
    !record(value) ||
    value.jsonrpc !== JSONRPC ||
    typeof value.method !== "string" ||
    (value.params !== undefined && !record(value.params))
  )
    return {
      ok: false,
      id,
      error: { code: RpcErrorCode.INVALID_REQUEST, message: "invalid request" },
    };
  const params = record(value.params) ? value.params : {};
  return { ok: true, id, message: { ...params, t: value.method } };
}

/** A message from the server: the response to one of our requests, or a notification as a tagged object. */
export type DecodedServerMessage =
  | { kind: "response"; id: RpcId; outcome: RpcOutcome }
  | { kind: "notification"; message: Tagged & Record<string, unknown> };
export type RpcOutcome =
  { ok: true; result: unknown } | { ok: false; error: RpcError };
export function decodeServerMessage(raw: string): DecodedServerMessage | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!record(value) || value.jsonrpc !== JSONRPC) return null;
  if (typeof value.method === "string" && value.id === undefined)
    return {
      kind: "notification",
      message: {
        ...(record(value.params) ? value.params : {}),
        t: value.method,
      },
    };
  const id = RpcId.safeParse(value.id);
  if (!id.success) return null;
  if ("result" in value)
    return {
      kind: "response",
      id: id.data,
      outcome: { ok: true, result: value.result },
    };
  const error = value.error;
  if (
    record(error) &&
    typeof error.code === "number" &&
    typeof error.message === "string"
  )
    return {
      kind: "response",
      id: id.data,
      outcome: {
        ok: false,
        error: { code: error.code, message: error.message },
      },
    };
  return null;
}
