import { expect, test } from "bun:test";
import { planTracks, withDtx } from "../web/features/call/session";
import { meetLink, meetMessage } from "../web/features/call/meet";
import { egressFrom, monthDays, overScreenLimit, recordsRoom, usageMonth } from "../src/callBudget";
import { isRecorder, isRecorderOf, isRoomMember, recorderEmail } from "../shared/call";
import { addMark, attribute, speakerOf, type Turn } from "../recorder/container/attribute";
import { transcriptMarkdown, transcriptName } from "../src/callText";

const peers = [
  { email: "me@x.test", session: "s-me", tracks: ["mic", "screen"] },
  { email: "ana@x.test", session: "s-ana", tracks: ["mic", "screen"] },
  { email: "bia@x.test", session: "s-bia", tracks: [] },
];

test("planTracks pulls what others publish, never my own, and drops what is gone", () => {
  expect(planTracks(peers, "s-me", [])).toEqual({
    pull: [
      { session: "s-ana", name: "mic" },
      { session: "s-ana", name: "screen" },
    ],
    drop: [],
  });
  // Ana stopped her screen and Caio left: both tracks stop; her mic is already here.
  expect(
    planTracks([peers[0]!, { ...peers[1]!, tracks: ["mic"] }], "s-me", [
      "s-ana/mic",
      "s-ana/screen",
      "s-caio/mic",
    ]),
  ).toEqual({ pull: [], drop: ["s-ana/screen", "s-caio/mic"] });
});

test("planTracks receives one screen at a time when told which, and every voice", () => {
  const two = [peers[0]!, peers[1]!, { email: "bia@x.test", session: "s-bia", tracks: ["mic", "screen"] }];
  expect(planTracks(two, "s-me", [], "s-bia").pull).toEqual([
    { session: "s-ana", name: "mic" },
    { session: "s-bia", name: "mic" },
    { session: "s-bia", name: "screen" },
  ]);
  // Choosing the other screen drops the first one; no screen at all (a hidden tab) keeps the voices.
  expect(planTracks(two, "s-me", ["s-ana/mic", "s-bia/mic", "s-bia/screen"], "s-ana")).toEqual({
    pull: [{ session: "s-ana", name: "screen" }],
    drop: ["s-bia/screen"],
  });
  expect(planTracks(two, "s-me", ["s-ana/mic", "s-bia/mic", "s-bia/screen"], null)).toEqual({ pull: [], drop: ["s-bia/screen"] });
});

test("planTracks leaves cameras out while they are not on show", () => {
  const cams = [peers[0]!, { email: "ana@x.test", session: "s-ana", tracks: ["mic", "cam"] }];
  expect(planTracks(cams, "s-me", [], null, true).pull).toEqual([
    { session: "s-ana", name: "mic" },
    { session: "s-ana", name: "cam" },
  ]);
  expect(planTracks(cams, "s-me", ["s-ana/mic", "s-ana/cam"], null, false)).toEqual({ pull: [], drop: ["s-ana/cam"] });
});

test("the screen budget turns over at the limit, per month", () => {
  const gb = 1024 ** 3;
  expect(overScreenLimit(899 * gb, 900)).toBe(false);
  expect(overScreenLimit(900 * gb, 900)).toBe(true);
  expect(usageMonth(Date.UTC(2026, 10, 30, 23, 59))).toBe("2026-11");
  expect(usageMonth(Date.UTC(2026, 11, 1))).toBe("2026-12");
});

test("only a Google Meet link is sent, with everyone else in the call mentioned", () => {
  expect(meetLink(" https://meet.google.com/abc-defg-hij ")).toBe(
    "https://meet.google.com/abc-defg-hij",
  );
  expect(meetLink("https://meet.google.com.evil.test/abc")).toBe("");
  expect(
    meetLink("https://evil.test/?https://meet.google.com/abc-defg-hij"),
  ).toBe("");
  const room = {
    me: "me@x.test",
    call: peers,
    handles: { "ana@x.test": "@ana" },
  };
  expect(
    meetMessage(room, "https://meet.google.com/abc", (text, vars) =>
      text.replace("{link}", String(vars?.link)),
    ),
  ).toBe("Tela no Google Meet: https://meet.google.com/abc @ana @bia");
});

test("withDtx asks for silence suppression on Opus lines only, one time", () => {
  const sdp = "m=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=rtpmap:111 opus/48000/2\r\na=fmtp:111 minptime=10;useinbandfec=1\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\na=fmtp:96 profile-id=0\r\n";
  const out = withDtx(sdp);
  expect(out).toContain("a=fmtp:111 minptime=10;useinbandfec=1;usedtx=1\r\n");
  expect(out).toContain("a=fmtp:96 profile-id=0\r\n");
  expect(withDtx(out)).toBe(out);
});

test("the recorder is one room's, is not a person, and only listed rooms are recorded", () => {
  const bot = recorderEmail("abc123def456");
  expect(isRecorder(bot)).toBe(true);
  expect(isRecorder("ana@x.test")).toBe(false);
  expect(isRecorderOf(bot, "abc123def456")).toBe(true);
  expect(isRecorderOf(bot, "zzz999zzz999")).toBe(false);
  expect(isRoomMember({ me: bot, members: ["ana@x.test"] })).toBe(true);
  expect(isRoomMember({ me: "eve@x.test", members: ["ana@x.test"] })).toBe(false);
  expect(recordsRoom(undefined, "abc123def456")).toBe(false);
  expect(recordsRoom("", "abc123def456")).toBe(false);
  expect(recordsRoom("zzz999zzz999, abc123def456", "abc123def456")).toBe(true);
  expect(recordsRoom("zzz999zzz999", "abc123def456")).toBe(false);
  expect(recordsRoom("*", "abc123def456")).toBe(true);
});

test("the account's real egress is the SFU's plus TURN's, and a strange answer is no number", () => {
  expect(egressFrom({ data: { viewer: { accounts: [{ sfu: [{ sum: { egressBytes: 52_800_000 } }], turn: [] }] } } })).toBe(52_800_000);
  expect(egressFrom({ data: { viewer: { accounts: [{ sfu: [{ sum: { egressBytes: 10 } }], turn: [{ sum: { egressBytes: 5 } }] }] } } })).toBe(15);
  expect(egressFrom({ data: { viewer: { accounts: [{ sfu: [], turn: [] }] } } })).toBe(0);
  expect(egressFrom({ errors: [{ message: "not authorized" }], data: null })).toBe(null);
  expect(monthDays(Date.UTC(2026, 10, 24))).toEqual(["2026-11-01", "2026-11-30"]);
  expect(monthDays(Date.UTC(2028, 1, 10))).toEqual(["2028-02-01", "2028-02-29"]);
});

test("each piece of the transcript goes to the person who spoke the most while it lasted", () => {
  const turns: Turn[] = [];
  // Ana speaks from 0 to 4 s, Bia from 4.4 to 9 s, with marks each 200 ms; Ana coughs at 6 s.
  for (let t = 200; t <= 4000; t += 200) addMark(turns, "ana", t);
  for (let t = 4600; t <= 9000; t += 200) addMark(turns, "bia", t);
  addMark(turns, "ana", 6000);
  expect(turns.map((turn) => turn.name)).toEqual(["ana", "bia", "ana"]);
  expect(turns[0]).toEqual({ name: "ana", start: 0, end: 4000 });
  expect(speakerOf(turns, 500, 3500)).toBe("ana");
  expect(speakerOf(turns, 3800, 8000)).toBe("bia");
  // Nobody was marked then: the nearest turn within 5 seconds, else nobody.
  expect(speakerOf(turns, 9500, 10500)).toBe("bia");
  expect(speakerOf(turns, 60_000, 61_000)).toBe("?");
  expect(attribute(turns, [{ start: 5000, end: 8500, text: " Concordo. " }, { start: 0, end: 3900, text: "Bom dia." }, { start: 9000, end: 9100, text: "  " }])).toEqual([
    { name: "ana", start: 0, end: 3900, text: "Bom dia." },
    { name: "bia", start: 5000, end: 8500, text: "Concordo." },
  ]);
});

test("the room's transcript file keeps one paragraph for each turn, with the time", () => {
  expect(
    transcriptMarkdown("Call · 2026-11-24", [
      { name: "ana", start: 0, text: "Bom dia." },
      { name: "ana", start: 4, text: "Vamos começar." },
      { name: "bia", start: 65, text: "Concordo." },
      { name: "bia", start: 70, text: "  " },
    ]),
  ).toBe("# Call · 2026-11-24\n\n**ana** (00:00): Bom dia. Vamos começar.\n\n**bia** (01:05): Concordo.\n");
  expect(transcriptName(Date.UTC(2026, 10, 24, 23, 5))).toBe("call-2026-11-24-23-05.md");
});
