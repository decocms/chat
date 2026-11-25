import type { ChatMessage } from "../../app/chatTypes";
import type { ForwardDestination } from "./destinations";

export type ForwardOutcome =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; error: "file" | "gone"; name?: string }>;
/** What the room gives the chat for "Encaminhar": where a forward can go, and the forward itself. */
export type ForwardPort = Readonly<{
  /** The open room's threads, your rooms and your DMs that match the query. */
  destinations(query: string): readonly ForwardDestination[];
  /** Threads of your other rooms that match the query (the room search, 2 characters or more). */
  search(
    query: string,
    signal: AbortSignal,
  ): Promise<readonly ForwardDestination[]>;
  /** Goes to the destination and fills its composer with the messages and their files. It does not send. */
  send(
    target: ForwardDestination,
    messages: readonly ChatMessage[],
    ranged: boolean,
  ): Promise<ForwardOutcome>;
}>;
