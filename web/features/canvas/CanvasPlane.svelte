<script lang="ts">
  import type { Room } from "../../../shared/room";
  import type { Canvas, CanvasCard } from "../../../shared/canvas";
  import type { RichActions, RichContext } from "../rich-text/types";
  import RichContent from "../rich-text/RichContent.svelte";
  import Mermaid from "../documents/Mermaid.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import { resolveApplicationLanguage } from "../application/copy";
  import { cardStyle, planeStyle } from "./canvasStyle";
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
  const fit = $derived.by(() => {
    if (view) return view;
    if (!cards.length || !width || !height) return { x: 0, y: 0, zoom: 1 };
    const left = Math.min(...cards.map((c) => c.x)),
      top = Math.min(...cards.map((c) => c.y)),
      right = Math.max(...cards.map((c) => c.x + c.w)),
      bottom = Math.max(...cards.map((c) => c.y + c.h));
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
  let drag: { px: number; py: number; x: number; y: number } | null = null;
  function down(event: PointerEvent) {
    if (!interactive || event.button !== 0) return;
    // A card's own content (a link, a selection, an html card) keeps its clicks; the plane around it pans.
    if ((event.target as HTMLElement).closest("[data-canvas-card]")) return;
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
  // The wheel zooms the plane, not the page: a listener that may preventDefault (Svelte's onwheel is passive).
  $effect(() => {
    const host = plane;
    if (!host || !interactive) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const box = host.getBoundingClientRect();
      zoomBy(
        Math.exp(-event.deltaY / 500),
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
  class="relative overflow-hidden rounded-xl bg-muted {interactive
    ? 'cursor-grab touch-none active:cursor-grabbing'
    : ''} {className}"
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
    {#each cards as card (card.id)}<article
        data-canvas-card={card.id}
        use:cardStyle={card}
        class="absolute top-(--cv-t) left-(--cv-l) flex h-(--cv-h) w-(--cv-w) flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm"
      >
        <header
          class="flex shrink-0 items-center gap-2 border-b border-border px-3 py-1.5 text-xs"
        >
          <span class="min-w-0 flex-1 truncate font-semibold"
            >{card.title ?? ""}</span
          >
          <span class="shrink-0 text-muted-foreground"
            >{en
              ? `${name(card.author)}'s Claude`
              : `Claude de ${name(card.author)}`}</span
          >
        </header>
        <div class="min-h-0 flex-1 overflow-auto px-3 py-2 text-sm">
          {#if card.kind === "html"}<iframe
              title={card.title ?? "html"}
              sandbox="allow-scripts"
              srcdoc={srcdoc(card)}
              class="size-full border-0 bg-background"
            ></iframe>{:else if card.kind === "mermaid"}<Mermaid
              source={card.body}
              {context}
              {actions}
              {lang}
            />{:else}<RichContent text={card.body} {room} {actions} />{/if}
        </div>
      </article>{/each}
  </div>
  {#if interactive && cards.length}<div
      class="absolute right-2 bottom-2 flex items-center gap-1 rounded-full border border-border bg-card p-1 text-foreground shadow-sm"
    >
      <IconButton
        data-canvas-zoom-out
        label={en ? "Zoom out" : "Diminuir"}
        onclick={() => zoomBy(1 / 1.25)}><Icon icon="minus" /></IconButton
      >
      <IconButton
        data-canvas-fit
        label={en ? "Fit all cards" : "Ver todos os cartões"}
        onclick={() => (moved = null)}><Icon icon="expand-01" /></IconButton
      >
      <IconButton
        data-canvas-zoom-in
        label={en ? "Zoom in" : "Aumentar"}
        onclick={() => zoomBy(1.25)}><Icon icon="plus" /></IconButton
      >
    </div>{/if}
</div>
