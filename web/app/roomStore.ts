import { writable, get } from "svelte/store";

// Book's WebSocket owns room state. Yjs owns document text only; it is not a
// second source of truth for tasks, messages, members or epics.
import type { Room, RoomEvent, Message, Ack } from "../../shared/room";
export type * from "../../shared/room";

/** The threads after a patch: the changed ones replace theirs, in the Book's order (an id not in it is gone).
 *  null when the order names a thread the room does not have. */
function mergeEpics(
  epics: Room["epics"],
  changed: Room["epics"],
  order: readonly string[],
) {
  const have = new Map(epics.map((e) => [e.id, e]));
  changed.forEach((e) => have.set(e.id, e));
  if (order.some((id) => !have.has(id))) return null;
  return order.map((id) => have.get(id)!);
}
export function reduceRoom(
  current: Room | null,
  event: RoomEvent,
  id: string,
): Room | null {
  if (event.t === "state" && event.resume && current?.id === id) {
    // A resumed reconnect (cache plan PR 2): its messages and acks are upserted into the ones the room has; the rest
    // replaces, as a full state does. epicsSame keeps the room's threads.
    const { resume: _resume, epicsSame, epicsOrder, t: _t, ...rest } = event;
    const messages = new Map(current.messages.map((m) => [m.id, m]));
    for (const m of event.messages) messages.set(m.id, m);
    const fresh = new Set((event.acks ?? []).map((a) => a.msg_id));
    // ed=1 resume: only the changed threads came. One the room lacks (it should not happen): keep ours, and no eh,
    // so the next open gets them whole.
    const merged = epicsOrder
      ? mergeEpics(current.epics, event.epics, epicsOrder)
      : event.epics;
    return {
      ...current,
      ...rest,
      // A resume from the log leaves out the lists with no change (Gimenes #6240): the room keeps its own. Files that
      // came are the short list again, so "all files" is no longer true.
      filesAll: "files" in rest ? rest.filesAll : current.filesAll,
      typing: {},
      messages: [...messages.values()].sort((a, b) => a.id - b.id),
      epics: epicsSame ? current.epics : (merged ?? current.epics),
      ...(!epicsSame && !merged ? { eh: undefined } : {}),
      acks: [
        ...(current.acks ?? []).filter((a) => !fresh.has(a.msg_id)),
        ...(event.acks ?? []),
      ],
    };
  }
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
    case "msgEdit": {
      const patch: Partial<Message> = event.deleted
        ? {
            text: "",
            deleted: event.deleted,
            files: [],
            card: null,
            choices: null,
            poll: null,
          }
        : { text: event.text, edited: event.edited };
      return {
        ...s,
        messages: updateMessage(event.id, patch),
        origins: s.origins?.map((message) =>
          message.id === event.id ? { ...message, ...patch } : message,
        ),
      };
    }
    case "history":
      return { ...s, history: { ...s.history, [event.id]: event.versions } };
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
        // The hash of the list the Book now has (an older one sends none: a reconnect then gets them whole).
        eh: event.eh,
      };
    case "epicsPatch": {
      const epics = mergeEpics(s.epics, event.changed, event.order);
      if (!epics) return s;
      return {
        ...s,
        epics,
        roomTasks: event.roomTasks ?? s.roomTasks,
        eh: event.eh,
      };
    }
    case "docNotes":
      return { ...s, docNotes: event.notes };
    case "briefs":
      return { ...s, briefs: event.briefs };
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
        handles: event.handles ?? s.handles,
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
    case "call":
      return {
        ...s,
        call: event.call,
        callThread: event.thread,
        ring: event.ring,
        consent: event.consent,
      };
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
