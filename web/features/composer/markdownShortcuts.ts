/** Keyboard shortcuts that write Markdown in a text field: ⌘B / Ctrl+B bold, ⌘I italic, ⌘U underline, ⌘E code,
 * ⌘⇧X strikethrough, ⌘⇧E code block, ⌘⇧9 quote and ⌘⇧K link. A second press removes the marks. A URL pasted over selected
 * text makes a link. A person's message renders all of them (shared/inlineMarks.ts). */

export type MarkdownMark = "**" | "_" | "__" | "`" | "~~";
export type MarkdownShortcut =
  | { kind: "mark"; mark: MarkdownMark }
  | { kind: "codeBlock" }
  | { kind: "quote" }
  | { kind: "link" };

/** One replacement in the text, and the selection after it. */
export type MarkEdit = {
  from: number;
  to: number;
  insert: string;
  selectionStart: number;
  selectionEnd: number;
};

/** Puts `mark` around `text[start, end)`, or removes it when it is already there (inside or just outside the
 * selection). Spaces at the ends of the selection stay outside, because Markdown does not see `** word**` as bold. */
export function toggleMark(
  text: string,
  start: number,
  end: number,
  mark: MarkdownMark,
): MarkEdit {
  if (start > end) [start, end] = [end, start];
  if (text.slice(start, end).trim()) {
    while (/\s/.test(text[start])) start++;
    while (/\s/.test(text[end - 1])) end--;
  }
  const size = mark.length;
  const selected = text.slice(start, end);
  // `_` is not half of `__`: italic does not remove one underscore of an underline.
  const single = size === 1;
  if (
    selected.length >= size * 2 &&
    selected.startsWith(mark) &&
    selected.endsWith(mark) &&
    !(single && (selected[1] === mark || selected.at(-2) === mark))
  ) {
    const inner = selected.slice(size, -size);
    return {
      from: start,
      to: end,
      insert: inner,
      selectionStart: start,
      selectionEnd: start + inner.length,
    };
  }
  if (
    start - size >= 0 &&
    text.slice(start - size, start) === mark &&
    text.slice(end, end + size) === mark &&
    !(single && (text[start - 2] === mark || text[end + 1] === mark))
  )
    return {
      from: start - size,
      to: end + size,
      insert: selected,
      selectionStart: start - size,
      selectionEnd: end - size,
    };
  return {
    from: start,
    to: end,
    insert: mark + selected + mark,
    selectionStart: start + size,
    selectionEnd: end + size,
  };
}

/** The whole lines that `[start, end)` touches. */
function lineRange(text: string, start: number, end: number) {
  if (start > end) [start, end] = [end, start];
  // A selection that ends at the start of a line (a triple click) does not take that line.
  if (end > start && text[end - 1] === "\n") end--;
  const from = text.lastIndexOf("\n", start - 1) + 1;
  const next = text.indexOf("\n", end);
  return { from, to: next === -1 ? text.length : next };
}

const fence = /^```\s*$/;

/** Puts a ``` line before and after the selected lines, or removes them when they are there. */
export function toggleCodeBlock(
  text: string,
  start: number,
  end: number,
): MarkEdit {
  const { from, to } = lineRange(text, start, end);
  const lines = text.slice(from, to).split("\n");
  if (
    lines.length >= 2 &&
    /^```/.test(lines[0]!) &&
    fence.test(lines.at(-1)!)
  ) {
    const inner = lines.slice(1, -1).join("\n");
    return {
      from,
      to,
      insert: inner,
      selectionStart: from,
      selectionEnd: from + inner.length,
    };
  }
  // The lines just around the selection are the fences: remove them.
  const before = text.lastIndexOf("\n", from - 2) + 1;
  const afterEnd = text.indexOf("\n", to + 1);
  const above = from > 0 ? text.slice(before, from - 1) : null;
  const below =
    to < text.length
      ? text.slice(to + 1, afterEnd === -1 ? text.length : afterEnd)
      : null;
  if (
    above !== null &&
    below !== null &&
    /^```/.test(above) &&
    fence.test(below)
  ) {
    const inner = text.slice(from, to);
    return {
      from: before,
      to: afterEnd === -1 ? text.length : afterEnd,
      insert: inner,
      selectionStart: before,
      selectionEnd: before + inner.length,
    };
  }
  const body = text.slice(from, to);
  return {
    from,
    to,
    insert: "```\n" + body + "\n```",
    selectionStart: from + 4,
    selectionEnd: from + 4 + body.length,
  };
}

const quoted = /^>(?: |$)/;

/** Puts `> ` at the start of each selected line, or removes it when every line that has text has it. */
export function toggleQuote(
  text: string,
  start: number,
  end: number,
): MarkEdit {
  const { from, to } = lineRange(text, start, end);
  const lines = text.slice(from, to).split("\n");
  const remove = lines.every((line) => !line.trim() || quoted.test(line));
  const insert = lines
    .map((line) =>
      remove ? line.replace(quoted, "") : line ? `> ${line}` : ">",
    )
    .join("\n");
  return {
    from,
    to,
    insert,
    selectionStart: from,
    selectionEnd: from + insert.length,
  };
}

const fullUrl = /^https?:\/\/[^\s()]+$/;
const bareUrl = /^(?:[\p{L}\p{N}-]+\.)+[a-z]{2,}(?:[/?#][^\s()]*)?$/iu;

/** `value` as a URL that a message renders (`https://…`), or null. A bare address (`www.decocms.com`,
 * `decocms.com/x`) gets `https://`. With `loose` false, only `https://…` and `www.…` count: a pasted `file.ts` stays
 * text. */
export function asUrl(value: string, loose = true): string | null {
  const url = value.trim();
  if (fullUrl.test(url)) return url;
  if (!bareUrl.test(url) || (!loose && !/^www\./i.test(url))) return null;
  return `https://${url}`;
}

/** `[selected](url)` when `pasted` is one URL and the selection is text on one line. Else null: a normal paste. */
export function linkEdit(
  text: string,
  start: number,
  end: number,
  pasted: string,
): MarkEdit | null {
  if (start > end) [start, end] = [end, start];
  const url = asUrl(pasted, false);
  const label = text.slice(start, end);
  if (!url || !label.trim() || /[\n[\]]/.test(label) || asUrl(label))
    return null;
  const insert = `[${label}](${url})`;
  return {
    from: start,
    to: end,
    insert,
    selectionStart: start + insert.length,
    selectionEnd: start + insert.length,
  };
}

/** A short name for a link, from the URL only (the app does not open the page): a GitHub pull request is
 * "org/repo #42", a page is its last word-like path part ("Stone migration (figma.com)"), else the host. */
export function urlLabel(href: string): string {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return href;
  }
  const gh =
    /^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)(?:\/(pull|issues|commit)\/(\w+))?\/?(?:[?#].*)?$/.exec(
      href,
    );
  if (gh)
    return gh[3] === "commit"
      ? `${gh[1]}/${gh[2]}@${gh[4]!.slice(0, 7)}`
      : gh[3]
        ? `${gh[1]}/${gh[2]} #${gh[4]}`
        : `${gh[1]}/${gh[2]}`;
  const host = url.hostname.replace(/^www\./, "");
  const parts = url.pathname.split("/").filter(Boolean);
  for (const part of parts.reverse()) {
    let word = part;
    try {
      word = decodeURIComponent(part);
    } catch {}
    word = word
      .replace(/\.(html?|php|aspx?|md)$/i, "")
      // Notion and others end a title with an ID: "Page-Title-1a2b3c…".
      .replace(/[-_][0-9a-f]{12,}$/i, "");
    const generic =
      /^(edit|view|preview|index|home|share|embed|amp|[a-z]{1,2}|[a-z]{2}-[a-z]{2})$/i;
    // An ID: digits and letters with no separator ("1AbCdEf123", "f94aedb83899").
    const id = /\d/.test(word) && !/[-_+\s]/.test(word) && word.length >= 6;
    if (generic.test(word) || id || !/\p{L}/u.test(word)) continue;
    const text = word.replace(/[-_+]+/g, " ").trim();
    return `${text[0]!.toUpperCase()}${text.slice(1)} (${host})`;
  }
  return host;
}

const markdownLink = /^\[[^\]\n]+\]\((https?:\/\/[^\s()]+)\)$/;

/** ⌘⇧K: a selected URL becomes `[name](url)` with the name selected (type to change it); a selected text becomes
 * `[text]()` with the caret in the parentheses; a selected link goes back to its URL. Null on several lines. */
export function toggleLink(
  text: string,
  start: number,
  end: number,
): MarkEdit | null {
  if (start > end) [start, end] = [end, start];
  if (text.slice(start, end).trim()) {
    while (/\s/.test(text[start])) start++;
    while (/\s/.test(text[end - 1])) end--;
  }
  const selected = text.slice(start, end);
  if (selected.includes("\n")) return null;
  const link = markdownLink.exec(selected);
  if (link)
    return {
      from: start,
      to: end,
      insert: link[1]!,
      selectionStart: start,
      selectionEnd: start + link[1]!.length,
    };
  const url = asUrl(selected);
  if (url) {
    const label = urlLabel(url).replace(/[[\]]/g, "");
    return {
      from: start,
      to: end,
      insert: `[${label}](${url})`,
      selectionStart: start + 1,
      selectionEnd: start + 1 + label.length,
    };
  }
  if (/[[\]]/.test(selected)) return null;
  const caret = selected ? start + selected.length + 3 : start + 1;
  return {
    from: start,
    to: end,
    insert: `[${selected}]()`,
    selectionStart: caret,
    selectionEnd: caret,
  };
}

const apple =
  typeof navigator !== "undefined" &&
  /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent);

/** The shortcut that a key press asks for, or null. On a Mac only ⌘ counts: Ctrl+B and Ctrl+E move the caret there. */
export function shortcutFor(
  event: Pick<
    KeyboardEvent,
    "key" | "code" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey"
  >,
  mac = apple,
): MarkdownShortcut | null {
  if (event.altKey || !(mac ? event.metaKey : event.ctrlKey)) return null;
  if (mac ? event.ctrlKey : event.metaKey) return null;
  const key = event.key.toLowerCase();
  if (event.shiftKey) {
    if (key === "x") return { kind: "mark", mark: "~~" };
    if (key === "e") return { kind: "codeBlock" };
    if (key === "k") return { kind: "link" };
    // ⇧9 writes "(" on most layouts: the physical key, not the character.
    if (event.code === "Digit9") return { kind: "quote" };
    return null;
  }
  const mark: Record<string, MarkdownMark> = {
    b: "**",
    i: "_",
    u: "__",
    e: "`",
  };
  return mark[key] ? { kind: "mark", mark: mark[key] } : null;
}

function apply(field: HTMLTextAreaElement, edit: MarkEdit) {
  field.setSelectionRange(edit.from, edit.to);
  // execCommand is deprecated but it is the only way to keep the browser's undo history for a textarea.
  const done =
    typeof document.execCommand === "function" &&
    document.execCommand("insertText", false, edit.insert);
  if (!done) {
    field.setRangeText(edit.insert, edit.from, edit.to);
    field.dispatchEvent(new InputEvent("input", { bubbles: true }));
  }
  field.setSelectionRange(edit.selectionStart, edit.selectionEnd);
}

/** Applies a Markdown shortcut to the field of `event`. Returns true when it handled the key. The edit goes through
 * `insertText`, so the field sends its normal `input` event and ⌘Z undoes it. */
export function markdownShortcut(event: KeyboardEvent): boolean {
  if (event.isComposing) return false;
  const field = event.currentTarget;
  if (!(field instanceof HTMLTextAreaElement) || field.readOnly) return false;
  const shortcut = shortcutFor(event);
  if (!shortcut) return false;
  event.preventDefault();
  // The app's ⌘K search listens on the document and does not look at ⇧: ⌘⇧K in a field is the link only.
  event.stopPropagation();
  const { value, selectionStart: start, selectionEnd: end } = field;
  const edit =
    shortcut.kind === "mark"
      ? toggleMark(value, start, end, shortcut.mark)
      : shortcut.kind === "codeBlock"
        ? toggleCodeBlock(value, start, end)
        : shortcut.kind === "quote"
          ? toggleQuote(value, start, end)
          : toggleLink(value, start, end);
  if (edit) apply(field, edit);
  return true;
}

/** A URL pasted over selected text makes `[text](url)`. Other pastes go on as usual. */
export function markdownPaste(event: ClipboardEvent) {
  const field = event.currentTarget;
  if (!(field instanceof HTMLTextAreaElement) || field.readOnly) return;
  const edit = linkEdit(
    field.value,
    field.selectionStart,
    field.selectionEnd,
    event.clipboardData?.getData("text/plain") ?? "",
  );
  if (!edit) return;
  event.preventDefault();
  apply(field, edit);
}
