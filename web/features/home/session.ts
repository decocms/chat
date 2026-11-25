import { get, writable } from "svelte/store";
import type { ArchivedResult, RouteResult } from "../../../shared/schemas";
import type { PersonalSession } from "./personal";
import { destinations, type RoomTarget } from "./model";
import { createAccountPageOwner } from "./ownership";
import { authClock, createAuthOwner, type AuthClock } from "../auth/owner";
import { createSendIds } from "../../lib/client/sendIds";
import { MESSAGE_FILE_LIMIT } from "../../../shared/composition";
import {
  fileIssue,
  mediaType,
  normalizeFile,
  type PendingAttachment,
} from "../composer/model";
import type { CleanPoll } from "../composer/drafts";
const issue = (error: unknown) =>
  error instanceof Error ? error.message : "network";
const roomId = (value: string) => {
  if (!/^[a-z0-9]{6,40}$/.test(value)) throw Error("invalid-response");
  return value;
};
/** Page ownership expires on navigation. The text store belongs to the account and survives remount/refresh. */
export function createHomeSession(
  personal: PersonalSession,
  navigate: (target: RoomTarget) => void,
  clock: AuthClock = authClock,
) {
  const blank = () => ({
    busy: "" as "" | "route" | "send",
    error: "",
    result: null as RouteResult | null,
    selected: 0,
    source: "",
    /** Files held in the ask (the composer's cards): uploaded to the chosen room when the ask is sent there. */
    files: [] as PendingAttachment[],
    /** Why a file was not added (the composer's errors: file-type:, file-size:, attachments-limit). */
    fileError: "",
    /** A poll held in the ask, posted to the chosen room after the text. */
    poll: null as CleanPoll | null,
  });
  const state = writable(blank());
  // A send that failed keeps its client_id: sending the same text there again is the same send.
  const sends = createSendIds();
  // A file already uploaded to a room is not uploaded again on a retry there: "<room>:<file>" → its id in that room.
  const uploaded = new Map<string, string>();
  let nextFile = 0;
  const owner = createAccountPageOwner(personal, clock, () => {
    uploaded.clear();
    state.set(blank());
  });
  /** What the ask is about: its text, or the held poll's question when only a poll is there. */
  const subject = (text: string, poll: CleanPoll | null) =>
    text || poll?.question || "";
  async function uploadAll(
    room: string,
    files: readonly PendingAttachment[],
    signal: AbortSignal,
  ) {
    const ids: string[] = [];
    for (const item of files) {
      const key = `${room}:${item.id}`;
      let id = uploaded.get(key);
      if (!id && item.file) {
        state.update((s) => ({
          ...s,
          files: s.files.map((f) =>
            f.id === item.id ? { ...f, phase: "uploading" } : f,
          ),
        }));
        id = (await personal.api.upload(room, item.file, signal)).id;
        uploaded.set(key, id);
        state.update((s) => ({
          ...s,
          files: s.files.map((f) =>
            f.id === item.id ? { ...f, phase: "ready" } : f,
          ),
        }));
      }
      if (id) ids.push(id);
    }
    return ids;
  }
  const failure = (error: unknown) =>
    state.update((s) => ({
      ...s,
      busy: "",
      error: issue(error),
      files: s.files.map((f) =>
        f.phase === "uploading" ? { ...f, phase: "ready" } : f,
      ),
    }));
  return {
    state,
    edit(text: string) {
      if (!owner.active()) return;
      personal.editAsk(text);
      if (get(state).busy === "route") owner.cancel();
      state.update((s) => ({
        ...s,
        busy: s.busy === "send" ? "send" : "",
        result: null,
        error: "",
      }));
    },
    /** Files picked or pasted into the ask: checked as the composer checks them, held until the send. */
    addFiles(input: readonly File[]) {
      if (!owner.active() || get(state).busy === "send") return;
      for (const raw of input) {
        if (get(state).files.length >= MESSAGE_FILE_LIMIT) {
          state.update((s) => ({ ...s, fileError: "attachments-limit" }));
          break;
        }
        const file = normalizeFile(raw),
          problem = fileIssue(file);
        if (problem) {
          state.update((s) => ({
            ...s,
            fileError: `file-${problem}: ${file.name}`,
          }));
          continue;
        }
        const item: PendingAttachment = {
          id: ++nextFile,
          name: file.name,
          type: mediaType(file.type),
          size: file.size,
          file,
          phase: "ready",
        };
        state.update((s) => ({
          ...s,
          files: [...s.files, item],
          fileError: "",
        }));
      }
    },
    removeFile(id: number) {
      if (!owner.active() || get(state).busy === "send") return;
      state.update((s) => ({
        ...s,
        files: s.files.filter((f) => f.id !== id),
        fileError: "",
      }));
    },
    /** The poll the dialog made, held in the ask (null takes it out). */
    setPoll(poll: CleanPoll | null) {
      if (!owner.active() || get(state).busy === "send") return;
      const before = get(state);
      const text = get(personal.draft).ask.trim();
      // With no text, the poll's question is what was routed: a new question needs a new suggestion.
      const stale =
        (!!before.result || before.busy === "route") &&
        subject(text, poll) !== subject(text, before.poll);
      if (stale) owner.cancel();
      state.update((s) => ({
        ...s,
        poll,
        ...(stale ? { result: null, busy: "" as const } : {}),
      }));
    },
    suggest() {
      if (!owner.active() || get(state).busy) return;
      const text = subject(get(personal.draft).ask.trim(), get(state).poll);
      if (!text) return;
      state.update((s) => ({
        ...s,
        busy: "route",
        error: "",
        result: null,
        source: text,
      }));
      return owner.run(
        (signal) => personal.api.route(text, signal),
        (result) =>
          state.update((s) => ({ ...s, busy: "", result, selected: 0 })),
        failure,
      );
    },
    select(selected: number) {
      const s = get(state);
      if (
        owner.active() &&
        s.result &&
        !s.busy &&
        selected >= 0 &&
        selected < destinations(s.result).length
      )
        state.update((v) => ({ ...v, selected }));
    },
    cancel() {
      if (!owner.active() || get(state).busy === "send") return;
      owner.cancel();
      state.update((s) => ({ ...s, busy: "", result: null, error: "" }));
    },
    send() {
      const s = get(state),
        text = get(personal.draft).ask.trim(),
        { files, poll } = s;
      if (
        !owner.active() ||
        s.busy ||
        !s.result ||
        subject(text, poll) !== s.source
      )
        return;
      const destination = destinations(s.result)[s.selected];
      if (!destination) return;
      if (
        destination.book_id &&
        !get(personal.state).me?.books.some(
          (room) => room.id === destination.book_id,
        )
      ) {
        failure(Error("unavailable"));
        return;
      }
      state.update((value) => ({ ...value, busy: "send", error: "" }));
      return owner.run(
        async (signal) => {
          if (!destination.book_id) {
            const created = await personal.api.startRoom(
              subject(text, poll),
              signal,
            );
            const id = roomId(created.id);
            // The new room starts from the text; the files and the poll go in right after, in its main thread.
            if (files.length || poll) {
              const key = JSON.stringify([
                id,
                "main",
                files.map((f) => f.id),
                poll,
              ]);
              const posted = await personal.api.post(
                id,
                "",
                "main",
                sends.take(key),
                {
                  files: await uploadAll(id, files, signal),
                  poll: poll ?? undefined,
                },
              );
              if (!posted.ok) throw Error(posted.error);
              sends.done(key);
            }
            return { id, unknown: created.unknown, thread: undefined };
          }
          const key = JSON.stringify([
            destination.book_id,
            destination.epic_id ?? "main",
            text,
            files.map((f) => f.id),
            poll,
          ]);
          const ids = await uploadAll(destination.book_id, files, signal);
          const posted = await personal.api.post(
            destination.book_id,
            text,
            destination.epic_id ?? "main",
            sends.take(key),
            { routed: true, files: ids, poll: poll ?? undefined },
          );
          if (!posted.ok) throw Error(posted.error);
          sends.done(key);
          return {
            id: roomId(destination.book_id),
            unknown: [],
            thread: posted.thread === "main" ? undefined : posted.thread,
          };
        },
        (result) => {
          if (get(personal.draft).ask.trim() === text) personal.editAsk("");
          uploaded.clear();
          state.update((v) => ({
            ...v,
            files: v.files.filter(
              (f) => !files.some((sent) => sent.id === f.id),
            ),
            poll: v.poll === poll ? null : v.poll,
          }));
          if (result.unknown.length) personal.notice(result.id, result.unknown);
          navigate({ roomId: result.id, thread: result.thread });
        },
        failure,
      );
    },
    dispose() {
      owner.dispose();
    },
  };
}
export type NewRoomBinding = {
  account: string;
  revision: number;
  generation: number;
};
export function createNewRoomSession(
  personal: PersonalSession,
  navigate: (target: RoomTarget) => void,
  clock: AuthClock = authClock,
) {
  const state = writable({
    open: false,
    inline: false,
    binding: null as NewRoomBinding | null,
    busy: false,
    error: "",
  });
  let owner = createAuthOwner(clock),
    active = true,
    generation = 0,
    identityRevision = get(personal.state).identityRevision;
  const owns = (binding: NewRoomBinding) =>
    active &&
    owner.active() &&
    get(state).open &&
    get(state).binding === binding &&
    get(personal.state).identityRevision === binding.revision &&
    personal.peek()?.email === binding.account;
  const stopIdentity = personal.state.subscribe((value) => {
    if (value.identityRevision === identityRevision) return;
    identityRevision = value.identityRevision;
    generation++;
    owner.dispose();
    state.set({
      open: false,
      inline: false,
      binding: null,
      busy: false,
      error: "",
    });
  });
  function activate(inline: boolean) {
    if (!active) return null;
    const me = personal.peek();
    if (!me) return null;
    owner.dispose();
    owner = createAuthOwner(clock);
    const binding = {
      account: me.email,
      revision: get(personal.state).identityRevision,
      generation: ++generation,
    };
    state.set({ open: true, inline, binding, busy: false, error: "" });
    return binding;
  }
  return {
    state,
    owns,
    open() {
      if (get(state).open && !get(state).inline) return;
      activate(false);
    },
    openInline() {
      const value = get(state);
      if (value.open) return value.inline ? value.binding : null;
      return activate(true);
    },
    edit(text: string, expected?: NewRoomBinding) {
      const binding = get(state).binding;
      if (binding && owns(binding) && (!expected || expected === binding))
        personal.editCreate(text);
    },
    close(expected?: NewRoomBinding) {
      if (expected && get(state).binding !== expected) return;
      owner.dispose();
      state.update((value) => ({
        ...value,
        binding: null,
        inline: false,
        open: false,
        busy: false,
      }));
    },
    submit(expected?: NewRoomBinding) {
      const binding = get(state).binding;
      if (
        !binding ||
        !owns(binding) ||
        get(state).busy ||
        (expected && expected !== binding)
      )
        return;
      const text = get(personal.draft).create.trim();
      if (!text) {
        state.update((value) => ({ ...value, error: "empty" }));
        return;
      }
      state.update((value) => ({ ...value, busy: true, error: "" }));
      return owner.run(
        (signal) => personal.api.startRoom(text, signal),
        (created) => {
          if (!owns(binding)) return;
          const id = roomId(created.id);
          if (get(personal.draft).create.trim() === text)
            personal.editCreate("");
          if (created.unknown.length) personal.notice(id, created.unknown);
          state.set({
            open: false,
            inline: false,
            binding: null,
            busy: false,
            error: "",
          });
          navigate({ roomId: id });
        },
        (error) => {
          if (owns(binding))
            state.update((value) => ({
              ...value,
              busy: false,
              error: issue(error),
            }));
        },
      );
    },
    dispose() {
      stopIdentity();
      active = false;
      generation++;
      owner.dispose();
    },
  };
}
export function createArchivedSession(
  personal: PersonalSession,
  clock: AuthClock = authClock,
) {
  const state = writable({
    books: [] as ArchivedResult["books"],
    loaded: false,
    loading: false,
    pending: null as string | null,
    error: "",
  });
  const reader = createAuthOwner(clock),
    writer = createAuthOwner(clock);
  let active = true,
    sequence = 0,
    timers: unknown[] = [];
  const cancelTimers = () => {
    for (const handle of timers) clock.cancel(handle);
    timers = [];
  };
  const identityRevision = get(personal.state).identityRevision;
  const stopIdentity = personal.state.subscribe((value) => {
    if (!active || value.identityRevision === identityRevision) return;
    active = false;
    sequence++;
    cancelTimers();
    reader.dispose();
    writer.dispose();
    state.set({
      books: [],
      loaded: false,
      loading: false,
      pending: null,
      error: "",
    });
  });
  const failure = (error: unknown) =>
    state.update((s) => ({ ...s, loading: false, error: issue(error) }));
  function accept(result: ArchivedResult) {
    const pending = get(state).pending,
      complete = !!pending && !result.books.some((room) => room.id === pending);
    if (complete) {
      sequence++;
      cancelTimers();
      writer.cancel();
    }
    state.update((s) => ({
      ...s,
      books: result.books,
      loaded: true,
      loading: false,
      ...(complete ? { pending: null, error: "" } : {}),
    }));
  }
  async function load() {
    if (!active) return;
    reader.cancel();
    state.update((s) => ({ ...s, loading: true, error: "" }));
    return reader.run(
      (signal) => personal.api.archived(signal),
      accept,
      failure,
    );
  }
  return {
    state,
    load,
    restore(id: string) {
      if (
        !active ||
        get(state).pending ||
        !get(state).books.some((room) => room.id === id)
      )
        return;
      const ticket = ++sequence;
      cancelTimers();
      state.update((s) => ({ ...s, pending: id, error: "" }));
      return writer.run(
        (signal) => personal.api.archive(id, false, signal),
        () => {
          void personal.refresh();
          const check = async () => {
            if (!active || ticket !== sequence) return;
            reader.cancel();
            await reader.run(
              (signal) => personal.api.archived(signal),
              (result) => {
                if (!active || ticket !== sequence) return;
                accept(result);
              },
              () => {},
            );
          };
          void check();
          for (const ms of [1000, 3000, 6000])
            timers.push(
              clock.schedule(() => {
                void check();
              }, ms),
            );
          timers.push(
            clock.schedule(() => {
              if (active && ticket === sequence && get(state).pending === id) {
                cancelTimers();
                state.update((s) => ({
                  ...s,
                  pending: null,
                  error: "unconfirmed",
                }));
              }
            }, 10_000),
          );
        },
        (error) =>
          state.update((s) => ({ ...s, pending: null, error: issue(error) })),
      );
    },
    dispose() {
      stopIdentity();
      active = false;
      sequence++;
      cancelTimers();
      reader.dispose();
      writer.dispose();
    },
  };
}
export type HomeSession = ReturnType<typeof createHomeSession>;
export type NewRoomSession = ReturnType<typeof createNewRoomSession>;
export type ArchivedSession = ReturnType<typeof createArchivedSession>;
