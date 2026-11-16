<script lang="ts">
  import WaitBadge from "../waits/WaitBadge.svelte";
  import { waitIndicator, type WaitReference } from "../waits/model";
  import IconButton from "../../lib/ui/IconButton.svelte";
  import Icon from "../../lib/ui/Icon.svelte";
  import RailPill from "../app-navigation/RailPill.svelte";
  import {
    roomInitials,
    roomIcon,
    roomTint,
    targetHref,
    unread,
    type RoomSummary,
    type RoomTarget,
  } from "./model";
  import { homeText, type HomeLanguage } from "./copy";
  let {
    room,
    lang,
    now,
    seen = 0,
    waits = [],
    compact = false,
    selected = false,
    onnavigate,
    onsettings,
    ondragstart,
    ondragover,
    ondragleave,
    ondrop,
  }: {
    room: RoomSummary;
    lang: HomeLanguage;
    now: number;
    seen?: number;
    waits?: readonly WaitReference[];
    compact?: boolean;
    selected?: boolean;
    onnavigate: (target: RoomTarget) => void;
    onsettings?: (id: string, trigger: HTMLElement) => void;
    ondragstart?: (event: DragEvent) => void;
    ondragover?: (event: DragEvent) => void;
    ondragleave?: (event: DragEvent) => void;
    ondrop?: (event: DragEvent) => void;
  } = $props();
  const news = $derived(unread(room, seen));
  const waiting = $derived(waitIndicator(waits));
  const title = $derived(room.title ?? "vibebook");
  const text = (
    key: Parameters<typeof homeText>[1],
    vars?: Record<string, string | number>,
  ) => homeText(lang, key, vars);
  const description = $derived(
    [
      title,
      news ? text(news === "human" ? "newHuman" : "newAgent") : "",
      (room.busy_until ?? 0) > now ? text("busy") : "",
      room.sandboxes_running ? text("cloud") : "",
      waiting.asks
        ? text("waiting", { n: waiting.asks })
        : waiting.tasks
          ? text("taskPending")
          : "",
    ]
      .filter(Boolean)
      .join(" · "),
  );
</script>

<article
  data-room-id={room.id}
  class={compact
    ? "tw:relative tw:flex tw:items-center tw:justify-center"
    : "tw:relative tw:min-w-0 tw:rounded-surface tw:border tw:border-border tw:bg-card tw:p-4 tw:shadow-xs"}
  draggable={!!ondragstart}
  ondragstart={(event) => {
    if (event.currentTarget.isConnected) ondragstart?.(event);
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
    if (!event.currentTarget.isConnected) return;
    if (onsettings) {
      event.preventDefault();
      onsettings(
        room.id,
        event.currentTarget.querySelector("a") ?? event.currentTarget,
      );
    }
  }}
>
  <a
    href={targetHref({ roomId: room.id })}
    aria-label={description}
    title={compact ? title : undefined}
    aria-current={selected ? "page" : undefined}
    class={compact
      ? "tw:group tw:relative tw:flex tw:size-12 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-control tw:outline-none tw:ring-inset tw:focus-visible:ring-2 tw:focus-visible:ring-ring"
      : "tw:flex tw:min-w-0 tw:flex-col tw:gap-3 tw:rounded-control tw:text-foreground tw:no-underline tw:outline-none tw:focus-visible:ring-2 tw:focus-visible:ring-ring"}
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
    {#if compact}<RailPill
        state={selected ? "selected" : news ? "unread" : "idle"}
      />{/if}
    <span
      class={[
        compact ? "tw:size-10" : "tw:h-28 tw:w-full",
        "tw:relative tw:inline-grid tw:place-items-center tw:overflow-hidden tw:rounded-control tw:text-xl tw:font-semibold",
        roomTint(room),
      ]}
    >
      {#if roomIcon(room)}<img
          src={roomIcon(room)}
          alt=""
          loading="lazy"
          class="tw:size-full tw:object-cover"
        />{:else}{roomInitials(title)}{/if}
      {#if !compact}
        {#if news}<span
            role="img"
            aria-label={text(news === "human" ? "newHuman" : "newAgent")}
            class={news === "human"
              ? "tw:absolute tw:right-1 tw:top-0 tw:text-primary"
              : "tw:absolute tw:right-1 tw:top-0 tw:text-warning"}>●</span
          >{/if}
        {#if (room.busy_until ?? 0) > now}<span
            role="img"
            aria-label={text("busy")}
            class="tw:absolute tw:bottom-0 tw:left-1 tw:text-primary tw:motion-safe:animate-spin"
            >✻</span
          >{/if}
        {#if room.sandboxes_running}<span
            role="img"
            aria-label={text("cloud")}
            class="tw:absolute tw:bottom-0 tw:right-1 tw:text-warning">☁</span
          >{/if}
      {/if}
    </span>
    {#if compact}
      {#if news}<span
          role="img"
          aria-label={text(news === "human" ? "newHuman" : "newAgent")}
          data-room-badge={news === "human" ? "unread-human" : "unread-agent"}
          class={[
            "tw:absolute tw:right-0.5 tw:top-0.5 tw:size-3 tw:rounded-full tw:ring-2 tw:ring-background",
            news === "human" ? "tw:bg-primary" : "tw:bg-warning",
          ]}
        ></span>{/if}
      {#if (room.busy_until ?? 0) > now}<span
          role="img"
          aria-label={text("busy")}
          data-room-badge="busy"
          class="tw:absolute tw:bottom-0.5 tw:left-0.5 tw:size-3.5 tw:rounded-full tw:border-2 tw:border-primary tw:border-t-transparent tw:bg-background tw:ring-2 tw:ring-background tw:motion-safe:animate-spin"
        ></span>{/if}
      {#if room.sandboxes_running}<span
          role="img"
          aria-label={text("cloud")}
          data-room-badge="cloud"
          class="tw:absolute tw:left-0 tw:top-0 tw:grid tw:size-4 tw:place-items-center tw:rounded-full tw:bg-background tw:text-warning tw:ring-2 tw:ring-background"
          ><Icon name="cloud" class="tw:size-2.5" /></span
        >{/if}
    {/if}
    {#if !compact}<b
        class="tw:break-words tw:pr-8 tw:text-base tw:font-semibold">{title}</b
      >
      <p
        class="tw:m-0 tw:line-clamp-3 tw:break-words tw:text-sm tw:text-muted-foreground"
      >
        {room.summary || text("summary")}
      </p>{/if}
    <WaitBadge
      {waits}
      label={(n) => text("waiting", { n })}
      taskLabel={text("taskPending")}
      solid={compact}
      class={compact
        ? "tw:absolute tw:bottom-0.5 tw:right-0.5 tw:ring-2 tw:ring-background"
        : ""}
    />
  </a>
  {#if onsettings && !compact}<IconButton
      icon="chevronDown"
      label={text("roomSettings", { title })}
      class="tw:absolute tw:right-2 tw:top-2"
      onclick={(event) => {
        if (event.currentTarget.isConnected)
          onsettings?.(room.id, event.currentTarget);
      }}
    />{/if}
</article>
