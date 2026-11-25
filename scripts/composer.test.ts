import { expect, test } from "bun:test";
import { get } from "svelte/store";
import {
  createComposerDrafts,
  definiteMessageFailure,
  type ComposerClock,
} from "../web/features/composer/drafts";
import { MAX_STORED, storageDrafts } from "../web/features/composer/draftStore";
import {
  mediaType,
  normalizeFile,
  fileIssue,
  mentionPicks,
  roomPicks,
  roomReference,
  knownMention,
  mentionSpans,
  mentionSegments,
  mentionKey,
  emojiTyped,
  emojiPicks,
  insertAt,
  matchingMessage,
} from "../web/features/composer/model";
import {
  createSpeechController,
  type SpeechRecognizer,
} from "../web/features/composer/speech";
import {
  privateAskForOther,
  permissionReply,
  visibleChatMessages,
} from "../web/features/chat/privacy";
import type { Message, Room, Attachment } from "../shared/room";
import type { RoomCommand, CommandOutcome } from "../shared/commands";
import type { UploadFileResult } from "../shared/schemas";
const message = (
  id: number,
  text: string,
  patch: Partial<Message> = {},
): Message => ({
  id,
  thread: "main",
  author: "me@test",
  kind: null,
  text,
  ts: id,
  ...patch,
});
const room = (): Room => ({
  id: "abc123",
  me: "me@test",
  book: { title: "Room", owner: "me@test" },
  members: ["me@test", "you@test"],
  names: { "you@test": "José Silva" },
  online: [],
  typing: {},
  messages: [message(10, "before")],
  epics: [{ id: "epic", title: "Epic", tasks: [] }],
  suggestions: [],
  polls: {},
});
const meta = (id = "aa11"): Attachment => ({
  id,
  name: "report.txt",
  type: "text/plain",
  size: 4,
  author: "me@test",
  ts: 1,
});
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function clock() {
  let next = 0;
  const jobs = new Map<number, () => void>();
  const api: ComposerClock = {
    schedule: (fn) => {
      jobs.set(++next, fn);
      return next;
    },
    cancel: (ticket) => {
      jobs.delete(ticket as number);
    },
  };
  return {
    api,
    jobs,
    fire() {
      const pending = [...jobs.values()];
      jobs.clear();
      for (const job of pending) job();
    },
  };
}
function harness() {
  const timer = clock(),
    drafts = createComposerDrafts(timer.api),
    scope = { account: "me@test", roomId: "abc123", thread: "main" },
    entry = drafts.entry(scope),
    commands: RoomCommand[] = [],
    reply = deferred<CommandOutcome>();
  const request = (command: RoomCommand) => {
    commands.push(command);
    return reply.promise;
  };
  const upload = async () => meta();
  entry.sync(room(), request, upload);
  return { timer, drafts, scope, entry, commands, reply, request, upload };
}
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};
test("file extension/MIME aliases and screenshot names preserve supported upload behavior", async () => {
  for (const [name, type, expected] of [
    ["report.html", "", "text/html"],
    ["report.md", "", "text/markdown"],
    ["report.md", "text/plain", "text/plain"],
    ["data.csv", "application/vnd.ms-excel", "text/csv"],
    ["note.txt", "application/octet-stream", "text/plain"],
    ["audio.m4a", "application/octet-stream", "audio/x-m4a"],
    ["audio.mp3", "audio/mpeg", "audio/mpeg"],
  ])
    expect(
      mediaType(normalizeFile(new File(["test"], name, { type }), 0).type),
    ).toBe(expected);
  const screenshot = normalizeFile(
    new File(["x"], "image.png", { type: "image/png" }),
    0,
  );
  expect(screenshot.name).toBe("print-1970-01-01-00-00.png");
  expect(screenshot.type).toBe("image/png");
  expect(await screenshot.text()).toBe("x");
  expect(fileIssue(new File([], "empty.txt", { type: "text/plain" }))).toBe(
    "empty",
  );
  expect(
    fileIssue(new File(["x"], "bad.exe", { type: "application/octet-stream" })),
  ).toBe("type");
  const large = new File(["x"], "large.txt", { type: "text/plain" });
  Object.defineProperty(large, "size", { value: 10 * 1024 * 1024 + 1 });
  expect(fileIssue(large)).toBe("size");
});
test("mention aliases exclude self, include own sandbox, match labels and cap eight; emoji insertion respects selection", () => {
  const r = room();
  expect(mentionPicks("@Jo", 3, r)?.items[0]).toMatchObject({
    email: "you@test",
    handle: "jose",
  });
  expect(mentionPicks("x@Jo", 4, r)).toBeNull();
  expect(
    mentionPicks("@", 1, r, {}, [
      { email: r.me, name: "sandbox" },
      { email: "you@test", name: "foreign" },
    ])?.items.map((item) => item.handle),
  ).toEqual(["jose", "sandbox", "room"]);
  expect(mentionPicks("@ro", 3, r)?.items.map((item) => item.handle)).toEqual([
    "room",
  ]);
  expect(emojiPicks(":thumbsup:").some((item) => item.emoji === "👍")).toBe(
    true,
  );
  expect(insertAt("hello world", 6, 11, "🔥")).toEqual({
    text: "hello 🔥",
    caret: 8,
  });
});
test("a typed :shortcode suggests emoji after two letters, prefix matches first, not once closed", () => {
  expect(emojiTyped("oi :f", 5)).toBeNull();
  const fire = emojiTyped("oi :fi", 6);
  expect(fire?.start).toBe(3);
  expect(fire?.items[0]).toEqual({ emoji: "🔥", name: "fire" });
  expect(fire!.items.length).toBeLessThanOrEqual(8);
  // One row per emoji even when two names share it (thumbsup / +1).
  const thumbs = emojiTyped(":thumbs", 7)!.items.map((item) => item.emoji);
  expect(new Set(thumbs).size).toBe(thumbs.length);
  expect(emojiTyped("10:30", 5)).toBeNull();
  expect(emojiTyped("oi :fire:", 9)).toBeNull();
  expect(emojiTyped("oi :zzzzqq", 10)).toBeNull();
  expect(emojiTyped("(:ROCK", 6)?.items[0].emoji).toBe("🚀");
});
test("known mentions in a draft are spans, segments and one unit for Backspace, Delete and arrows", () => {
  const r = room(),
    known = (handle: string) => knownMention(handle, r);
  expect(["jose", "José", "you", "vibe", "room", "todos"].map(known)).toEqual([
    true,
    true,
    true,
    true,
    true,
    true,
  ]);
  expect(known("nobody")).toBe(false);
  const text = "oi @jose e @nobody (@vibe) x@jose";
  expect(mentionSpans(text, known)).toEqual([
    [3, 8],
    [20, 25],
  ]);
  expect(
    mentionSegments(text, known)
      .filter((part) => part.mention)
      .map((part) => part.text),
  ).toEqual(["@jose", "@vibe"]);
  expect(mentionSegments("plain", known)).toEqual([
    { text: "plain", mention: false },
  ]);
  // Backspace right after a mention selects all of it; typed by hand it stays letter by letter.
  expect(mentionKey(text, 8, "Backspace", known)).toEqual({ select: [3, 8] });
  expect(mentionKey(text, 8, "Backspace", known, true)).toBeNull();
  expect(mentionKey(text, 3, "Delete", known)).toEqual({ select: [3, 8] });
  expect(mentionKey(text, 8, "ArrowLeft", known)).toEqual({ move: 3 });
  expect(mentionKey(text, 3, "ArrowRight", known)).toEqual({ move: 8 });
  expect(mentionKey(text, 9, "Backspace", known)).toBeNull();
  expect(mentionKey(text, 5, "Backspace", known)).toBeNull();
  expect(mentionKey(text, 8, "Enter", known)).toBeNull();
});
test("account room/thread draft scopes stay separate and reset invalidates old owners", () => {
  const h = harness();
  h.entry.edit("keep main");
  const next = h.drafts.entry({ ...h.scope, thread: "epic" });
  next.edit("keep epic");
  expect(get(h.entry.state).text).toBe("keep main");
  expect(get(next.state).text).toBe("keep epic");
  const other = h.drafts.entry({ ...h.scope, account: "you@test" });
  expect(get(other.state).text).toBe("");
  h.drafts.reset();
  h.entry.edit("late");
  expect(get(h.entry.state).text).toBe("");
  expect(get(h.drafts.entry(h.scope).state).text).toBe("");
});
test("the box empties as a message is sent; ACK and the exact new canonical row settle it", async () => {
  const h = harness();
  h.entry.edit("post me");
  const pending = h.entry.submit();
  h.reply.resolve({ ok: true });
  await pending;
  expect(get(h.entry.state).phase).toBe("pending");
  expect(get(h.entry.state).text).toBe("");
  h.entry.sync(
    {
      ...room(),
      messages: [
        message(10, "post me"),
        message(11, "post me", { author: "you@test" }),
        message(12, "post me", { thread: "epic" }),
      ],
    },
    h.request,
    h.upload,
  );
  expect(get(h.entry.state).phase).toBe("pending");
  h.entry.sync(
    { ...room(), messages: [message(13, "post me")] },
    h.request,
    h.upload,
  );
  expect(get(h.entry.state).text).toBe("");
  expect(get(h.entry.state).phase).toBe("idle");
  expect(h.timer.jobs.size).toBe(0);
  expect(h.commands).toHaveLength(1);
});
test("canonical-before-ACK settles only after ACK and keeps edits made while sending", async () => {
  const h = harness();
  h.entry.edit("submitted");
  const pending = h.entry.submit();
  h.entry.sync(
    { ...room(), messages: [message(11, "submitted")] },
    h.request,
    h.upload,
  );
  expect(get(h.entry.state).text).toBe("");
  h.entry.edit("next draft");
  h.reply.resolve({ ok: true });
  await pending;
  expect(get(h.entry.state).text).toBe("next draft");
  expect(get(h.entry.state).notice).toBe("sent-edited");
});
test("an input event with the same text while sending (phone autocorrect) still clears the sent draft", async () => {
  for (const after of ["melhor dia", "melhor dia "]) {
    const h = harness();
    h.entry.edit("melhor dia");
    const pending = h.entry.submit();
    h.entry.edit(after);
    h.reply.resolve({ ok: true });
    await pending;
    h.entry.sync(
      { ...room(), messages: [message(11, "melhor dia")] },
      h.request,
      h.upload,
    );
    expect(get(h.entry.state).text).toBe("");
    expect(get(h.entry.state).notice).toBe("sent");
    expect(h.commands).toHaveLength(1);
    h.drafts.dispose();
  }
});
test("same-text row after lost ACK remains ambiguous and cannot auto-clear or auto-resend", async () => {
  for (const error of ["timeout", "disconnected", "server error"]) {
    const h = harness();
    h.entry.edit("same text");
    const pending = h.entry.submit();
    h.entry.sync(
      { ...room(), messages: [message(11, "same text")] },
      h.request,
      h.upload,
    );
    h.reply.resolve({ ok: false, error });
    await pending;
    expect(get(h.entry.state).phase).toBe("unconfirmed");
    expect(get(h.entry.state).text).toBe("same text");
    expect(get(h.entry.state).candidate).toBe(11);
    await h.entry.submit();
    expect(h.commands).toHaveLength(1);
    h.entry.review(true);
    expect(get(h.entry.state).text).toBe("same text");
    expect(get(h.entry.state).phase).toBe("idle");
    h.drafts.dispose();
  }
});
test("definite prewrite failures retain editable draft; post-ACK wait is bounded", async () => {
  for (const reason of [
    "offline",
    "invalid command",
    "empty message",
    "unknown thread",
    "blocked: secret",
  ]) {
    expect(definiteMessageFailure(reason)).toBe(true);
    const h = harness();
    h.entry.edit("retain");
    const pending = h.entry.submit();
    h.reply.resolve({ ok: false, error: reason });
    await pending;
    expect(get(h.entry.state).phase).toBe("error");
    expect(get(h.entry.state).text).toBe("retain");
  }
  const h = harness();
  h.entry.edit("wait");
  const pending = h.entry.submit();
  h.reply.resolve({ ok: true });
  await pending;
  h.timer.fire();
  expect(get(h.entry.state).phase).toBe("unconfirmed");
  expect(h.commands).toHaveLength(1);
  expect(get(h.entry.state).text).toBe("wait");
  h.drafts.dispose();
});
test("exact file/reply snapshots reject unrelated canonical messages", () => {
  const r = room(),
    snapshot = {
      text: "with file",
      fileIds: ["aa11"],
      replyId: 10,
      baseline: 10,
      revision: 1,
    };
  for (const patch of [
    { files: [meta("bb22")], reply_to: 10 },
    { files: [meta()], reply_to: 9 },
    { files: [meta()], reply_to: 10, kind: "agent" },
  ])
    expect(
      matchingMessage(
        { ...r, messages: [message(11, "with file", patch)] },
        "main",
        snapshot,
      ),
    ).toBeUndefined();
  expect(
    matchingMessage(
      {
        ...r,
        messages: [message(11, "with file", { files: [meta()], reply_to: 10 })],
      },
      "main",
      snapshot,
    )?.id,
  ).toBe(11);
});
test("removed and account-reset uploads abort and late HTTP responses never populate another draft", async () => {
  const h = harness(),
    uploads: {
      signal: AbortSignal;
      reply: ReturnType<typeof deferred<UploadFileResult>>;
    }[] = [];
  h.entry.sync(room(), h.request, (_input, signal) => {
    const reply = deferred<UploadFileResult>();
    uploads.push({ signal, reply });
    return reply.promise;
  });
  h.entry.addFiles([
    new File(["x"], "one.txt", { type: "text/plain" }),
    new File(["x"], "two.txt", { type: "text/plain" }),
    new File(["x"], "three.txt", { type: "text/plain" }),
  ]);
  expect(uploads).toHaveLength(2);
  const first = get(h.entry.state).attachments[0].id;
  h.entry.removeFile(first);
  expect(uploads[0].signal.aborted).toBe(true);
  uploads[0].reply.resolve(meta());
  await flush();
  expect(get(h.entry.state).attachments.some((item) => item.id === first)).toBe(
    false,
  );
  h.drafts.reset();
  for (const job of uploads) job.reply.resolve(meta());
  await flush();
  expect(get(h.entry.state).attachments).toHaveLength(0);
  expect(get(h.drafts.entry(h.scope).state).attachments).toHaveLength(0);
});
test("component-only detach releases stale request/focus without losing text draft", async () => {
  const h = harness();
  let focused = 0;
  const detach = h.entry.attachFocus(() => focused++);
  h.entry.edit("preserve");
  detach();
  h.entry.focus();
  await h.entry.submit();
  expect(focused).toBe(0);
  expect(h.commands).toHaveLength(0);
  expect(get(h.entry.state).text).toBe("preserve");
  h.entry.sync(room(), h.request, h.upload);
  const detachNext = h.entry.attachFocus(() => focused++);
  h.entry.focus();
  expect(focused).toBe(1);
  detachNext();
});
test("poll create retains form until ACK plus new canonical poll, and uncertain form is not resubmitted", async () => {
  const h = harness();
  h.entry.editPoll({
    question: "Question",
    options: [" A ", "B", ""],
    multi: true,
  });
  const pending = h.entry.createPoll();
  h.reply.resolve({ ok: true });
  await pending;
  expect(get(h.entry.state).poll.question).toBe("Question");
  expect(h.commands[0]).toEqual({
    t: "poll.create",
    thread: "main",
    question: "Question",
    options: ["A", "B"],
    multi: true,
  });
  h.entry.sync(
    {
      ...room(),
      messages: [message(11, "", { poll: "p" })],
      polls: {
        p: {
          id: "p",
          question: "Question",
          options: ["A", "B"],
          author: "me@test",
          multi: true,
          closed: false,
          votes: [[], []],
        },
      },
    },
    h.request,
    h.upload,
  );
  expect(get(h.entry.state).poll.question).toBe("");
  const other = harness();
  other.entry.editPoll({ question: "Question", options: ["A", "B"] });
  const unknown = other.entry.createPoll();
  other.reply.resolve({ ok: false, error: "disconnected" });
  await unknown;
  await other.entry.createPoll();
  expect(other.commands).toHaveLength(1);
  expect(get(other.entry.state).poll.question).toBe("Question");
});
test("private asks and permission answers retain exact legacy visibility without mutating room state", () => {
  const own = message(1, "⏸ Seu Claude pede permissão", {
      kind: "agent",
      choices: '{"options":["Aprovar","Negar"]}',
    }),
    foreign = { ...own, id: 2, author: "you@test" },
    answer = message(3, "Aprovar", { reply_to: 1 }),
    foreignReply = message(4, "ok", { reply_to: 2 }),
    ordinary = message(5, "normal");
  const r = {
    ...room(),
    messages: [own, foreign, answer, foreignReply, ordinary],
  };
  expect(privateAskForOther(r, foreign)).toBe(true);
  expect(permissionReply(r, answer)).toBe(true);
  expect(visibleChatMessages(r, "main").map((m) => m.id)).toEqual([1, 5]);
  expect(r.messages).toHaveLength(5);
});

test("partial sandbox metadata cannot throw or insert null handles", () => {
  const picks = mentionPicks("@sa", 3, room(), {}, [
    { email: "me@test", name: null },
    { email: "me@test", name: "" },
    { email: "me@test", name: "sandbox" },
  ]);
  expect(picks?.items.map((item) => item.handle)).toEqual(["sandbox", "room"]);
});

test("origin-only private parents hide replies and invalidate selected reply without losing text", async () => {
  const h = harness(),
    q = message(20, "ordinary", { kind: "agent", author: "you@test" });
  h.entry.sync({ ...room(), messages: [q] }, h.request, h.upload);
  h.entry.edit("retain reply");
  h.entry.reply(q);
  const secret = { ...q, text: "❓ Seu Claude asks privately" };
  h.entry.sync(
    { ...room(), messages: [], origins: [secret] },
    h.request,
    h.upload,
  );
  await h.entry.submit();
  expect(h.commands).toHaveLength(0);
  expect(get(h.entry.state).text).toBe("retain reply");
  expect(get(h.entry.state).error).toBe("reply-missing");
  const child = message(21, "answer", { reply_to: 20 });
  expect(
    visibleChatMessages(
      { ...room(), messages: [child], origins: [secret] },
      "main",
    ),
  ).toHaveLength(0);
});

test("speech hold/tap and fast typing preserve the selection without implicit sending", () => {
  const timer = clock();
  let value = "before selected after",
    start = 7,
    end = 15,
    revision = 0,
    recording = false,
    starts = 0;
  const rec: SpeechRecognizer = {
    lang: "",
    continuous: false,
    interimResults: false,
    onresult: null,
    onerror: null,
    onend: null,
    start() {
      starts++;
    },
    stop() {
      this.onend?.({});
    },
    abort() {},
  };
  const speech = createSpeechController({
    factory: () => rec,
    locale: "en-US",
    clock: timer.api,
    read: () => ({ text: value, start, end, revision }),
    write: (text, at) => {
      value = text;
      revision++;
      start = end = at ?? text.length;
    },
    canStart: () => true,
    recording: (on) => (recording = on),
    error: () => {},
    ended: () => {},
  });
  let prevented = 0;
  speech.keydown({ key: " ", preventDefault: () => prevented++ });
  speech.keyup({ key: " " });
  expect(value).toBe("before   after");
  expect(starts).toBe(0);
  speech.keydown({ key: " ", preventDefault: () => prevented++ });
  speech.keydown({ key: "x", preventDefault: () => {} });
  expect(value).toBe("before    after");
  speech.keyup({ key: " " });
  expect(starts).toBe(0);
  speech.keydown({ key: " ", preventDefault: () => prevented++ });
  timer.fire();
  expect(recording).toBe(true);
  expect(rec.lang).toBe("en-US");
  rec.onresult?.({ results: [[{ transcript: "spoken" }]] });
  expect(value).toBe("before    after spoken");
  speech.keyup({ key: " " });
  expect(recording).toBe(false);
  expect(prevented).toBe(3);
  speech.dispose();
});
test("speech modifiers/IME do not hijack Space and stopped owners ignore stale results", () => {
  const timer = clock();
  let text = "draft",
    revision = 0,
    active = true,
    recording = false,
    error = "",
    aborts = 0;
  const rec: SpeechRecognizer = {
    lang: "",
    continuous: false,
    interimResults: false,
    onresult: null,
    onerror: null,
    onend: null,
    start() {},
    stop() {},
    abort() {
      aborts++;
    },
  };
  const speech = createSpeechController({
    factory: () => rec,
    locale: "pt-BR",
    clock: timer.api,
    read: () => ({ text, revision, start: text.length, end: text.length }),
    write: (value) => {
      text = value;
      revision++;
    },
    canStart: () => active,
    recording: (on) => (recording = on),
    error: (message) => (error = message),
    ended: () => {},
  });
  let prevented = 0;
  for (const flags of [
    { ctrlKey: true },
    { metaKey: true },
    { altKey: true },
    { isComposing: true },
  ])
    expect(
      speech.keydown({ key: " ", ...flags, preventDefault: () => prevented++ }),
    ).toBe(false);
  expect(prevented).toBe(0);
  speech.start();
  const late = rec.onresult;
  speech.cancel();
  late?.({ results: [[{ transcript: "late" }]] });
  expect(text).toBe("draft");
  expect(recording).toBe(false);
  speech.start();
  rec.onerror?.({ error: "not-allowed" });
  expect(error).toBe("not-allowed");
  expect(recording).toBe(false);
  speech.start();
  text = "edited independently";
  revision++;
  rec.onresult?.({ results: [[{ transcript: "overwrite" }]] });
  expect(text).toBe("edited independently");
  expect(recording).toBe(false);
  speech.start();
  active = false;
  rec.onresult?.({ results: [[{ transcript: "wrong room" }]] });
  expect(text).toBe("edited independently");
  expect(aborts).toBeGreaterThan(1);
  speech.dispose();
});
test("unsupported speech capability leaves ordinary keyboard behavior intact", () => {
  let prevented = false;
  const speech = createSpeechController({
    locale: "pt-BR",
    read: () => ({ text: "", start: 0, end: 0, revision: 0 }),
    write: () => {},
    canStart: () => true,
    recording: () => {},
    error: () => {},
    ended: () => {},
  });
  expect(speech.supported).toBe(false);
  expect(
    speech.keydown({ key: " ", preventDefault: () => (prevented = true) }),
  ).toBe(false);
  expect(prevented).toBe(false);
  speech.dispose();
});

test("deleted-thread drafts remain reviewable only in their original account/room and discard requires an unchanged snapshot", () => {
  const bag = createComposerDrafts();
  const r = room();
  const scope = { account: r.me, roomId: r.id, thread: "epic" };
  const entry = bag.entry(scope);
  entry.edit("Keep original content");
  expect(bag.orphans(r)).toEqual([]);
  const removed = { ...r, epics: [] };
  const [snapshot] = bag.orphans(removed);
  expect(snapshot?.state.text).toBe("Keep original content");
  expect(bag.orphans({ ...removed, me: "other@test" })).toEqual([]);
  expect(bag.orphans({ ...removed, id: "other-room" })).toEqual([]);
  if (!snapshot) throw new Error("missing draft");
  expect(bag.discardOrphan(snapshot, r)).toBe(false);
  entry.edit("Independent edit");
  expect(bag.discardOrphan(snapshot, removed)).toBe(false);
  const fresh = bag.orphans(removed)[0];
  if (!fresh) throw new Error("missing updated draft");
  expect(bag.discardOrphan(fresh, removed)).toBe(true);
  expect(bag.orphans(removed)).toEqual([]);
  expect(bag.entry(scope)).not.toBe(entry);
  bag.reset();
  expect(bag.orphans(removed)).toEqual([]);
  bag.dispose();
});
test("each send carries a client_id; a resend of the unchanged draft reuses it, an edited draft gets a new one", async () => {
  const timer = clock(),
    drafts = createComposerDrafts(timer.api),
    entry = drafts.entry({
      account: "me@test",
      roomId: "abc123",
      thread: "main",
    }),
    sent: Extract<RoomCommand, { t: "msg" }>[] = [],
    replies: ReturnType<typeof deferred<CommandOutcome>>[] = [];
  const request = (command: RoomCommand) => {
    if (command.t === "msg") sent.push(command);
    const reply = deferred<CommandOutcome>();
    replies.push(reply);
    return reply.promise;
  };
  const upload = async () => meta();
  entry.sync(room(), request, upload);
  const unconfirmed = async () => {
    const pending = entry.submit();
    replies.at(-1)?.resolve({ ok: false, error: "timeout" });
    await pending;
    expect(get(entry.state).phase).toBe("unconfirmed");
    entry.review(true);
  };
  entry.edit("oi");
  await unconfirmed();
  expect(sent[0].client_id).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
  // Sent again without a change: the same id, so the room answers with the first message if it got there.
  await unconfirmed();
  expect(sent[1].client_id).toBe(sent[0].client_id);
  // A changed draft is another message.
  entry.edit("oi!");
  await unconfirmed();
  expect(sent[2].client_id).not.toBe(sent[0].client_id);
  // The room had the first "oi!" (older than this send's baseline): its client_id settles this resend.
  const pending = entry.submit();
  expect(sent[3].client_id).toBe(sent[2].client_id);
  replies.at(-1)?.resolve({ ok: true });
  await pending;
  entry.sync(
    {
      ...room(),
      messages: [message(10, "oi!", { client_id: sent[2].client_id })],
    },
    request,
    upload,
  );
  expect(get(entry.state).text).toBe("");
  expect(get(entry.state).notice).toBe("sent");
  // After a send that is in the room, the same text again is a new message.
  entry.edit("oi!");
  void entry.submit();
  expect(sent[4].client_id).not.toBe(sent[2].client_id);
  drafts.dispose();
});
test("a resend refused as an idempotency conflict is a definite failure, and the next send gets a new id", async () => {
  expect(definiteMessageFailure("idempotency conflict")).toBe(true);
  const timer = clock(),
    drafts = createComposerDrafts(timer.api),
    entry = drafts.entry({
      account: "me@test",
      roomId: "abc123",
      thread: "main",
    }),
    sent: Extract<RoomCommand, { t: "msg" }>[] = [],
    outcomes: CommandOutcome[] = [
      { ok: false, error: "timeout" },
      { ok: false, error: "idempotency conflict" },
      { ok: false, error: "timeout" },
    ];
  const request = async (command: RoomCommand) => {
    if (command.t === "msg") sent.push(command);
    return outcomes.shift() ?? { ok: true };
  };
  entry.sync(room(), request, async () => meta());
  entry.edit("oi");
  await entry.submit();
  entry.review(true);
  await entry.submit();
  expect(sent[1].client_id).toBe(sent[0].client_id);
  expect(get(entry.state).phase).toBe("error");
  expect(get(entry.state).text).toBe("oi");
  await entry.submit();
  expect(sent[2].client_id).not.toBe(sent[0].client_id);
  drafts.dispose();
});
test("a discarded unconfirmed draft does not lend its client_id to the same text typed again", async () => {
  const h = harness();
  h.entry.edit("de novo");
  const pending = h.entry.submit();
  h.reply.resolve({ ok: false, error: "timeout" });
  await pending;
  h.entry.review(false);
  h.entry.edit("de novo");
  await h.entry.submit();
  const ids = h.commands.map((c) => (c.t === "msg" ? c.client_id : ""));
  expect(ids).toHaveLength(2);
  expect(ids[1]).not.toBe(ids[0]);
  h.drafts.dispose();
});
test("matching by client_id: another tab's row with the same text is not this send", () => {
  const r = room(),
    snapshot = {
      text: "ok",
      fileIds: [],
      baseline: 10,
      revision: 1,
      clientId: "mine-1234",
    };
  expect(
    matchingMessage(
      { ...r, messages: [message(11, "ok", { client_id: "other-1234" })] },
      "main",
      snapshot,
    ),
  ).toBeUndefined();
  expect(
    matchingMessage(
      { ...r, messages: [message(9, "ok", { client_id: "mine-1234" })] },
      "main",
      snapshot,
    )?.id,
  ).toBe(9);
  // A row without a client_id (an older server) still matches by content.
  expect(
    matchingMessage({ ...r, messages: [message(11, "ok")] }, "main", snapshot)
      ?.id,
  ).toBe(11);
});

/** A Storage over a Map, as the browser's localStorage (the drafts' store). */
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  };
}

test("a draft's text and reply come back from storage after the drafts are gone (leave, reload), and a cleared draft leaves storage (Gimenes #4172)", () => {
  const storage = memoryStorage();
  const r = room();
  const scope = { account: r.me, roomId: r.id, thread: "main" };
  const first = createComposerDrafts(undefined, storageDrafts(storage));
  first.entry(scope).edit("half a thought");
  first.entry(scope).state.update((s) => ({ ...s, replyId: 7 }));
  first.dispose();
  // A new page: a new drafts bag reads the same storage.
  const again = createComposerDrafts(undefined, storageDrafts(storage));
  const state = get(again.entry(scope).state);
  expect(state.text).toBe("half a thought");
  expect(state.replyId).toBe(7);
  // Another account or thread does not get it.
  expect(get(again.entry({ ...scope, account: "other@test" }).state).text).toBe(
    "",
  );
  expect(get(again.entry({ ...scope, thread: "epic" }).state).text).toBe("");
  again
    .entry(scope)
    .state.update((s) => ({ ...s, text: "", replyId: undefined }));
  expect(storage.length).toBe(0);
});

test("an app's quotes are chips: sent before the typed text, put back on a failure, kept in storage", async () => {
  const h = harness();
  const quote = {
    label: "«o medo mais comum»",
    text: "Revisão · Post · §3\n> «o medo mais comum»",
  };
  h.entry.quote(quote);
  h.entry.quote(quote);
  h.entry.quote({ label: "«outro»", text: "> «outro»" });
  h.entry.removeQuote(1);
  expect(get(h.entry.state).quotes).toEqual([quote]);
  h.entry.edit("  trocaria por outra frase ");
  const failing = h.entry.submit();
  expect(get(h.entry.state).quotes).toEqual([]);
  h.reply.resolve({ ok: false, error: "offline" });
  await failing;
  expect(get(h.entry.state).quotes).toEqual([quote]);
  expect(get(h.entry.state).text).toBe("  trocaria por outra frase ");
  expect(h.commands[0]).toMatchObject({
    t: "msg",
    text: "Revisão · Post · §3\n> «o medo mais comum»\n\ntrocaria por outra frase",
  });
  // A quote alone is a message too.
  const alone = harness();
  alone.entry.quote(quote);
  const sent = alone.entry.submit();
  alone.reply.resolve({ ok: true });
  await sent;
  expect(alone.commands[0]).toMatchObject({ text: quote.text });
  alone.entry.sync(
    { ...room(), messages: [message(11, quote.text)] },
    alone.request,
    alone.upload,
  );
  expect(get(alone.entry.state).notice).toBe("sent");
  expect(get(alone.entry.state).quotes).toEqual([]);
  const storage = memoryStorage();
  const r = room();
  const scope = { account: r.me, roomId: r.id, thread: "main" };
  const first = createComposerDrafts(undefined, storageDrafts(storage));
  first.entry(scope).quote(quote);
  first.dispose();
  const again = createComposerDrafts(undefined, storageDrafts(storage));
  expect(get(again.entry(scope).state).quotes).toEqual([quote]);
  again.entry(scope).removeQuote(0);
  expect(storage.length).toBe(0);
  const store = storageDrafts(storage);
  storage.setItem(
    "vb:draft:bad",
    JSON.stringify({ text: "x", quotes: [quote, { label: 1 }, null, "no"] }),
  );
  expect(store.read("bad")?.quotes).toEqual([quote]);
  h.drafts.dispose();
  alone.drafts.dispose();
  again.dispose();
});
test("the drafts' storage keeps the newest MAX_STORED drafts and survives a storage that throws", () => {
  const storage = memoryStorage();
  let clock = 0;
  const store = storageDrafts(storage, () => ++clock);
  for (let i = 0; i < MAX_STORED + 3; i++)
    store.write(`k${i}`, { text: `t${i}` });
  expect(storage.length).toBe(MAX_STORED);
  expect(store.read("k0")).toBeUndefined();
  expect(store.read(`k${MAX_STORED + 2}`)?.text).toBe(`t${MAX_STORED + 2}`);
  const blocked = () => {
    throw new Error("blocked");
  };
  const broken = {
    get length(): number {
      return blocked();
    },
    key: blocked,
    getItem: blocked,
    setItem: blocked,
    removeItem: blocked,
    clear() {},
  } as unknown as Storage;
  const safe = storageDrafts(broken);
  expect(() => safe.write("k", { text: "x" })).not.toThrow();
  expect(safe.read("k")).toBeUndefined();
  expect(() => safe.remove("k")).not.toThrow();
});

test("# picks rooms (folded, capped) then open threads of this room, and writes their plain link", () => {
  const room = {
    id: "abcdef12",
    book: { title: "Sala", owner: "me@test" },
    epics: [
      { id: "e1", title: "Ágil", tasks: [] },
      { id: "e2", title: "Fechada", tasks: [], done: true },
    ],
  };
  const rooms = [
    { id: "abcdef12", title: "Sala", icon: 0 },
    { id: "zzzzzz99", title: "Projeto Ágil", icon: 3 },
  ];
  const origin = "https://chat.decocms.com";
  expect(roomPicks("a#ag", 4, rooms, room, origin)).toBeNull();
  expect(roomPicks("# x", 3, rooms, room, origin)).toBeNull();
  const picks = roomPicks("veja #ag", 8, rooms, room, origin)!;
  expect(picks.start).toBe(5);
  expect(picks.items.map((item) => item.url)).toEqual([
    `${origin}/b/zzzzzz99`,
    `${origin}/b/abcdef12?t=e1`,
  ]);
  expect(roomReference(picks.items[1]!)).toBe(`${origin}/b/abcdef12?t=e1`);
  expect(roomPicks("#", 1, rooms, room, origin)?.items).toHaveLength(3);
  expect(roomPicks("#nada", 5, rooms, room, origin)).toBeNull();
});
