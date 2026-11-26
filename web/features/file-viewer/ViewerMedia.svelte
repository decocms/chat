<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { zoomStyle } from "./zoomStyle";
  import type { ViewerContent } from "./session";
  import {
    fitScale,
    fitted,
    isFitted,
    pan,
    toggle,
    zoomTo,
    type ZoomView,
  } from "./zoom";
  let {
    content,
    name,
    onready,
    onerror,
    onclose,
    zoom = $bindable(),
  }: {
    content: ViewerContent;
    name: string;
    onready: () => void;
    onerror: () => void;
    onclose: () => void;
    /** Full-screen image (Gimenes #5961): the image fills its box and zooms. Bound, so the title bar has the buttons. */
    zoom?: ZoomView;
  } = $props();
  let stage: HTMLDivElement | undefined = $state();
  let natural = $state({ width: 0, height: 0 });
  let box = $state({ width: 0, height: 0 });
  const zooming = $derived(zoom !== undefined && content.kind === "image");
  /** Fit again when the box or the image changes size (a window resize, the image loaded). */
  $effect(() => {
    if (!zooming) return;
    const fit = fitScale(box, natural);
    const now = untrack(() => zoom);
    if (!now || Math.abs(now.fit - fit) > 0.001) zoom = fitted(fit);
  });
  $effect(() => {
    if (!zooming || !stage) return;
    const observer = new ResizeObserver(([entry]) => {
      box = {
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      };
    });
    observer.observe(stage);
    return () => observer.disconnect();
  });
  const point = (event: { clientX: number; clientY: number }) => {
    const rect = stage?.getBoundingClientRect();
    return rect
      ? [
          event.clientX - rect.left - rect.width / 2,
          event.clientY - rect.top - rect.height / 2,
        ]
      : [0, 0];
  };
  let drag: { x: number; y: number; moved: boolean } | null = $state(null);
  const wheel = (event: WheelEvent) => {
    if (!zoom) return;
    event.preventDefault();
    const [x, y] = point(event);
    // A trackpad pinch arrives as a wheel with ctrlKey and small deltas.
    const step = Math.exp(-event.deltaY * (event.ctrlKey ? 0.01 : 0.002));
    zoom = zoomTo(zoom, zoom.scale * step, x, y);
  };
  let image: HTMLImageElement | undefined = $state(),
    audio: HTMLAudioElement | undefined = $state(),
    frame: HTMLIFrameElement | undefined = $state();
  onMount(() => {
    let active = true;
    const escape = (event: MessageEvent<unknown>) => {
      if (
        active &&
        content.kind === "html" &&
        frame?.isConnected &&
        event.source === frame.contentWindow &&
        typeof event.data === "object" &&
        event.data !== null &&
        "vbViewer" in event.data &&
        event.data.vbViewer === "esc"
      )
        onclose();
    };
    window.addEventListener("message", escape);
    return () => {
      active = false;
      window.removeEventListener("message", escape);
      if (audio) {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      }
      if (frame) frame.src = "about:blank";
      if (image) image.removeAttribute("src");
    };
  });
</script>

{#if zooming && zoom}
  <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events: the title bar has the zoom buttons and the keys (+ − 0) -->
  <div
    bind:this={stage}
    data-image-stage
    class={[
      "relative min-h-0 flex-1 touch-none overflow-hidden select-none",
      isFitted(zoom) ? "cursor-zoom-in" : "cursor-grab active:cursor-grabbing",
    ]}
    onwheel={wheel}
    onpointerdown={(event) => {
      if (event.button !== 0) return;
      drag = { x: event.clientX, y: event.clientY, moved: false };
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onpointermove={(event) => {
      if (!drag || !zoom) return;
      const dx = event.clientX - drag.x,
        dy = event.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 4) return;
      drag = { x: event.clientX, y: event.clientY, moved: true };
      zoom = pan(zoom, dx, dy);
    }}
    onpointerup={(event) => {
      const moved = drag?.moved;
      drag = null;
      if (moved || !zoom) return;
      const [x, y] = point(event);
      zoom = toggle(zoom, x, y);
    }}
    onpointercancel={() => (drag = null)}
  >
    <img
      bind:this={image}
      src={content.url}
      alt={name}
      draggable="false"
      onload={() => {
        natural = {
          width: image?.naturalWidth ?? 0,
          height: image?.naturalHeight ?? 0,
        };
        onready();
      }}
      {onerror}
      use:zoomStyle={{ view: zoom, width: natural.width }}
      class={[
        "absolute top-1/2 left-1/2 block w-(--zoom-w) max-w-none origin-center [transform:translate(calc(-50%_+_var(--zoom-x)),calc(-50%_+_var(--zoom-y)))_scale(var(--zoom-s))]",
        !drag && "transition-transform duration-150 ease-out",
        !natural.width && "invisible",
      ]}
    />
  </div>
{:else if content.kind === "image"}
  <img
    bind:this={image}
    src={content.url}
    alt={name}
    onload={onready}
    {onerror}
    class="mx-auto block max-h-[70dvh] max-w-full object-contain"
  />
{:else if content.kind === "audio"}
  <audio
    bind:this={audio}
    src={content.url}
    controls
    preload="metadata"
    onloadedmetadata={onready}
    {onerror}
    aria-label={name}
    class="mx-auto block w-full max-w-xl"
  ></audio>
{:else if content.kind === "html"}
  <iframe
    bind:this={frame}
    src={content.url}
    title={name}
    sandbox="allow-scripts"
    referrerpolicy="no-referrer"
    onload={onready}
    {onerror}
    class="block h-[70dvh] w-full border-0 bg-background"
  ></iframe>
{:else if content.kind === "pdf"}
  <iframe
    bind:this={frame}
    src={content.url}
    title={name}
    referrerpolicy="no-referrer"
    onload={onready}
    {onerror}
    class="block h-[70dvh] w-full border-0 bg-background"
  ></iframe>
{/if}
