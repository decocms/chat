<script lang="ts">
  import type { Room } from "../../../shared/room";
  import type { Canvas, CanvasCard } from "../../../shared/canvas";
  import type { RichActions, RichContext } from "../rich-text/types";
  import RichContent from "../rich-text/RichContent.svelte";
  import Mermaid from "../documents/Mermaid.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import { resolveApplicationLanguage } from "../application/copy";
  import { CLAUDE_COLORS, cardStyle, planeStyle } from "./canvasStyle";
  import { claudeColors, claudeKey } from "../../../shared/canvas";
  /**
   * A viewport on a canvas (shared/canvas.ts): the call's stage and each ```canvas block of a doc draw the same
   * plane, each with its own x, y and zoom. Agents write the cards (canvas_put); people look, pan and zoom.
   * `view` missing: the viewport fits every card, and fits again as cards arrive, until the person pans or zooms.
   */
  let {
    canvas,
    room,
    actions,
    view,
    interactive = true,
    class: className = "",
  }: {
    canvas: Canvas | undefined;
    room: Room;
    actions: RichActions;
    view?: { x: number; y: number; zoom: number };
    /** Drag pans, the wheel and the buttons zoom. A doc's block scrolls with the doc: no wheel there. */
    interactive?: boolean;
    class?: string;
  } = $props();
  const lang = resolveApplicationLanguage(document.cookie, navigator.language);
  const en = lang === "en";
  const cards = $derived(canvas?.cards ?? []);
  const idPrefix = $props.id();
  const context: RichContext = $derived({
    room,
    pageUrl: location.href,
    idPrefix,
    policy: "document",
  });
  let width = $state(0),
    height = $state(0),
    moved = $state<{ x: number; y: number; zoom: number } | null>(null);
  /** An element's box on the plane: an arrow's w and h can be negative. */
  const box = (c: CanvasCard) => ({
    x: Math.min(c.x, c.x + c.w),
    y: Math.min(c.y, c.y + c.h),
    w: Math.max(Math.abs(c.w), 1),
    h: Math.max(Math.abs(c.h), 1),
  });
  const fit = $derived.by(() => {
    if (view) return view;
    if (!cards.length || !width || !height) return { x: 0, y: 0, zoom: 1 };
    const boxes = cards.map(box);
    const left = Math.min(...boxes.map((c) => c.x)),
      top = Math.min(...boxes.map((c) => c.y)),
      right = Math.max(...boxes.map((c) => c.x + c.w)),
      bottom = Math.max(...boxes.map((c) => c.y + c.h));
    const pad = 32,
      zoom = Math.min(
        1,
        (width - 2 * pad) / (right - left),
        (height - 2 * pad) / (bottom - top),
      );
    // Centered: the free room on each side is the same.
    return {
      x: left - (width / zoom - (right - left)) / 2,
      y: top - (height / zoom - (bottom - top)) / 2,
      zoom,
    };
  });
  const at = $derived(moved ?? fit);
  const name = (email: string) =>
    (room.names?.[email] ?? email.split("@")[0] ?? "").split(/\s+/)[0];
  /** "Claude de Ana", or "claude-2 de Ana" when Ana has more than one. */
  const who = (card: CanvasCard) => {
    const agent =
      !card.agent || card.agent === "claude" ? "Claude" : card.agent;
    return en
      ? `${name(card.author)}'s ${agent}`
      : `${agent} de ${name(card.author)}`;
  };
  const palette = $derived(claudeColors(cards, CLAUDE_COLORS.length));
  const color = (card: CanvasCard) => palette.get(claudeKey(card)) ?? 0;
  const tone = (card: CanvasCard) =>
    CLAUDE_COLORS[color(card)] ?? CLAUDE_COLORS[0];
  let drag: { px: number; py: number; x: number; y: number } | null = null;
  function down(event: PointerEvent) {
    if (event.button !== 0) return;
    // A drag pans everywhere on the board, also on a shape or a block (Gui #6762: it selected text before); only the
    // controls, links and an html block keep their own clicks. Nothing on the board is selectable text.
    if ((event.target as HTMLElement).closest("button, a, iframe")) return;
    event.preventDefault();
    drag = { px: event.clientX, py: event.clientY, x: at.x, y: at.y };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }
  function move(event: PointerEvent) {
    if (!drag) return;
    moved = {
      x: drag.x - (event.clientX - drag.px) / at.zoom,
      y: drag.y - (event.clientY - drag.py) / at.zoom,
      zoom: at.zoom,
    };
  }
  function zoomBy(factor: number, cx = width / 2, cy = height / 2) {
    const zoom = Math.min(4, Math.max(0.1, at.zoom * factor));
    // The point under the pointer (or the middle) stays where it is.
    moved = {
      x: at.x + cx / at.zoom - cx / zoom,
      y: at.y + cy / at.zoom - cy / zoom,
      zoom,
    };
  }
  let plane: HTMLElement | undefined = $state();
  /** Full screen (Gui #6761): the canvas over the whole app, to read a big diagram. Esc or the button closes it. */
  let full = $state(false);
  $effect(() => {
    if (!full) return;
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        full = false;
        moved = null;
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  });
  // Opening or closing fits the drawing to the new size.
  const toggleFull = () => {
    full = !full;
    moved = null;
  };
  // The wheel zooms the plane, not the page: a listener that may preventDefault (Svelte's onwheel is passive).
  $effect(() => {
    const host = plane;
    if (!host) return;
    // Like a design tool (Gui #6761): a pinch (the browser sends it as ctrl + wheel) or ⌘/ctrl + wheel zooms, fast;
    // a plain wheel or two fingers pan, except in a doc, where they scroll the doc (and in full screen they pan).
    const wheel = (event: WheelEvent) => {
      const zoom = event.ctrlKey || event.metaKey;
      if (!zoom && !interactive && !full) return;
      event.preventDefault();
      if (!zoom) {
        moved = {
          x: at.x + event.deltaX / at.zoom,
          y: at.y + event.deltaY / at.zoom,
          zoom: at.zoom,
        };
        return;
      }
      const box = host.getBoundingClientRect();
      // A pinch sends small steps, a mouse wheel big ones: both feel quick.
      const speed = Math.abs(event.deltaY) < 50 ? 0.02 : 0.004;
      zoomBy(
        Math.exp(-event.deltaY * speed),
        event.clientX - box.left,
        event.clientY - box.top,
      );
    };
    host.addEventListener("wheel", wheel, { passive: false });
    return () => host.removeEventListener("wheel", wheel);
  });
  /** An html card: an opaque origin with scripts and no network (the same rules as an html post, src/fileHeaders.ts). */
  const srcdoc = (card: CanvasCard) =>
    `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:">${card.body}`;
</script>

<div
  data-canvas
  role="application"
  aria-label="Canvas"
  bind:this={plane}
  bind:clientWidth={width}
  bind:clientHeight={height}
  data-canvas-full-open={full || undefined}
  class="cursor-grab touch-none overflow-hidden select-none rounded-xl bg-muted active:cursor-grabbing {full
    ? 'fixed inset-4 z-50 border border-border shadow-2xl'
    : 'relative'} {full ? '' : className}"
  onpointerdown={down}
  onpointermove={move}
  onpointerup={() => (drag = null)}
  onpointercancel={() => (drag = null)}
>
  {#if !cards.length}<p
      data-canvas-empty
      class="absolute inset-0 m-0 flex items-center justify-center p-6 text-center text-sm text-muted-foreground"
    >
      {en
        ? "Nothing here yet. The room's Claudes write here with canvas_put."
        : "Nada aqui ainda. Os Claudes da sala escrevem aqui com canvas_put."}
    </p>{/if}
  <div
    use:planeStyle={at}
    class="absolute top-0 left-0 origin-top-left [transform:scale(var(--cv-s))_translate(var(--cv-x),var(--cv-y))]"
  >
    <!-- One shared plane, no window per card (Gui #6627): each card is its content beside a bar in its Claude's
         color, with that Claude's name on top. -->
    {#each cards as card (card.id)}{@const t =
        tone(card)}{#if card.kind === "arrow"}<svg
          data-canvas-card={card.id}
          data-canvas-color={color(card)}
          use:cardStyle={{
            ...box(card),
            x: box(card).x - 12,
            y: box(card).y - 12,
            w: box(card).w + 24,
            h: box(card).h + 24,
          }}
          class="pointer-events-none absolute top-(--cv-t) left-(--cv-l) h-(--cv-h) w-(--cv-w) overflow-visible {t.stroke} {t.fill}"
          aria-label={card.body || who(card)}
          ><title>{who(card)}</title><defs
            ><marker
              id="{idPrefix}-{card.id}"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="8"
              markerHeight="8"
              orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" /></marker
            ></defs
          ><line
            x1={card.x - box(card).x + 12}
            y1={card.y - box(card).y + 12}
            x2={card.x + card.w - box(card).x + 12}
            y2={card.y + card.h - box(card).y + 12}
            stroke-width="2.5"
            stroke-linecap="round"
            marker-end="url(#{idPrefix}-{card.id})"
          />{#if card.body}<text
              x={card.w / 2 + card.x - box(card).x + 12}
              y={card.h / 2 + card.y - box(card).y + 4}
              text-anchor="middle"
              class="fill-foreground stroke-none text-xs">{card.body}</text
            >{/if}</svg
        >{:else if card.kind === "rect" || card.kind === "ellipse" || card.kind === "text"}<div
          data-canvas-card={card.id}
          data-canvas-color={color(card)}
          use:cardStyle={card}
          title={who(card)}
          class="absolute top-(--cv-t) left-(--cv-l) flex h-(--cv-h) w-(--cv-w) items-center p-2 text-sm text-foreground {card.kind ===
          'text'
            ? 'justify-start text-left text-base font-medium'
            : 'justify-center border-2 bg-background text-center'} {card.kind ===
          'text'
            ? ''
            : t.bar} {card.kind === 'ellipse' ? 'rounded-full' : 'rounded-lg'}"
        >
          <span class="line-clamp-6 break-words">{card.body}</span>
        </div>{:else}<article
          data-canvas-card={card.id}
          data-canvas-color={color(card)}
          use:cardStyle={card}
          class="absolute top-(--cv-t) left-(--cv-l) flex h-(--cv-h) w-(--cv-w) flex-col gap-1 border-l-4 pl-3 {t.bar}"
        >
          <header
            class="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground"
          >
            <span class="size-2 shrink-0 rounded-full {t.dot}"></span>
            <span class="truncate">{who(card)}</span>
          </header>
          {#if card.title}<h3
              class="m-0 shrink-0 truncate text-sm font-semibold text-foreground"
            >
              {card.title}
            </h3>{/if}
          <div class="min-h-0 flex-1 overflow-auto text-sm text-foreground">
            {#if card.kind === "html"}<iframe
                title={card.title ?? "html"}
                sandbox="allow-scripts"
                srcdoc={srcdoc(card)}
                class="size-full rounded-lg border-0 bg-background"
              ></iframe>{:else if card.kind === "mermaid"}<Mermaid
                source={card.body}
                {context}
                {actions}
                {lang}
              />{:else}<RichContent text={card.body} {room} {actions} />{/if}
          </div>
        </article>{/if}{/each}
  </div>
  {#if cards.length}<div
      class="absolute right-2 bottom-2 flex items-center gap-1 rounded-full border border-border bg-card p-1 text-foreground shadow-sm"
    >
      <IconButton
        data-canvas-zoom-out
        label={en ? "Zoom out" : "Diminuir"}
        onclick={() => zoomBy(1 / 1.5)}><Icon icon="minus" /></IconButton
      >
      <IconButton
        data-canvas-fit
        label={en ? "Fit all cards" : "Ver todos os cartões"}
        onclick={() => (moved = null)}><Icon icon="target-04" /></IconButton
      >
      <IconButton
        data-canvas-zoom-in
        label={en ? "Zoom in" : "Aumentar"}
        onclick={() => zoomBy(1.5)}><Icon icon="plus" /></IconButton
      >
      <IconButton
        data-canvas-full
        label={full
          ? en
            ? "Exit full screen"
            : "Sair da tela cheia"
          : en
            ? "Full screen"
            : "Tela cheia"}
        onclick={toggleFull}
        ><Icon icon={full ? "minimize-01" : "expand-01"} /></IconButton
      >
    </div>{/if}
</div>
