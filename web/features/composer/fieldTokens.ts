// The composer's text keeps a picked room or thread as its plain link (what the chat draws as the app link chip and what
// an agent reads), but the field shows it as that chip. The textarea holds a "view" of the text where each link is a
// short token (two figure spaces and a narrow no-break space where the chip's mark goes, then the name with no-break spaces, so it never wraps),
// and the field's mirror draws the chip over it. These helpers map the text, the caret and edits between the two.

/** What goes in the chip's mark: a room's mark, the thread icon, a person's avatar, or the lock of a place you can't see. */
export type FieldMark =
  | Readonly<{ kind: "room"; id: string; title: string; icon: number }>
  | Readonly<{ kind: "thread" }>
  | Readonly<{ kind: "person"; email: string; avatar: number | null }>
  | Readonly<{ kind: "lock" }>;

/** A link in the text that the field draws as a chip: the same places the chat's app link chip names. */
export type FieldLink = Readonly<{
  /** Where the link is in the stored text. */
  start: number;
  end: number;
  kind: "room" | "thread" | "message" | "dm" | "private";
  /** The chip's words (a thread's room before it, a message's author and where it is, "Sala privada"). */
  label: string;
  mark: FieldMark;
}>;

export type FieldToken = FieldLink &
  Readonly<{
    /** Where the token is in the view. */
    from: number;
    to: number;
    /** The token's text in the view. */
    text: string;
    /** The link it stands for. */
    url: string;
  }>;

export type FieldView = Readonly<{ text: string; tokens: FieldToken[] }>;

/** Where the chip's mark goes: two figure spaces (the mark's width) and a narrow space (the gap), none breaking. */
export const TOKEN_MARK = "\u2007\u2007\u202f";

export function tokenText(link: FieldLink) {
  return TOKEN_MARK + link.label.replace(/\s/g, "\u00a0");
}

/** The view of `text` with `links` (sorted, not overlapping) drawn as tokens. */
export function fieldView(
  text: string,
  links: readonly FieldLink[],
): FieldView {
  let out = "",
    at = 0;
  const tokens: FieldToken[] = [];
  for (const link of links) {
    if (link.start < at || link.end > text.length || link.end <= link.start)
      continue;
    out += text.slice(at, link.start);
    const token = tokenText(link);
    tokens.push({
      ...link,
      from: out.length,
      to: out.length + token.length,
      text: token,
      url: text.slice(link.start, link.end),
    });
    out += token;
    at = link.end;
  }
  return { text: out + text.slice(at), tokens };
}

/** A caret in the stored text, in the view (inside a link: after its token). */
export function toView(view: FieldView, at: number) {
  let shift = 0;
  for (const token of view.tokens) {
    if (at < token.start) break;
    if (at < token.end) return token.to;
    shift += token.text.length - (token.end - token.start);
  }
  return at + shift;
}

/** A caret in the view, in the stored text (inside a token: after its link). */
export function toStored(view: FieldView, at: number) {
  let shift = 0;
  for (const token of view.tokens) {
    if (at <= token.from) break;
    if (at < token.to) return token.end;
    shift += token.end - token.start - token.text.length;
  }
  return at + shift;
}

/** The token a view caret sits strictly inside, if any. */
export const tokenInside = (view: FieldView, at: number) =>
  view.tokens.find((token) => at > token.from && at < token.to);

/** A view selection widened so it never cuts a token: the caret can't go inside one. `back` = moving left. */
export function snapSelection(
  view: FieldView,
  start: number,
  end: number,
  back = false,
): [number, number] {
  if (start === end) {
    const token = tokenInside(view, start);
    if (!token) return [start, end];
    const edge = back ? token.from : token.to;
    return [edge, edge];
  }
  return [
    tokenInside(view, start)?.from ?? start,
    tokenInside(view, end)?.to ?? end,
  ];
}

/** A key on a collapsed caret next to a token: Backspace/Delete select the whole token (the browser's own delete then
 *  removes it, so undo works), ←/→ jump over it. */
export function tokenKey(
  view: FieldView,
  at: number,
  key: string,
): { select: [number, number] } | { move: number } | null {
  const ending = view.tokens.find((token) => token.to === at),
    starting = view.tokens.find((token) => token.from === at);
  if (key === "Backspace" && ending)
    return { select: [ending.from, ending.to] };
  if (key === "Delete" && starting)
    return { select: [starting.from, starting.to] };
  if (key === "ArrowLeft" && ending) return { move: ending.from };
  if (key === "ArrowRight" && starting) return { move: starting.to };
  return null;
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The stored text for an edited view: every token the edit didn't touch goes back to its own link (two chips with
 *  the same words, like two "Sala privada", keep their own links); a token's text inside the edited span (undo puts a
 *  deleted one back) goes back to the link it stood for, from this view or from `known`. A view caret maps with it. */
export function fromView(
  view: FieldView,
  edited: string,
  known?: ReadonlyMap<string, string>,
) {
  const before = view.text;
  if (!view.tokens.length && !known?.size)
    return { text: edited, at: (caret: number) => caret };
  const max = Math.min(before.length, edited.length);
  let head = 0;
  while (head < max && before[head] === edited[head]) head++;
  let tail = 0;
  while (
    tail < max - head &&
    before[before.length - 1 - tail] === edited[edited.length - 1 - tail]
  )
    tail++;
  const delta = edited.length - before.length;
  let from = head,
    to = edited.length - tail;
  const found: { from: number; to: number; url: string }[] = [];
  for (const token of view.tokens) {
    if (token.to <= head) found.push(token);
    else if (token.from >= before.length - tail)
      found.push({
        from: token.from + delta,
        to: token.to + delta,
        url: token.url,
      });
    else {
      // Cut by the edit, or around it: look for it again in the edited span.
      from = Math.min(from, token.from);
      to = Math.max(to, Math.min(edited.length, token.to + delta));
    }
  }
  const urls = new Map<string, string>();
  for (const token of view.tokens)
    if (!urls.has(token.text)) urls.set(token.text, token.url);
  for (const [text, url] of known ?? [])
    if (!urls.has(text)) urls.set(text, url);
  if (urls.size && to > from) {
    const pattern = new RegExp(
      [...urls.keys()]
        .sort((a, b) => b.length - a.length)
        .map(escape)
        .join("|"),
      "g",
    );
    for (const match of edited.slice(from, to).matchAll(pattern))
      found.push({
        from: from + match.index,
        to: from + match.index + match[0].length,
        url: urls.get(match[0]) ?? match[0],
      });
  }
  found.sort((a, b) => a.from - b.from);
  const swaps: { from: number; to: number; shift: number }[] = [];
  let text = "",
    at = 0,
    shift = 0;
  for (const swap of found) {
    if (swap.from < at) continue;
    text += edited.slice(at, swap.from) + swap.url;
    shift += swap.url.length - (swap.to - swap.from);
    swaps.push({ from: swap.from, to: swap.to, shift });
    at = swap.to;
  }
  text += edited.slice(at);
  return {
    text,
    at: (caret: number) => {
      let moved = 0;
      for (const swap of swaps) {
        if (caret <= swap.from) break;
        if (caret < swap.to) return swap.to + swap.shift;
        moved = swap.shift;
      }
      return caret + moved;
    },
  };
}

/** The stored text of a view range (copy keeps the links). */
export function storedSlice(
  view: FieldView,
  stored: string,
  start: number,
  end: number,
) {
  return stored.slice(toStored(view, start), toStored(view, end));
}
