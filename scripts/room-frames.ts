// Room WebSocket frames as the browser tests read them. The wire is JSON-RPC (shared/jsonRpc.ts); the tests look at the
// tagged message inside (method = t) and, for a request, its id.
import {
  decodeCall,
  decodeServerMessage,
  type RpcId,
  type RpcOutcome,
} from "../shared/jsonRpc";

type Tagged = { t: string } & Record<string, unknown>;

/** A frame the browser sent: the command, plus `id` when it was a request. Null when it is not JSON-RPC. */
export function sentFrame(raw: unknown): (Tagged & { id?: RpcId }) | null {
  if (typeof raw !== "string") return null;
  const call = decodeCall(raw);
  if (!call.ok) return null;
  return call.id === undefined
    ? call.message
    : { ...call.message, id: call.id };
}

/** A frame the server sent: an event (a notification) or the response to a request. */
export type ReceivedFrame =
  | { kind: "event"; event: Tagged }
  | { kind: "response"; id: RpcId; outcome: RpcOutcome };
export function receivedFrame(raw: unknown): ReceivedFrame | null {
  if (typeof raw !== "string") return null;
  const message = decodeServerMessage(raw);
  if (!message) return null;
  return message.kind === "notification"
    ? { kind: "event", event: message.message }
    : message;
}

/** The event inside a server frame, or null for a response or a frame that is not JSON-RPC. */
export function receivedEvent(raw: unknown): Tagged | null {
  const frame = receivedFrame(raw);
  return frame?.kind === "event" ? frame.event : null;
}
