import {
  MESSAGE_TEXT_LIMIT,
  MESSAGE_FILE_LIMIT,
  POLL_QUESTION_LIMIT,
  POLL_OPTION_LIMIT,
  POLL_MIN_OPTIONS,
  POLL_MAX_OPTIONS,
} from "../../../shared/composition";
import { visibleMessage } from "../chat/privacy";
import { get, writable, type Writable } from "svelte/store";
import type { Room, Message, Attachment, Poll } from "../../../shared/room";
import type { CommandOutcome } from "../../../shared/commands";
import type { RequestRoomCommand } from "../../app/roomConnection";
import type { ComposerScope, ComposerUpload } from "./types";
import {
  mediaType,
  fileIssue,
  matchingMessage,
  maxMessageId,
  normalizeFile,
  payloadKey,
  type MessageSnapshot,
  type PendingAttachment,
} from "./model";
export type ComposerPhase = "idle" | "pending" | "error" | "unconfirmed";
export type PollDraft = {
  question: string;
  options: string[];
  multi: boolean;
  revision: number;
};
export type ComposerState = {
  text: string;
  replyId?: number;
  attachments: PendingAttachment[];
  revision: number;
  phase: ComposerPhase;
  error: string;
  candidate?: number;
  notice: string;
  poll: PollDraft;
  pollPhase: ComposerPhase;
  pollError: string;
  pollCandidate?: string;
};
const blankPoll = (): PollDraft => ({
  question: "",
  options: ["", "", ""],
  multi: false,
  revision: 0,
});
const blank = (): ComposerState => ({
  text: "",
  attachments: [],
  revision: 0,
  phase: "idle",
  error: "",
  notice: "",
  poll: blankPoll(),
  pollPhase: "idle",
  pollError: "",
});
export type OrphanDraft = Readonly<{
  scope: ComposerScope;
  state: ComposerState;
}>;
export type ComposerClock = {
  schedule(fn: () => void, ms: number): unknown;
  cancel(handle: unknown): void;
};
const defaultClock: ComposerClock = {
  schedule: (fn, ms) => setTimeout(fn, ms),
  cancel: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};
export const COMPOSER_CONFIRMATION_TIMEOUT = 10_000;
export const MAX_COMPOSER_DRAFTS = 64;
// These msg Refused paths all precede addMessage; other errors may follow a durable write.
/** The draft still holds what was sent (the same text, reply and files), even if its revision moved. */
const sameDraft = (s: ComposerState, sent: MessageSnapshot) =>
  payloadKey({
    text: s.text.trim(),
    replyId: s.replyId,
    fileIds: s.attachments.flatMap((item) => (item.meta ? [item.meta.id] : [])),
  }) === payloadKey(sent);
export const definiteMessageFailure = (error: string) =>
  error === "offline" ||
  error === "invalid command" ||
  error === "empty message" ||
  error === "unknown thread" ||
  // The room refused this client_id for another text: nothing was stored. A resend gets a new id.
  error === "idempotency conflict" ||
  error.startsWith("blocked:");
type MessageOperation = {
  token: symbol;
  snapshot: MessageSnapshot;
  ack: boolean;
  timer?: unknown;
  /** What the box held when it was sent (it empties at once): put back if the send fails or you keep it. */
  restore: Pick<ComposerState, "text" | "replyId" | "attachments">;
};
type PollOperation = {
  token: symbol;
  form: PollDraft;
  baseline: Set<string>;
  baselineMessage: number;
  ack: boolean;
  timer?: unknown;
};
export interface ComposerEntry {
  scope: ComposerScope;
  state: Writable<ComposerState>;
  available(): boolean;
  sync(room: Room, request: RequestRoomCommand, upload: ComposerUpload): void;
  edit(text: string): void;
  reply(message: Message, text?: string): void;
  clearReply(): void;
  focus(): void;
  attachFocus(callback: () => void): () => void;
  addFiles(files: readonly File[]): void;
  removeFile(id: number): void;
  retryUpload(id: number): void;
  item(id: number): PendingAttachment | undefined;
  uploading(id: number, controller: AbortController): void;
  uploaded(id: number, meta: Attachment): void;
  uploadError(id: number, error: string): void;
  submit(): Promise<void>;
  review(keep: boolean): void;
  editPoll(patch: Partial<Omit<PollDraft, "revision">>): void;
  createPoll(): Promise<void>;
  reviewPoll(): void;
  dispose(): void;
}
/** Account-owned in-memory drafts. A component attaches only a focus callback; it does not own canonical room data. */
export function createComposerDrafts(clock = defaultClock) {
  let active = true,
    epoch = 0,
    nextAttachment = 0,
    uploads = 0;
  const entries = new Map<string, ComposerEntry>();
  const changes = writable(0);
  const subscriptions = new Map<string, () => void>();
  const changed = () => changes.update((value) => value + 1);
  const orphaned = (scope: ComposerScope, room: Room) =>
    scope.account === room.me &&
    scope.roomId === room.id &&
    scope.thread !== "main" &&
    !room.epics.some((epic) => epic.id === scope.thread);
  const uploadQueue: {
    entry: ComposerEntry;
    id: number;
    upload: ComposerUpload;
    epoch: number;
  }[] = [];
  const controllers = new Set<AbortController>();
  const key = (scope: ComposerScope) =>
    JSON.stringify([scope.account, scope.roomId, scope.thread]);
  function pump() {
    while (active && uploads < 2 && uploadQueue.length) {
      const job = uploadQueue.shift()!;
      if (job.epoch !== epoch) continue;
      const item = job.entry.item(job.id);
      if (!item?.file || item.phase !== "queued") continue;
      uploads++;
      const controller = new AbortController();
      controllers.add(controller);
      job.entry.uploading(job.id, controller);
      let deadline: unknown;
      let abort: () => void = () => {};
      const response = new Promise<Awaited<ReturnType<ComposerUpload>>>(
        (resolve, reject) => {
          abort = () => {
            if (deadline !== undefined) clock.cancel(deadline);
            reject(new Error("cancelled"));
          };
          controller.signal.addEventListener("abort", abort, { once: true });
          deadline = clock.schedule(() => {
            if (active && job.epoch === epoch)
              job.entry.uploadError(job.id, "timeout");
            controller.abort();
          }, 20_000);
          try {
            job
              .upload(
                { name: item.name, type: item.type, body: item.file! },
                controller.signal,
              )
              .then(resolve, reject);
          } catch (error) {
            reject(error);
          }
        },
      );
      response
        .then((meta) => {
          if (active && job.epoch === epoch && !controller.signal.aborted)
            job.entry.uploaded(job.id, meta);
        })
        .catch((error) => {
          if (active && job.epoch === epoch && !controller.signal.aborted)
            job.entry.uploadError(
              job.id,
              error instanceof Error ? error.message : "failed",
            );
        })
        .finally(() => {
          if (deadline !== undefined) clock.cancel(deadline);
          controller.signal.removeEventListener("abort", abort);
          controllers.delete(controller);
          if (job.epoch === epoch) uploads--;
          if (active) pump();
        });
    }
  }
  function makeEntry(
    inputScope: ComposerScope,
    storageAvailable = true,
  ): ComposerEntry {
    const scope = Object.freeze({ ...inputScope });
    const state = writable<ComposerState>(
      storageAvailable ? blank() : { ...blank(), error: "draft-limit" },
    );
    let alive = true,
      room: Room | undefined,
      request: RequestRoomCommand | undefined,
      upload: ComposerUpload | undefined,
      focus: (() => void) | undefined,
      focusToken: symbol | undefined;
    let operation: MessageOperation | undefined,
      pollOperation: PollOperation | undefined;
    // The unconfirmed send the person kept (review(true)): sending the same draft again reuses its client_id, so the
    // room answers with that message if it got there (docs/architecture.md, "One send, one message").
    let kept: MessageSnapshot | undefined;
    const uploadOwners = new Map<number, AbortController>();
    const valid = () =>
      storageAvailable &&
      alive &&
      active &&
      room?.id === scope.roomId &&
      room.me === scope.account &&
      room.members.includes(scope.account) &&
      (scope.thread === "main" ||
        room.epics.some((epic) => epic.id === scope.thread));
    const cancel = (op: { timer?: unknown } | undefined) => {
      if (op?.timer !== undefined) clock.cancel(op.timer);
    };
    const ownMessage = (op: MessageOperation) =>
      alive && active && operation?.token === op.token;
    const ownPoll = (op: PollOperation) =>
      alive && active && pollOperation?.token === op.token;
    function settleMessage() {
      const op = operation;
      if (!op || !room) return;
      const candidate = matchingMessage(room, scope.thread, op.snapshot);
      state.update((s) =>
        s.candidate === candidate?.id ? s : { ...s, candidate: candidate?.id },
      );
      if (!op.ack || !candidate) return;
      cancel(op);
      operation = undefined;
      state.update((s) =>
        s.revision === op.snapshot.revision || sameDraft(s, op.snapshot)
          ? {
              ...s,
              text: "",
              replyId: undefined,
              attachments: s.attachments.filter(
                (item) => item.phase === "error",
              ),
              revision: s.revision + 1,
              phase: "idle",
              error: "",
              candidate: undefined,
              notice: "sent",
            }
          : {
              ...s,
              phase: "idle",
              error: "",
              candidate: undefined,
              notice: "sent-edited",
            },
      );
    }
    function pollCandidate(op: PollOperation): Poll | undefined {
      return Object.values(room?.polls || {}).find(
        (poll) =>
          !op.baseline.has(poll.id) &&
          poll.author === scope.account &&
          poll.question === op.form.question &&
          poll.multi === op.form.multi &&
          JSON.stringify(poll.options) === JSON.stringify(op.form.options) &&
          room!.messages.some(
            (message) =>
              message.id > op.baselineMessage &&
              message.thread === scope.thread &&
              message.author === scope.account &&
              message.kind !== "agent" &&
              message.poll === poll.id,
          ),
      );
    }
    function settlePoll() {
      const op = pollOperation;
      if (!op || !room) return;
      const candidate = pollCandidate(op);
      state.update((s) =>
        s.pollCandidate === candidate?.id
          ? s
          : { ...s, pollCandidate: candidate?.id },
      );
      if (!op.ack || !candidate) return;
      cancel(op);
      pollOperation = undefined;
      state.update((s) => ({
        ...s,
        poll: s.poll.revision === op.form.revision ? blankPoll() : s.poll,
        pollPhase: "idle",
        pollError: "",
        pollCandidate: undefined,
        notice: "poll-created",
      }));
    }
    /** The sent text, reply and files back in the box, unless you already typed something new there. */
    function putBack(s: ComposerState, op: MessageOperation): ComposerState {
      if (s.revision !== op.snapshot.revision || s.text.trim()) return s;
      return {
        ...s,
        text: op.restore.text,
        replyId: op.restore.replyId,
        attachments: [
          ...op.restore.attachments,
          ...s.attachments.filter(
            (item) => !op.restore.attachments.some((a) => a.id === item.id),
          ),
        ],
        revision: s.revision + 1,
      };
    }
    function uncertain(op: MessageOperation, error: string) {
      if (ownMessage(op)) {
        cancel(op);
        op.timer = undefined;
        // Not sure it arrived: the text is back in the box, with the question whether it went (review).
        state.update((s) => ({
          ...putBack(s, op),
          phase: "unconfirmed",
          error,
        }));
      }
    }
    function uncertainPoll(op: PollOperation, error: string) {
      if (ownPoll(op)) {
        cancel(op);
        op.timer = undefined;
        state.update((s) => ({
          ...s,
          pollPhase: "unconfirmed",
          pollError: error,
        }));
      }
    }
    const entry: ComposerEntry = {
      scope,
      state,
      available: () => storageAvailable && alive && active,
      sync(
        next: Room,
        nextRequest: RequestRoomCommand,
        nextUpload: ComposerUpload,
      ) {
        if (!alive || !active) return;
        if (next.id !== scope.roomId || next.me !== scope.account) {
          room = undefined;
          request = undefined;
          upload = undefined;
          return;
        }
        room = next;
        request = nextRequest;
        upload = nextUpload;
        settleMessage();
        settlePoll();
      },
      edit(text: string) {
        if (!storageAvailable || !alive || !active) return;
        // A phone keyboard can fire an input event with the same text after Enter (autocorrect commits the last
        // word). That is not an edit: a new revision here kept the sent text in the box, and people sent it again.
        if (get(state).text === text) return;
        state.update((s) => ({
          ...s,
          text,
          revision: s.revision + 1,
          notice: "",
        }));
      },
      reply(message: Message, text?: string) {
        if (!valid() || message.thread !== scope.thread) return;
        const canonical = [...room!.messages, ...(room!.origins || [])].find(
          (m) => m.id === message.id,
        );
        if (
          !canonical ||
          canonical.thread !== scope.thread ||
          !visibleMessage(room!, canonical)
        )
          return;
        state.update((s) => ({
          ...s,
          text: text === undefined ? s.text : text,
          replyId: canonical.id,
          revision: s.revision + 1,
          notice: "",
        }));
        focus?.();
      },
      clearReply() {
        if (alive && active)
          state.update((s) => ({
            ...s,
            replyId: undefined,
            revision: s.revision + 1,
          }));
      },
      focus() {
        if (valid()) focus?.();
      },
      attachFocus(callback: () => void) {
        const token = Symbol();
        focusToken = token;
        focus = callback;
        return () => {
          if (focusToken === token) {
            focus = undefined;
            focusToken = undefined;
            room = undefined;
            request = undefined;
            upload = undefined;
          }
        };
      },
      addFiles(files: readonly File[]) {
        if (!valid() || !upload) return;
        for (const input of files) {
          const current = get(state);
          if (current.attachments.length >= MESSAGE_FILE_LIMIT) {
            state.update((s) => ({ ...s, error: "attachments-limit" }));
            break;
          }
          const file = normalizeFile(input),
            issue = fileIssue(file);
          if (issue) {
            state.update((s) => ({
              ...s,
              error: `file-${issue}: ${file.name}`,
            }));
            continue;
          }
          const item: PendingAttachment = {
            id: ++nextAttachment,
            name: file.name,
            type: mediaType(file.type),
            size: file.size,
            file,
            phase: "queued",
          };
          state.update((s) => ({
            ...s,
            attachments: [...s.attachments, item],
            revision: s.revision + 1,
            error: "",
          }));
          uploadQueue.push({ entry, id: item.id, upload, epoch });
        }
        pump();
      },
      removeFile(id: number) {
        if (!alive || !active) return;
        uploadOwners.get(id)?.abort();
        uploadOwners.delete(id);
        state.update((s) => ({
          ...s,
          attachments: s.attachments.filter((item) => item.id !== id),
          revision: s.revision + 1,
        }));
      },
      retryUpload(id: number) {
        if (!valid() || !upload) return;
        const item = get(state).attachments.find((item) => item.id === id);
        if (!item?.file || item.phase !== "error") return;
        state.update((s) => ({
          ...s,
          attachments: s.attachments.map((item) =>
            item.id === id
              ? { ...item, phase: "queued", error: undefined }
              : item,
          ),
        }));
        uploadQueue.push({ entry, id, upload, epoch });
        pump();
      },
      item(id: number) {
        return alive
          ? get(state).attachments.find((item) => item.id === id)
          : undefined;
      },
      uploading(id: number, controller: AbortController) {
        if (!alive) return;
        uploadOwners.set(id, controller);
        state.update((s) => ({
          ...s,
          attachments: s.attachments.map((item) =>
            item.id === id ? { ...item, phase: "uploading" } : item,
          ),
        }));
      },
      uploaded(id: number, meta: Attachment) {
        if (!alive || !uploadOwners.has(id)) return;
        if (meta.author !== scope.account) {
          entry.uploadError(id, "account-changed");
          return;
        }
        uploadOwners.delete(id);
        state.update((s) => ({
          ...s,
          attachments: s.attachments.map((item) =>
            item.id === id
              ? {
                  ...item,
                  file: undefined,
                  meta,
                  phase: "ready",
                  error: undefined,
                }
              : item,
          ),
        }));
      },
      uploadError(id: number, error: string) {
        if (!alive || !uploadOwners.has(id)) return;
        uploadOwners.delete(id);
        state.update((s) => ({
          ...s,
          attachments: s.attachments.map((item) =>
            item.id === id ? { ...item, phase: "error", error } : item,
          ),
        }));
      },
      async submit() {
        if (!valid() || !request || operation) return;
        const draft = get(state),
          text = draft.text.trim();
        if (
          draft.attachments.some(
            (item) => item.phase === "queued" || item.phase === "uploading",
          )
        ) {
          state.update((s) => ({ ...s, error: "attachments-pending" }));
          return;
        }
        if (text.length > MESSAGE_TEXT_LIMIT) {
          state.update((s) => ({ ...s, error: "text-limit" }));
          return;
        }
        const fileIds = draft.attachments.flatMap((item) =>
          item.meta ? [item.meta.id] : [],
        );
        if (!text && !fileIds.length) return;
        const reply = draft.replyId
          ? [...room!.messages, ...(room!.origins || [])].find(
              (m) =>
                m.id === draft.replyId &&
                m.thread === scope.thread &&
                visibleMessage(room!, m),
            )
          : undefined;
        if (draft.replyId && !reply) {
          state.update((s) => ({ ...s, error: "reply-missing" }));
          return;
        }
        const payload = { text, fileIds, replyId: reply?.id };
        const op: MessageOperation = {
          token: Symbol(),
          restore: {
            text: draft.text,
            replyId: draft.replyId,
            attachments: draft.attachments,
          },
          snapshot: {
            ...payload,
            baseline: maxMessageId(room!),
            // The box empties as the message leaves (the next revision): a message you send looks sent right away,
            // even when the room takes a moment to confirm it (Valls #4167).
            revision: draft.revision + 1,
            clientId:
              kept?.clientId && payloadKey(kept) === payloadKey(payload)
                ? kept.clientId
                : crypto.randomUUID(),
          },
          ack: false,
        };
        operation = op;
        kept = undefined;
        state.update((s) => ({
          ...s,
          text: "",
          replyId: undefined,
          attachments: s.attachments.filter((item) => item.phase === "error"),
          revision: s.revision + 1,
          phase: "pending",
          error: "",
          candidate: undefined,
          notice: "",
        }));
        try {
          const result = await request({
            t: "msg",
            thread: scope.thread,
            text,
            files: fileIds,
            reply_to: reply?.id,
            client_id: op.snapshot.clientId,
          });
          if (!ownMessage(op)) return;
          if (!result.ok) {
            if (definiteMessageFailure(result.error)) {
              operation = undefined;
              state.update((s) => ({
                ...putBack(s, op),
                phase: "error",
                error: result.error,
              }));
            } else uncertain(op, result.error);
            return;
          }
          op.ack = true;
          settleMessage();
          if (ownMessage(op))
            op.timer = clock.schedule(
              () => uncertain(op, "unconfirmed"),
              COMPOSER_CONFIRMATION_TIMEOUT,
            );
        } catch (error) {
          if (!ownMessage(op)) return;
          if (
            error instanceof TypeError &&
            error.message === "Invalid room command"
          ) {
            operation = undefined;
            state.update((s) => ({
              ...putBack(s, op),
              phase: "error",
              error: error.message,
            }));
          } else
            uncertain(op, error instanceof Error ? error.message : "failed");
        }
      },
      review(keep: boolean) {
        if (!alive || !operation || get(state).phase !== "unconfirmed") return;
        const snapshot = operation.snapshot,
          restoreOf = operation;
        cancel(operation);
        operation = undefined;
        // Kept: a resend of it is the same send. Discarded: the same text typed later is a new message.
        kept = keep ? snapshot : undefined;
        state.update((s) =>
          !keep && s.revision === snapshot.revision
            ? {
                ...s,
                text: "",
                replyId: undefined,
                attachments: s.attachments.filter(
                  (item) => item.phase === "error",
                ),
                revision: s.revision + 1,
                phase: "idle",
                error: "",
                candidate: undefined,
                notice: "reviewed-discarded",
              }
            : {
                ...(keep ? putBack(s, restoreOf) : s),
                phase: "idle",
                error: "",
                candidate: undefined,
                notice: "reviewed-kept",
              },
        );
      },
      editPoll(patch: Partial<Omit<PollDraft, "revision">>) {
        if (!storageAvailable || !alive || !active) return;
        state.update((s) => ({
          ...s,
          poll: { ...s.poll, ...patch, revision: s.poll.revision + 1 },
          notice: "",
        }));
      },
      async createPoll() {
        if (!valid() || !request || pollOperation) return;
        const raw = get(state).poll,
          form = {
            ...raw,
            question: raw.question.trim(),
            options: raw.options.map((value) => value.trim()).filter(Boolean),
          };
        if (
          !form.question ||
          form.question.length > POLL_QUESTION_LIMIT ||
          form.options.length < POLL_MIN_OPTIONS ||
          form.options.length > POLL_MAX_OPTIONS ||
          form.options.some((value) => value.length > POLL_OPTION_LIMIT)
        ) {
          state.update((s) => ({ ...s, pollError: "poll-invalid" }));
          return;
        }
        const op: PollOperation = {
          token: Symbol(),
          form,
          baseline: new Set(Object.keys(room!.polls || {})),
          baselineMessage: maxMessageId(room!),
          ack: false,
        };
        pollOperation = op;
        state.update((s) => ({
          ...s,
          pollPhase: "pending",
          pollError: "",
          pollCandidate: undefined,
          notice: "",
        }));
        try {
          const result: CommandOutcome = await request({
            t: "poll.create",
            thread: scope.thread,
            question: form.question,
            options: form.options,
            multi: form.multi,
          });
          if (!ownPoll(op)) return;
          if (!result.ok) {
            if (
              result.error === "offline" ||
              result.error === "invalid command"
            ) {
              pollOperation = undefined;
              state.update((s) => ({
                ...s,
                pollPhase: "error",
                pollError: result.error,
              }));
            } else uncertainPoll(op, result.error);
            return;
          }
          op.ack = true;
          settlePoll();
          if (ownPoll(op))
            op.timer = clock.schedule(
              () => uncertainPoll(op, "unconfirmed"),
              COMPOSER_CONFIRMATION_TIMEOUT,
            );
        } catch (error) {
          uncertainPoll(op, error instanceof Error ? error.message : "failed");
        }
      },
      reviewPoll() {
        if (!alive || !pollOperation || get(state).pollPhase !== "unconfirmed")
          return;
        cancel(pollOperation);
        pollOperation = undefined;
        state.update((s) => ({
          ...s,
          pollPhase: "idle",
          pollError: "",
          pollCandidate: undefined,
          notice: "reviewed",
        }));
      },
      dispose() {
        alive = false;
        cancel(operation);
        cancel(pollOperation);
        operation = undefined;
        pollOperation = undefined;
        kept = undefined;
        for (const controller of uploadOwners.values()) controller.abort();
        uploadOwners.clear();
        focus = undefined;
        room = undefined;
        request = undefined;
        upload = undefined;
        state.set(blank());
      },
    };
    return entry;
  }
  return {
    changes: { subscribe: changes.subscribe },
    orphans(room: Room): OrphanDraft[] {
      return [...entries.values()]
        .filter((entry) => {
          const s = get(entry.state);
          return (
            orphaned(entry.scope, room) &&
            !!(
              s.text ||
              s.replyId ||
              s.attachments.length ||
              s.poll.question ||
              s.poll.multi ||
              s.poll.options.some(Boolean)
            )
          );
        })
        .map((entry) => ({ scope: entry.scope, state: get(entry.state) }));
    },
    discardOrphan(snapshot: OrphanDraft, room: Room): boolean {
      const id = key(snapshot.scope);
      const entry = entries.get(id);
      if (
        !active ||
        !entry ||
        !orphaned(snapshot.scope, room) ||
        get(entry.state) !== snapshot.state
      )
        return false;
      subscriptions.get(id)?.();
      subscriptions.delete(id);
      entries.delete(id);
      entry.dispose();
      changed();
      return true;
    },
    entry(scope: ComposerScope) {
      const id = key(scope);
      let entry = entries.get(id);
      if (!entry) {
        if (entries.size >= MAX_COMPOSER_DRAFTS) {
          const empty = [...entries.values()].find((candidate) => {
            const s = get(candidate.state);
            return (
              !s.text &&
              !s.replyId &&
              !s.attachments.length &&
              (s.phase === "idle" || s.phase === "error") &&
              !s.poll.question &&
              !s.poll.options.some((value) => value) &&
              !s.poll.multi &&
              (s.pollPhase === "idle" || s.pollPhase === "error")
            );
          });
          if (empty) {
            subscriptions.get(key(empty.scope))?.();
            subscriptions.delete(key(empty.scope));
            empty.dispose();
            entries.delete(key(empty.scope));
          } else return makeEntry(scope, false);
        }
        entry = makeEntry(scope);
        entries.set(id, entry);
        subscriptions.set(id, entry.state.subscribe(changed));
      }
      return entry;
    },
    reset() {
      epoch++;
      uploads = 0;
      for (const unsubscribe of subscriptions.values()) unsubscribe();
      subscriptions.clear();
      for (const entry of entries.values()) entry.dispose();
      entries.clear();
      uploadQueue.length = 0;
      for (const controller of controllers) controller.abort();
      controllers.clear();
      changed();
    },
    dispose() {
      active = false;
      this.reset();
    },
  };
}
export type ComposerDrafts = ReturnType<typeof createComposerDrafts>;
