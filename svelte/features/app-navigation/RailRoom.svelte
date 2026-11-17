<script lang="ts">
  import OrgAvatar from "../../lib/components/OrgAvatar.svelte";
  import Avatar from "../../lib/studio/Avatar.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import { Cloud01 } from "../../lib/studio/icons";
  import Tooltip from "../../lib/studio/Tooltip.svelte";
  import TooltipContent from "../../lib/studio/TooltipContent.svelte";
  import TooltipTrigger from "../../lib/studio/TooltipTrigger.svelte";
  import { cn } from "../../lib/studio/utils";
  import WaitBadge from "../waits/WaitBadge.svelte";
  import { waitIndicator, type WaitReference } from "../waits/model";
  import { homeText, type HomeLanguage } from "../home/copy";
  import {
    roomIcon,
    targetHref,
    unread,
    type RoomSummary,
    type RoomTarget,
  } from "../home/model";
  import RailPill from "./RailPill.svelte";
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
  const waiting = $derived(waitIndicator(waits));
  const title = $derived(room.title ?? "vibebook");
  const busy = $derived((room.busy_until ?? 0) > now);
  const text = (
    key: Parameters<typeof homeText>[1],
    vars?: Record<string, string | number>,
  ) => homeText(lang, key, vars);
  const details = $derived(
    [
      news ? text(news === "human" ? "newHuman" : "newAgent") : "",
      busy ? text("busy") : "",
      room.sandboxes_running ? text("cloud") : "",
      waiting.asks
        ? text("waiting", { n: waiting.asks })
        : waiting.tasks
          ? text("taskPending")
          : "",
    ].filter(Boolean),
  );
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
          {#if icon}<Avatar
              size="md"
              url={icon}
              fallback={title}
              aria-hidden="true"
              data-room-cover="icon"
            />{:else}<span data-room-cover="marble" class="tw:contents"
              ><OrgAvatar name={title} size="md" /></span
            >{/if}
          {#if news && !selected}<span
              role="img"
              aria-label={text(news === "human" ? "newHuman" : "newAgent")}
              data-room-badge={news === "human"
                ? "unread-human"
                : "unread-agent"}
              class={cn(
                "tw:absolute tw:-top-1 tw:-right-1 tw:size-2.5 tw:rounded-full tw:ring-2 tw:ring-sidebar",
                news === "human" ? "tw:bg-brand" : "tw:bg-warning",
              )}
            ></span>{/if}
          {#if busy}<span
              role="img"
              aria-label={text("busy")}
              data-room-badge="busy"
              class="tw:absolute tw:-bottom-1.5 tw:-left-1.5 tw:flex tw:size-4 tw:items-center tw:justify-center tw:rounded-full tw:bg-sidebar tw:text-xs tw:leading-none tw:text-agent-claude tw:motion-safe:animate-spin"
              >✻</span
            >{/if}
          {#if room.sandboxes_running}<span
              role="img"
              aria-label={text("cloud")}
              data-room-badge="cloud"
              class="tw:absolute tw:-top-1.5 tw:-left-1.5 tw:flex tw:size-4 tw:items-center tw:justify-center tw:rounded-full tw:bg-sidebar tw:text-warning"
              ><Icon icon={Cloud01} size={10} /></span
            >{/if}
          <WaitBadge
            solid
            {waits}
            label={(n) => text("waiting", { n })}
            taskLabel={text("taskPending")}
            class="tw:absolute tw:-right-1.5 tw:-bottom-1.5"
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
