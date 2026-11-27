<script lang="ts">
  import Tooltip from "../../lib/studio/Tooltip.svelte";
  import TooltipContent from "../../lib/studio/TooltipContent.svelte";
  import TooltipTrigger from "../../lib/studio/TooltipTrigger.svelte";
  import { cn } from "../../lib/studio/utils";
  import type { WaitReference } from "../waits/model";
  import type { HomeLanguage } from "../home/copy";
  import {
    callText,
    roomIcon,
    roomStatus,
    targetHref,
    unread,
    type RoomSummary,
    type RoomTarget,
  } from "../home/model";
  import RailPill from "./RailPill.svelte";
  import RoomAvatar from "../rooms/RoomAvatar.svelte";
  import { roomMenuTrigger, type MenuPoint } from "./roomMenuTrigger";
  /** One room in the rail: its icon or marbled tile, the edge mark (the bar when current, a dot when new), and what waits there. */
  let {
    room,
    lang,
    now,
    seen = 0,
    waits = [],
    selected = false,
    onnavigate,
    onmenu,
  }: {
    room: RoomSummary;
    lang: HomeLanguage;
    now: number;
    seen?: number;
    waits?: readonly WaitReference[];
    selected?: boolean;
    onnavigate: (target: RoomTarget) => void;
    /** Opens the room's menu (a right-click, a long press, Shift+F10). */
    onmenu?: (id: string, trigger: HTMLElement, point?: MenuPoint) => void;
  } = $props();
  // New messages are the rail's edge mark (like Discord), not a number: the open room shows its bar instead.
  const news = $derived(unread(room, seen));
  const pill = $derived(selected ? "selected" : (news ?? "idle"));
  const title = $derived(room.title ?? "deco.chat");
  const busy = $derived((room.busy_until ?? 0) > now);
  const details = $derived(roomStatus(room, seen, waits, now, lang));
  const icon = $derived(roomIcon(room));
  const call = $derived(callText(room, lang) || null);
</script>

<!-- Sorted by dnd-kit from the rail's list (AppNavigation); the browser's own drag of the link is off. -->
<article
  data-room-id={room.id}
  class="relative flex touch-pan-y items-center justify-center select-none"
  ondragstart={(event) => event.preventDefault()}
  use:roomMenuTrigger={onmenu
    ? (trigger, point) => onmenu(room.id, trigger, point)
    : undefined}
>
  <Tooltip>
    <TooltipTrigger>
      {#snippet child({ props })}
        <a
          {...props}
          href={targetHref({ roomId: room.id })}
          draggable="false"
          aria-label={[title, ...details].join(" · ")}
          aria-current={selected ? "page" : undefined}
          aria-keyshortcuts={onmenu ? "Shift+F10" : undefined}
          data-room-tint={room.tint ?? undefined}
          class={cn(
            "relative flex size-9 shrink-0 rounded-xl outline-offset-2 transition-opacity duration-150 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring motion-reduce:transition-none",
          )}
          onclick={(event) => {
            if (
              !event.currentTarget.isConnected ||
              event.ctrlKey ||
              event.metaKey ||
              event.shiftKey ||
              event.altKey ||
              event.button !== 0
            )
              return;
            event.preventDefault();
            onnavigate({ roomId: room.id });
          }}
        >
          <RailPill state={pill} />
          <RoomAvatar {title} {icon} {lang} {busy} {waits} {call} stack />
        </a>
      {/snippet}
    </TooltipTrigger>
    <TooltipContent
      side="right"
      sideOffset={8}
      class="flex max-w-64 flex-col gap-0.5 py-1.5 text-left"
    >
      <span>{title}</span>
      {#if room.summary}<span class="font-normal opacity-80"
          >{room.summary}</span
        >{/if}
      {#if details.length}<span class="font-normal opacity-60"
          >{details.join(" · ")}</span
        >{/if}
    </TooltipContent>
  </Tooltip>
</article>
