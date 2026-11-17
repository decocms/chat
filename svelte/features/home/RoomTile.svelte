<script lang="ts">
  import { waitIndicator, type WaitReference } from "../waits/model";
  import Tooltip from "../../lib/studio/Tooltip.svelte";
  import TooltipContent from "../../lib/studio/TooltipContent.svelte";
  import TooltipTrigger from "../../lib/studio/TooltipTrigger.svelte";
  import RoomAvatar from "../rooms/RoomAvatar.svelte";
  import {
    roomIcon,
    targetHref,
    unread,
    type RoomSummary,
    type RoomTarget,
  } from "./model";
  import { homeText, type HomeLanguage } from "./copy";
  /** A room in the home grid: the same RoomAvatar as the rail, with its name under it. */
  let {
    room,
    lang,
    now,
    seen = 0,
    waits = [],
    onnavigate,
    onsettings,
  }: {
    room: RoomSummary;
    lang: HomeLanguage;
    now: number;
    seen?: number;
    waits?: readonly WaitReference[];
    onnavigate: (target: RoomTarget) => void;
    onsettings?: (id: string, trigger: HTMLElement) => void;
  } = $props();
  const news = $derived(unread(room, seen));
  const waiting = $derived(waitIndicator(waits));
  const title = $derived(room.title ?? "vibebook");
  const busy = $derived((room.busy_until ?? 0) > now);
  const text = (
    key: Parameters<typeof homeText>[1],
    vars?: Record<string, string | number>,
  ) => homeText(lang, key, vars);
  const description = $derived(
    [
      title,
      news ? text(news === "human" ? "newHuman" : "newAgent") : "",
      busy ? text("busy") : "",
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
  class="tw:min-w-0"
  oncontextmenu={(event) => {
    if (!event.currentTarget.isConnected || !onsettings) return;
    event.preventDefault();
    onsettings(
      room.id,
      event.currentTarget.querySelector("a") ?? event.currentTarget,
    );
  }}
>
  <Tooltip
    ><TooltipTrigger
      >{#snippet child({ props })}<a
          {...props}
          href={targetHref({ roomId: room.id })}
          aria-label={description}
          class="tw:flex tw:min-w-0 tw:flex-col tw:items-center tw:gap-1.5 tw:rounded-control tw:p-1 tw:text-foreground tw:no-underline tw:outline-none tw:focus-visible:ring-2 tw:focus-visible:ring-ring"
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
          ><RoomAvatar
            {title}
            icon={roomIcon(room)}
            {lang}
            surface="background"
            unread={news}
            {busy}
            cloud={!!room.sandboxes_running}
            {waits}
          /><span
            class="tw:line-clamp-2 tw:w-full tw:break-words tw:text-center tw:text-xs tw:leading-4"
            >{title}</span
          ></a
        >{/snippet}</TooltipTrigger
    ><TooltipContent side="bottom" sideOffset={4} collisionPadding={8}
      >{title}</TooltipContent
    ></Tooltip
  >
</article>
