// Who said each piece of the transcript. The recorder's page marks who speaks (the green ring) as turns in time;
// the speech-to-text gives pieces of text with a start and an end. Each piece goes to the person who spoke the
// most while it lasted. Pure: plain Node and the tests load it.
export type Turn = { name: string; start: number; end: number };
/** `quiet`: how sure the speech-to-text is that the piece has no speech (0 to 1). */
export type Piece = { start: number; end: number; text: string; quiet?: number };
/** A piece that is this sure to have no speech, and that nobody's mark covers, is noise that the model wrote as words. */
const QUIET = 0.6;
export const UNKNOWN = "?";

/** The person who spoke the most between `start` and `end` (milliseconds). Nobody then: the person of the turn
 *  that is nearest in time, within 5 seconds. Nobody near: UNKNOWN. */
export function speakerOf(turns: readonly Turn[], start: number, end: number): string {
  const spoke = new Map<string, number>();
  for (const turn of turns) {
    const shared = Math.min(end, turn.end) - Math.max(start, turn.start);
    if (shared > 0) spoke.set(turn.name, (spoke.get(turn.name) ?? 0) + shared);
  }
  const most = [...spoke].sort((a, b) => b[1] - a[1])[0];
  if (most) return most[0];
  let near = UNKNOWN, gap = 5000;
  for (const turn of turns) {
    const distance = Math.max(turn.start - end, start - turn.end);
    if (distance < gap) [near, gap] = [turn.name, distance];
  }
  return near;
}

/** Marks from the page (every 200 ms, the names that speak) become turns: a mark within `hold` ms of the
 *  person's last one goes on with that turn. */
export function addMark(turns: Turn[], name: string, now: number, hold = 700) {
  for (let i = turns.length - 1; i >= 0 && now - turns[i]!.end <= hold; i--)
    if (turns[i]!.name === name) {
      turns[i]!.end = now;
      return;
    }
  turns.push({ name, start: Math.max(0, now - 200), end: now });
}

/** Words in a text. */
const words = (text: string) => text.split(/\s+/).filter(Boolean).length;
/** The words of each language so far (the speech-to-text gives one language for each part), with this part's. */
export const countWords = (counts: Record<string, number>, language: string, pieces: readonly Piece[]) =>
  language ? { ...counts, [language]: (counts[language] ?? 0) + words(pieces.map((piece) => piece.text).join(" ")) } : counts;
/** The call's language: the one with the most words so far (one noisy part in another language does not set it).
 *  "" before 4 words. */
export const callLanguage = (counts: Record<string, number>) => {
  const [language, total] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] ?? ["", 0];
  return total >= 4 ? language : "";
};
/** A short part (3 words or fewer) in another language than the call's: noise that the model wrote as words
 *  ("That's all." in a call in Portuguese). Its pieces are dropped. The model's own no-speech score is 0 with
 *  vad_filter on (measured on Workers AI), so it cannot tell. */
export const strayPart = (known: string, language: string, pieces: readonly Piece[]) =>
  !!known && !!language && language !== known && words(pieces.map((piece) => piece.text).join(" ")) <= 3;

/** A live part's lines as the chat takes them (POST /api/calls/live): a name for nobody known, no empty text, the
 *  sizes that the chat allows. */
export const liveLines = (lines: readonly { name: string; text: string }[]) =>
  lines
    .filter((line) => line.text.trim())
    .slice(0, 50)
    .map((line) => ({ name: line.name === UNKNOWN ? "Desconhecido" : line.name.slice(0, 80), text: line.text.trim().slice(0, 4000) }));

/** The pieces with their person, in the order of the call. `people`: who was in the call. With one person
 *  only, each piece is that person's. A piece with nobody near and no clear speech is dropped. */
export const attribute = (turns: readonly Turn[], pieces: readonly Piece[], people: readonly string[] = []) =>
  [...pieces]
    .filter((piece) => piece.text.trim())
    .sort((a, b) => a.start - b.start)
    .map((piece) => ({ name: speakerOf(turns, piece.start, piece.end), start: piece.start, end: piece.end, text: piece.text.trim(), quiet: piece.quiet ?? 0 }))
    .filter((line) => line.name !== UNKNOWN || line.quiet < QUIET)
    .map(({ quiet: _quiet, ...line }) => (line.name === UNKNOWN && people.length === 1 ? { ...line, name: people[0]! } : line));

/** The open live part: whose turn it is, when it began, and when that person was last heard (ms). */
export type LiveTurn = { name: string; start: number; heard: number };
/** The live transcript's cut, each 200 ms in the recorder's page: a part is one person's turn. It ends when that
 *  person is quiet for `endMs`, or when another person speaks and they do not. Nobody speaks: no part, so silence
 *  does not go to the speech-to-text. `cut`: stop the open part; `turn`: the part that is open after this.
 *  The page gets this function's text (no imports, no outer names). */
export function liveCut(turn: LiveTurn | null, speaking: readonly string[], now: number, endMs = 1200, maxMs = 120_000) {
  const first = speaking[0];
  if (!turn) return { cut: false, turn: first ? { name: first, start: now, heard: now } : null };
  // ponytail: one turn longer than maxMs is cut, so that one file stays a size that the speech-to-text takes.
  if (speaking.includes(turn.name)) return now - turn.start >= maxMs ? { cut: true, turn: { name: turn.name, start: now, heard: now } } : { cut: false, turn: { ...turn, heard: now } };
  if (first) return { cut: true, turn: { name: first, start: now, heard: now } };
  return now - turn.heard >= endMs ? { cut: true, turn: null } : { cut: false, turn };
}
