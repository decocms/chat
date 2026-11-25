<script lang="ts">
  import type { WaitReference } from "../waits/model";
  import Tooltip from "../../lib/studio/Tooltip.svelte";
  import TooltipContent from "../../lib/studio/TooltipContent.svelte";
  import TooltipTrigger from "../../lib/studio/TooltipTrigger.svelte";
  import RoomAvatar from "../rooms/RoomAvatar.svelte";
  import type { AvatarSize } from "../../lib/studio/avatar";
  import {
    roomIcon,
    roomStatus,
    targetHref,
    unread,
    type RoomSummary,
    type RoomTarget,
  } from "./model";
  import type { HomeLanguage } from "./copy";
  import {
    roomMenuTrigger,
    type MenuPoint,
  } from "../app-navigation/roomMenuTrigger";
  /** A room in the home grid: the same RoomAvatar as the rail, with its name under it. */
  let {
    room,
    lang,
    now,
    seen = 0,
    waits = [],
    size = "md",
    onnavigate,
    onmenu,
  }: {
    room: RoomSummary;
    lang: HomeLanguage;
    now: number;
    seen?: number;
    waits?: readonly WaitReference[];
    size?: AvatarSize;
    onnavigate: (target: RoomTarget) => void;
    /** Opens the room's menu (a right-click, a long press, Shift+F10). */
    onmenu?: (id: string, trigger: HTMLElement, point?: MenuPoint) => void;
  } = $props();
  const news = $derived(unread(room, seen));
  const title = $derived(room.title ?? "deco.chat");
  const busy = $derived((room.busy_until ?? 0) > now);
  // The same words, in the same order, as the rail's tooltip.
  const description = $derived(
    [title, ...roomStatus(room, seen, waits, now, lang)].join(" · "),
  );
</script>

<article
  data-room-id={room.id}
  class="min-w-0"
  use:roomMenuTrigger={onmenu
    ? (trigger, point) => onmenu(room.id, trigger, point)
    : undefined}
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
