import { writable, get } from "svelte/store";

// Book's WebSocket owns room state. Yjs owns document text only; it is not a
// second source of truth for tasks, messages, members or epics.
import type { Room, RoomEvent, Message, Ack } from "../shared/room";
export type * from "../shared/room";

export function reduceRoom(
  current: Room | null,
  event: RoomEvent,
  id: string,
): Room | null {
  if (event.t === "state") return { ...event, id, typing: {} };
  if (!current || current.id !== id) return current;
  const s = current;
  const updateMessage = (msgId: number, patch: Partial<Message>) =>
    s.messages.map((m) => (m.id === msgId ? { ...m, ...patch } : m));
  switch (event.t) {
    case "msg":
      return {
        ...s,
        messages: s.messages.some((m) => m.id === event.m.id)
          ? s.messages
          : [...s.messages, event.m],
      };
    case "msgCard":
      return {
        ...s,
        messages: updateMessage(event.id, { card: event.card }),
        origins: s.origins?.map((message) =>
          message.id === event.id ? { ...message, card: event.card } : message,
        ),
      };
    case "moved":
      return {
        ...s,
        messages: updateMessage(event.id, { thread: event.thread }),
      };
    case "closed":
      return {
        ...s,
        messages: updateMessage(event.id, { choices: event.choices }),
      };
    case "delta": {
      const typing = { ...s.typing };
      delete typing[event.id];
      return {
        ...s,
        messages: updateMessage(event.id, { text: event.text }),
        typing,
      };
    }
    case "typing":
      return { ...s, typing: { ...s.typing, [event.id]: event.mode } };
    case "epics":
      return {
        ...s,
        epics: event.epics,
        roomTasks: event.roomTasks ?? s.roomTasks,
      };
    case "epicsPatch": {
      const have = new Map(s.epics.map((e) => [e.id, e]));
      event.changed.forEach((e) => have.set(e.id, e));
      if (event.order.some((id) => !have.has(id))) return s;
      return {
        ...s,
        epics: event.order.map((id) => have.get(id)!),
        roomTasks: event.roomTasks ?? s.roomTasks,
      };
    }
    case "docNotes":
      return { ...s, docNotes: event.notes };
    case "doc": {
      const docs = { ...s.docs };
      if (event.stale) {
        if (event.epic) delete docs[event.epic];
        return { ...s, docs };
      }
      return event.epic
        ? { ...s, docs: { ...docs, [event.epic]: event.text ?? "" } }
        : { ...s, doc: event.text ?? "" };
    }
    case "meta":
      return {
        ...s,
        book: {
          ...s.book,
          ...(event.title ? { title: event.title } : {}),
          ...(event.folder ? { folder: event.folder } : {}),
          ...(event.summary ? { summary: event.summary } : {}),
        },
      };
    case "suggestions":
      return { ...s, suggestions: event.suggestions };
    case "requests":
      return { ...s, requests: event.requests };
    case "members":
      return {
        ...s,
        members: event.members,
        pending: event.pending,
        invited: event.invited,
        declined: event.declined,
        requests: event.requests ?? s.requests,
        names: event.names ?? s.names,
        avatars: event.avatars ?? s.avatars,
      };
    case "files":
      return {
        ...s,
        files: event.files,
        filesN: event.files.length,
        filesAll: true,
      };
    case "fileAdd":
      return {
        ...s,
        files: [
          event.file,
          ...(s.files ?? []).filter((f) => f.id !== event.file.id),
        ],
        filesN:
          (s.filesN ?? s.files?.length ?? 0) +
          ((s.files ?? []).some((f) => f.id === event.file.id) ? 0 : 1),
      };
    case "openSide":
      return (s.files ?? []).some((file) => file.id === event.file.id)
        ? s
        : { ...s, files: [event.file, ...(s.files ?? [])] };
    case "reminders":
      return { ...s, reminders: event.reminders };
    case "decisions":
      return { ...s, decisions: event.decisions };
    case "pins":
      return { ...s, pins: event.pins };
    case "receipts":
      return { ...s, receipts: event.receipts };
    case "older": {
      const all = new Map(s.messages.map((m) => [m.id, m]));
      event.messages.forEach((m) => {
        if (!all.has(m.id)) all.set(m.id, m);
      });
      return { ...s, messages: [...all.values()].sort((a, b) => a.id - b.id) };
    }
    case "reactions":
      return {
        ...s,
        messages: s.messages.map((m) =>
          m.id === event.id ? { ...m, reactions: event.reactions } : m,
        ),
      };
    case "acks":
      return { ...s, acks: event.acks };
    case "ackRows": {
      const key = (a: Ack) => `${a.msg_id}|${a.agent ?? a.email}`;
      const keys = new Set(event.acks.map(key));
      return {
        ...s,
        acks: [
          ...event.acks,
          ...(s.acks ?? []).filter((a) => !keys.has(key(a))),
        ],
      };
    }
    case "poll":
      return { ...s, polls: { ...s.polls, [event.poll.id]: event.poll } };
    case "online":
      return { ...s, online: event.online };
    default:
      return s;
  }
}

export function createRoomStore() {
  const store = writable<Room | null>(null);
  return {
    subscribe: store.subscribe,
    get: () => get(store),
    replace: store.set,
    apply(event: RoomEvent, id: string) {
      store.update((current) => reduceRoom(current, event, id));
      return get(store);
    },
  };
}
