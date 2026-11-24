import "server-only";
// Voice calls with screen share, on the Cloudflare Realtime SFU. The room is the channel: one call per room.
// The browser never talks to the SFU's API (it needs the app secret): these functions do, for a member whose
// session the room knows (Book.callCheck). The Book keeps who is in the call and which tracks each one publishes.
import * as z from "zod/mini";
import type { Env } from "./index";
import { bookStub } from "./rooms";
import { CallSfuResult, type CallDescription, type CallTracksBody } from "../shared/schemas";
import { CALL_SCREEN_LIMIT_GB, GB, overScreenLimit, recordsRoom, usageMonth } from "./callBudget";
import { hmac, safeEqual } from "./auth";
import { isRecorder } from "../shared/call";

/** Calls are off until the SFU app (var) and its secret exist. */
export const callsOn = (env: Env) => !!(env.REALTIME_SFU_APP_ID && env.REALTIME_SFU_APP_SECRET);

async function sfu(env: Env, method: "POST" | "PUT", path: string, body?: unknown): Promise<unknown> {
  const res = await fetch(`https://rtc.live.cloudflare.com/v1/apps/${env.REALTIME_SFU_APP_ID}${path}`, {
    method,
    headers: { authorization: `Bearer ${env.REALTIME_SFU_APP_SECRET}`, "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!res.ok) {
    console.error("sfu", path.split("/").at(-1), res.status, (await res.text()).slice(0, 300));
    throw new Error(`sfu ${path.split("/").at(-1)} ${res.status}`);
  }
  return res.json();
}

// ---- the month's screen-share budget ----
// The SFU bills egress ($0.05 per GB) after 1,000 GB a month, and has no API that says how much was used. So each
// browser in a call reports the bytes it received (the `call.usage` command) and D1 keeps the month's sum.
// ponytail: the sum is what browsers say, and it does not see TURN or another app on the account. The bill is the
// truth; if they drift apart, read the account's usage from Cloudflare instead.
/** One report covers about 30 seconds: more than this is not a real number. */
const REPORT_MAX = 2 * GB;
export async function addCallUsage(env: Env, bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return;
  await env.DB.prepare(`INSERT INTO call_usage (month, bytes) VALUES (?, ?) ON CONFLICT(month) DO UPDATE SET bytes = bytes + excluded.bytes`).bind(usageMonth(), Math.min(Math.round(bytes), REPORT_MAX)).run();
}
async function screenAllowed(env: Env) {
  const row = await env.DB.prepare(`SELECT bytes FROM call_usage WHERE month = ?`).bind(usageMonth()).first<{ bytes: number }>();
  return !overScreenLimit(row?.bytes ?? 0, Number(env.CALL_SCREEN_LIMIT_GB) || CALL_SCREEN_LIMIT_GB);
}

// ---- what a member in the call may ask the SFU ----
/** The screen track's name: the one track the month's budget can refuse. */
export const SCREEN_TRACK = "screen";

/** A new SFU session (one RTCPeerConnection) for this person, entered in the room's call.
 *  `first`: no person was in the call before, so this join starts it (and its recorder: startRecorder). */
export async function callJoin(env: Env, bookId: string, email: string) {
  const session = z.object({ sessionId: z.string() }).parse(await sfu(env, "POST", "/sessions/new")).sessionId;
  const first = await bookStub(env, bookId).callJoin(bookId, email, session);
  return { session, first: first && !isRecorder(email) };
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
 *  A recorder that does not answer: the call goes on, and the app shows no "recording" mark. */
export async function startRecorder(env: Env, origin: string, bookId: string) {
  if (!env.RECORDER_URL || !env.RECORDER_SECRET || !recordsRoom(env.CALL_RECORD_ROOMS, bookId)) return;
  const res = await fetch(`${env.RECORDER_URL.replace(/\/+$/, "")}/start`, {
    method: "POST",
    headers: { authorization: `Bearer ${env.RECORDER_SECRET}`, "content-type": "application/json" },
    body: JSON.stringify({ room: bookId, joinUrl: await recorderLink(env, origin, bookId) }),
  }).catch((error: unknown) => ({ ok: false, status: 0, error }));
  if (!res.ok) console.error("call recorder did not start", bookId, res.status);
}

/** Publish this person's tracks (push) and receive tracks of others in the same call (pull). */
export async function callTracks(env: Env, bookId: string, email: string, req: CallTracksBody): Promise<CallSfuResult | "forbidden" | "limit"> {
  const book = bookStub(env, bookId), push = req.push ?? [], pull = req.pull ?? [];
  if (!(await book.callCheck(email, req.session, pull.map((p) => p.session)))) return "forbidden";
  if (push.some((p) => p.name === SCREEN_TRACK) && !(await screenAllowed(env))) return "limit";
  const out = CallSfuResult.parse(
    await sfu(env, "POST", `/sessions/${req.session}/tracks/new`, {
      ...(req.offer ? { sessionDescription: req.offer } : {}),
      tracks: [...push.map((p) => ({ location: "local", mid: p.mid, trackName: p.name })), ...pull.map((p) => ({ location: "remote", sessionId: p.session, trackName: p.name }))],
    }),
  );
  if (push.length) await book.callTracks(email, push.map((p) => p.name), []);
  return out;
}

/** The browser's answer to an offer the SFU made (a pull asks for it: requiresImmediateRenegotiation). */
export async function callAnswer(env: Env, bookId: string, email: string, session: string, answer: CallDescription) {
  if (!(await bookStub(env, bookId).callCheck(email, session, []))) return false;
  await sfu(env, "PUT", `/sessions/${session}/renegotiate`, { sessionDescription: answer });
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
