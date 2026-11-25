// The composer's text keeps a picked room or thread as its plain link (what the chat draws as the app link chip and what
// an agent reads), but the field shows it as that chip. The textarea holds a "view" of the text where each link is a
// short token (two figure spaces where the chip's mark goes, then the name with no-break spaces, so it never wraps),
// and the field's mirror draws the chip over it. These helpers map the text, the caret and edits between the two.

/** A link in the text that the field draws as a chip. */
export type FieldLink = Readonly<{
  /** Where the link is in the stored text. */
  start: number;
  end: number;
  kind: "room" | "thread";
  /** The room's id (a thread's room). */
  id: string;
  /** The room's name, or the thread's title. */
  title: string;
  /** A thread's room name, shown before it. */
  room?: string;
  /** The room's icon version (0 = none). */
  icon: number;
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

/** Where the chip's mark goes: two figure spaces (no-break, about the mark's width). */
export const TOKEN_MARK = "  ";

const label = (link: FieldLink) =>
  link.kind === "thread" && link.room
    ? `${link.room} › ${link.title}`
    : link.title;

export function tokenText(link: FieldLink) {
  return TOKEN_MARK + label(link).replace(/\s/g, " ");
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

/** The stored text for an edited view: every token still whole goes back to its link; a view caret maps with it. */
export function fromView(view: FieldView, edited: string) {
  const urls = new Map<string, string>();
  for (const token of view.tokens)
    if (!urls.has(token.text)) urls.set(token.text, token.url);
  if (!urls.size) return { text: edited, at: (caret: number) => caret };
  const pattern = new RegExp(
    [...urls.keys()]
      .sort((a, b) => b.length - a.length)
      .map((text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|"),
    "g",
  );
  const swaps: { from: number; to: number; shift: number }[] = [];
  let shift = 0;
  const text = edited.replace(pattern, (token: string, offset: number) => {
    const url = urls.get(token) ?? token;
    shift += url.length - token.length;
    swaps.push({ from: offset, to: offset + token.length, shift });
    return url;
  });
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
