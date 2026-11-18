<script lang="ts">
  import Tooltip from "../../lib/studio/Tooltip.svelte";
  import TooltipContent from "../../lib/studio/TooltipContent.svelte";
  import TooltipTrigger from "../../lib/studio/TooltipTrigger.svelte";
  import { cn } from "../../lib/studio/utils";
  import type { WaitReference } from "../waits/model";
  import type { HomeLanguage } from "../home/copy";
  import {
    roomIcon,
    roomStatus,
    targetHref,
    unread,
    type RoomSummary,
    type RoomTarget,
  } from "../home/model";
  import RailPill from "./RailPill.svelte";
  import RoomAvatar from "../rooms/RoomAvatar.svelte";
  /** One room in the rail: its icon or marbled tile, the bar when current, and what waits there. */
  let {
    room,
    lang,
    now,
    seen = 0,
    waits = [],
    selected = false,
    dropping = false,
    dragging = false,
    onnavigate,
    onsettings,
    ondragstart,
    ondragend,
    ondragover,
    ondragleave,
    ondrop,
  }: {
    room: RoomSummary;
    lang: HomeLanguage;
    now: number;
    seen?: number;
    waits?: readonly WaitReference[];
    selected?: boolean;
    /** Another room is being dragged over this one. */
    dropping?: boolean;
    /** This room is the one being dragged. */
    dragging?: boolean;
    onnavigate: (target: RoomTarget) => void;
    onsettings?: (id: string, trigger: HTMLElement) => void;
    ondragstart?: (event: DragEvent) => void;
    ondragend?: (event: DragEvent) => void;
    ondragover?: (event: DragEvent) => void;
    ondragleave?: (event: DragEvent) => void;
    ondrop?: (event: DragEvent) => void;
  } = $props();
  const news = $derived(unread(room, seen));
  const title = $derived(room.title ?? "vibebook");
  const busy = $derived((room.busy_until ?? 0) > now);
  const details = $derived(roomStatus(room, seen, waits, now, lang));
  const icon = $derived(roomIcon(room));
</script>

<article
  data-room-id={room.id}
  class="tw:relative tw:flex tw:items-center tw:justify-center"
  draggable={!!ondragstart}
  ondragstart={(event) => {
    if (event.currentTarget.isConnected) ondragstart?.(event);
  }}
  ondragend={(event) => {
    if (event.currentTarget.isConnected) ondragend?.(event);
  }}
  ondragover={(event) => {
    if (event.currentTarget.isConnected) ondragover?.(event);
  }}
  ondragleave={(event) => {
    if (event.currentTarget.isConnected) ondragleave?.(event);
  }}
  ondrop={(event) => {
    if (event.currentTarget.isConnected) ondrop?.(event);
  }}
  oncontextmenu={(event) => {
    if (!event.currentTarget.isConnected || !onsettings) return;
    event.preventDefault();
    onsettings(
      room.id,
      event.currentTarget.querySelector("a") ?? event.currentTarget,
    );
  }}
>
  <Tooltip>
    <TooltipTrigger>
      {#snippet child({ props })}
        <a
          {...props}
          href={targetHref({ roomId: room.id })}
          aria-label={[title, ...details].join(" · ")}
          aria-current={selected ? "page" : undefined}
          data-room-tint={room.tint ?? undefined}
          class={cn(
            "tw:relative tw:flex tw:size-9 tw:shrink-0 tw:rounded-xl tw:outline-offset-2 tw:transition-opacity tw:duration-150 tw:focus-visible:outline-2 tw:focus-visible:outline-solid tw:focus-visible:outline-ring tw:motion-reduce:transition-none",
            dropping && "tw:outline-2 tw:outline-dashed tw:outline-ring",
            dragging && "tw:opacity-50",
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
          <RailPill state={selected ? "selected" : "idle"} />
          <RoomAvatar
            {title}
            {icon}
            {lang}
            unread={selected ? null : news}
            {busy}
            cloud={!!room.sandboxes_running}
            {waits}
          />
        </a>
      {/snippet}
    </TooltipTrigger>
    <TooltipContent
      side="right"
      sideOffset={8}
      class="tw:flex tw:max-w-64 tw:flex-col tw:gap-0.5 tw:py-1.5 tw:text-left"
    >
      <span>{title}</span>
      {#if room.summary}<span class="tw:font-normal tw:opacity-80"
          >{room.summary}</span
        >{/if}
      {#if details.length}<span class="tw:font-normal tw:opacity-60"
          >{details.join(" · ")}</span
        >{/if}
    </TooltipContent>
  </Tooltip>
</article>
