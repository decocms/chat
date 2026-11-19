<script lang="ts">
  import { waitIndicator, type WaitReference } from "../waits/model";
  import Tooltip from "../../lib/studio/Tooltip.svelte";
  import TooltipContent from "../../lib/studio/TooltipContent.svelte";
  import TooltipTrigger from "../../lib/studio/TooltipTrigger.svelte";
  import RoomAvatar from "../rooms/RoomAvatar.svelte";
  import type { AvatarSize } from "../../lib/studio/avatar";
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
    size = "md",
    onnavigate,
    onsettings,
  }: {
    room: RoomSummary;
    lang: HomeLanguage;
    now: number;
    seen?: number;
    waits?: readonly WaitReference[];
    size?: AvatarSize;
    onnavigate: (target: RoomTarget) => void;
    onsettings?: (id: string, trigger: HTMLElement) => void;
  } = $props();
  const news = $derived(unread(room, seen));
  const waiting = $derived(waitIndicator(waits));
  const title = $derived(room.title ?? "deco.chat");
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
  class="min-w-0"
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
          class="flex min-w-0 flex-col items-center gap-1.5 rounded-control p-1 text-foreground no-underline outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
            {size}
            surface="background"
            unread={news}
            {busy}
            cloud={!!room.sandboxes_running}
            {waits}
          /><span class="w-full truncate text-center text-xs leading-4"
            >{title}</span
          ></a
        >{/snippet}</TooltipTrigger
    ><TooltipContent side="bottom" sideOffset={4} collisionPadding={8}
      >{title}</TooltipContent
    ></Tooltip
  >
</article>
