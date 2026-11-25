import "server-only";
// Voice calls with screen share, on the Cloudflare Realtime SFU. The room is the channel: one call per room.
// The browser never talks to the SFU's API (it needs the app secret): these functions do, for a member whose
// session the room knows (Book.callCheck). The Book keeps who is in the call and which tracks each one publishes.
import * as z from "zod/mini";
import type { Env } from "./index";
import { bookStub, storeFile } from "./rooms";
import { findSecret } from "./secrets";
import { transcriptMarkdown, transcriptName } from "./callText";
import { CallSfuResult, type CallDescription, type CallTracksBody, type RecordedBody } from "../shared/schemas";
import { CALL_SCREEN_LIMIT_GB, EGRESS_QUERY, GB, egressFrom, monthDays, overScreenLimit, recordsRoom, usageMonth } from "./callBudget";
import { hmac, safeEqual } from "./auth";

/** Calls are off until the SFU app (var) and its secret exist. */
export const callsOn = (env: Env) => !!(env.REALTIME_SFU_APP_ID && env.REALTIME_SFU_APP_SECRET);

/** The SFU's answer was not ok. `status` 404 on a session's path: the SFU no longer has that session. */
class SfuError extends Error {
  readonly status: number;
  constructor(status: number, step: string) {
    super(`sfu ${step} ${status}`);
    this.status = status;
  }
}
/** A session the SFU no longer has is out of the room's call: nobody can receive it, and the person who has it is
 *  shown in the call for nothing (a hang-up that never reached the room left a phone on "1", 2026-11-25). */
async function dropGoneSession<T>(env: Env, bookId: string, email: string, session: string, step: Promise<T>): Promise<T> {
  try {
    return await step;
  } catch (error) {
    if (error instanceof SfuError && error.status === 404) await bookStub(env, bookId).callLeave(email, session);
    throw error;
  }
}

async function sfu(env: Env, method: "POST" | "PUT", path: string, body?: unknown): Promise<unknown> {
  const res = await fetch(`https://rtc.live.cloudflare.com/v1/apps/${env.REALTIME_SFU_APP_ID}${path}`, {
    method,
    headers: { authorization: `Bearer ${env.REALTIME_SFU_APP_SECRET}`, "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!res.ok) {
    console.error("sfu", path.split("/").at(-1), res.status, (await res.text()).slice(0, 300));
    throw new SfuError(res.status, path.split("/").at(-1) ?? "");
  }
  return res.json();
}

// ---- the month's screen-share budget ----
// The SFU bills egress ($0.05 per GB) after 1,000 GB a month, for the account (TURN and other SFU apps count).
// Two counts: Cloudflare's analytics API has the real number (accountEgress), and each browser in a call reports
// the bytes it received (the `call.usage` command), which D1 sums for the month.
/** One report covers about 30 seconds: more than this is not a real number. */
const REPORT_MAX = 2 * GB;
export async function addCallUsage(env: Env, bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return;
  await env.DB.prepare(`INSERT INTO call_usage (month, bytes) VALUES (?, ?) ON CONFLICT(month) DO UPDATE SET bytes = bytes + excluded.bytes`).bind(usageMonth(), Math.min(Math.round(bytes), REPORT_MAX)).run();
}
/** The account's real egress this month, read at most each 10 minutes. null: no token, or the API did not answer. */
let egress: { at: number; month: string; bytes: number } | undefined;
async function accountEgress(env: Env): Promise<number | null> {
  if (!env.CF_ANALYTICS_TOKEN || !env.CF_ACCOUNT_ID) return null;
  if (egress && egress.month === usageMonth() && Date.now() - egress.at < 600_000) return egress.bytes;
  const [from, to] = monthDays();
  const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST",
    headers: { authorization: `Bearer ${env.CF_ANALYTICS_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ query: EGRESS_QUERY, variables: { account: env.CF_ACCOUNT_ID, from, to } }),
  });
  const bytes = res.ok ? egressFrom(await res.json()) : null;
  if (bytes === null) return null;
  egress = { at: Date.now(), month: usageMonth(), bytes };
  return bytes;
}
/** The larger of the two counts decides: Cloudflare's real number (the bill), and what the browsers reported
 *  (it is there at once, and it stays when the API does not answer). */
async function screenAllowed(env: Env) {
  const [real, row] = await Promise.all([
    accountEgress(env).catch(() => null),
    env.DB.prepare(`SELECT bytes FROM call_usage WHERE month = ?`).bind(usageMonth()).first<{ bytes: number }>(),
  ]);
  return !overScreenLimit(Math.max(real ?? 0, row?.bytes ?? 0), Number(env.CALL_SCREEN_LIMIT_GB) || CALL_SCREEN_LIMIT_GB);
}

// ---- what a member in the call may ask the SFU ----
/** The screen track's name: the one track the month's budget can refuse. */
export const SCREEN_TRACK = "screen";

/** A new SFU session (one RTCPeerConnection) for this person, entered in the room's call.
 *  `record`: with this join the call has two people and no recorder, so the recorder is asked to come (startRecorder). */
export async function callJoin(env: Env, bookId: string, email: string, origin: string) {
  const session = z.object({ sessionId: z.string() }).parse(await sfu(env, "POST", "/sessions/new")).sessionId;
  const record = await bookStub(env, bookId).callJoin(bookId, email, session, origin);
  return { session, record };
}

// ---- the recorder (recorder/): a Worker with a container that joins the call and sends it to Grain ----
const LINK_MS = 5 * 60_000;
const linkSig = (env: Env, room: string, exp: number) => hmac(env.SESSION_SECRET, `call-recorder|${room}|${exp}`);
/** The link that signs the recorder in to this one room. Short-lived; only the recorder Worker gets it. */
export async function recorderLink(env: Env, origin: string, room: string, now = Date.now()) {
  const exp = now + LINK_MS;
  return `${origin}/api/calls/recorder/enter?room=${room}&exp=${exp}&sig=${await linkSig(env, room, exp)}`;
}
export async function recorderLinkValid(env: Env, room: string, exp: number, sig: string, now = Date.now()) {
  return /^[a-z0-9]{6,40}$/.test(room) && Number.isFinite(exp) && exp > now && exp <= now + LINK_MS && safeEqual(sig, await linkSig(env, room, exp));
}
/** Asks the recorder to join this room's call. No recorder set up, or a room that is not recorded: nothing.
 *  `attempt`: 0 for the start of a call, more when the recorder left a call that goes on (Book.callLeave).
 *  A recorder that does not start: the call goes on, and the room is told that it is not recorded. */
export async function startRecorder(env: Env, origin: string, bookId: string, attempt = 0) {
  if (!recorderOn(env, bookId)) return;
  const res = await fetch(`${(env.RECORDER_URL ?? "").replace(/\/+$/, "")}/start`, {
    method: "POST",
    headers: { authorization: `Bearer ${env.RECORDER_SECRET}`, "content-type": "application/json" },
    // The title says where the call was: the room (Book.callTitle; the call is the room's, not a thread's).
    body: JSON.stringify({ room: bookId, attempt, title: await bookStub(env, bookId).callTitle(bookId), joinUrl: await recorderLink(env, origin, bookId) }),
  }).catch(() => null);
  if (res?.ok) return;
  console.error("call recorder did not start", bookId, res?.status ?? "no answer");
  await bookStub(env, bookId).callRecordFailed(bookId, "start");
}
/** Is this room's call recorded? The recorder is set up and the room is listed. */
export const recorderOn = (env: Env, bookId: string) => !!env.RECORDER_URL && !!env.RECORDER_SECRET && recordsRoom(env.CALL_RECORD_ROOMS, bookId);

/** The recorder's word on a call (POST /api/calls/recorded): it is in Grain, or it failed. With a transcript, the
 *  room keeps it as a file (the agents read it) and gets a summary. Answers the emails of the people who were in
 *  the call: the recorder shares the recording in Grain with each of them. */
export async function callRecorded(env: Env, d: RecordedBody): Promise<string[]> {
  const book = bookStub(env, d.room);
  if (!d.url) {
    await book.callRecordFailed(d.room, d.error ?? "");
    return [];
  }
  const lines = d.transcript ?? [];
  const text = lines.length ? transcriptMarkdown(`Call · ${await book.callTitle(d.room)} · ${new Date().toISOString().slice(0, 10)}`, lines) : "";
  // What was said aloud goes through the same secret filter as what is typed: with a secret in it, the room
  // gets the link and nothing of the text.
  const clean = text && !findSecret(text) ? text : "";
  const file = clean ? await storeFile(env, d.room, "ai", "text/markdown", new TextEncoder().encode(clean).buffer as ArrayBuffer, transcriptName()).catch(() => null) : null;
  await book.callRecorded(d.room, { url: d.url, minutes: d.minutes ?? 0, people: d.people ?? [], transcript: clean, withheld: !!text && !clean, file });
  return book.callPeople();
}

/** Publish this person's tracks (push) and receive tracks of others in the same call (pull). */
export async function callTracks(env: Env, bookId: string, email: string, req: CallTracksBody): Promise<CallSfuResult | "forbidden" | "limit"> {
  const book = bookStub(env, bookId), push = req.push ?? [], pull = req.pull ?? [];
  if (!(await book.callCheck(email, req.session, pull.map((p) => p.session)))) return "forbidden";
  if (push.some((p) => p.name === SCREEN_TRACK) && !(await screenAllowed(env))) return "limit";
  const out = CallSfuResult.parse(
    await dropGoneSession(env, bookId, email, req.session, sfu(env, "POST", `/sessions/${req.session}/tracks/new`, {
      ...(req.offer ? { sessionDescription: req.offer } : {}),
      tracks: [...push.map((p) => ({ location: "local", mid: p.mid, trackName: p.name })), ...pull.map((p) => ({ location: "remote", sessionId: p.session, trackName: p.name }))],
    })),
  );
  if (push.length) await book.callTracks(email, push.map((p) => p.name), []);
  return out;
}

/** The browser's answer to an offer the SFU made (a pull asks for it: requiresImmediateRenegotiation). */
export async function callAnswer(env: Env, bookId: string, email: string, session: string, answer: CallDescription) {
  if (!(await bookStub(env, bookId).callCheck(email, session, []))) return false;
  await dropGoneSession(env, bookId, email, session, sfu(env, "PUT", `/sessions/${session}/renegotiate`, { sessionDescription: answer }));
  return true;
}

/** Stop tracks by mid. `names` are the ones this person published and no longer does (the screen). */
export async function callClose(env: Env, bookId: string, email: string, session: string, mids: string[], names: string[]) {
  const book = bookStub(env, bookId);
  if (!(await book.callCheck(email, session, []))) return false;
  if (names.length) await book.callTracks(email, [], names);
  // force: no new SDP exchange. The browser stops its own transceivers.
  if (mids.length) await sfu(env, "PUT", `/sessions/${session}/tracks/close`, { tracks: mids.map((mid) => ({ mid })), force: true });
  return true;
}
