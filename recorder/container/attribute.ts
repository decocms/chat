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

/** The pieces with their person, in the order of the call. `people`: who was in the call. With one person
 *  only, each piece is that person's. A piece with nobody near and no clear speech is dropped. */
export const attribute = (turns: readonly Turn[], pieces: readonly Piece[], people: readonly string[] = []) =>
  [...pieces]
    .filter((piece) => piece.text.trim())
    .sort((a, b) => a.start - b.start)
    .map((piece) => ({ name: speakerOf(turns, piece.start, piece.end), start: piece.start, end: piece.end, text: piece.text.trim(), quiet: piece.quiet ?? 0 }))
    .filter((line) => line.name !== UNKNOWN || line.quiet < QUIET)
    .map(({ quiet: _quiet, ...line }) => (line.name === UNKNOWN && people.length === 1 ? { ...line, name: people[0]! } : line));
