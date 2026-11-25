<script lang="ts">
  import Count from "../../lib/components/Count.svelte";
  import PersonAvatar from "../../lib/components/PersonAvatar.svelte";
  import Tooltip from "../../lib/studio/Tooltip.svelte";
  import TooltipContent from "../../lib/studio/TooltipContent.svelte";
  import TooltipTrigger from "../../lib/studio/TooltipTrigger.svelte";
  import { homeText, type HomeLanguage } from "../home/copy";
  import { targetHref, type DmEntry, type RoomTarget } from "../home/model";
  import { roomMenuTrigger, type MenuPoint } from "./roomMenuTrigger";
  /**
   * A DM with something new, under Home in the rail (like Discord): the
   * person's picture with the new messages as the one number at its top
   * right, the same Count as a room's waits (a DM message is addressed to
   * you). A click opens the DM.
   */
  let {
    entry,
    count,
    lang,
    onnavigate,
    onmenu,
  }: {
    entry: DmEntry;
    count: number;
    lang: HomeLanguage;
    onnavigate: (target: RoomTarget) => void;
    /** Opens the DM's menu (a right-click, a long press, Shift+F10). */
    onmenu?: (id: string, trigger: HTMLElement, point?: MenuPoint) => void;
  } = $props();
  const label = $derived(
    homeText(lang, "dmUnread", { name: entry.name, n: count }),
  );
</script>

<div
  role="listitem"
  data-rail-dm={entry.room.id}
  class="relative"
  use:roomMenuTrigger={onmenu
    ? (trigger, point) => onmenu(entry.room.id, trigger, point)
    : undefined}
>
  <Tooltip>
    <TooltipTrigger>
      {#snippet child({ props })}
        <a
          {...props}
          href={targetHref({ roomId: entry.room.id })}
          aria-label={label}
          class="relative flex size-9 shrink-0 rounded-full outline-offset-2 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring"
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
            onnavigate({ roomId: entry.room.id });
          }}
        >
          <PersonAvatar size="md" email={entry.email} version={entry.version} />
          <span data-rail-dm-count class="absolute -top-1.5 -right-1.5 flex"
            ><Count value={count} {label} class="ring-2 ring-sidebar" /></span
          >
        </a>
      {/snippet}
    </TooltipTrigger>
    <TooltipContent side="right" sideOffset={8}>{label}</TooltipContent>
  </Tooltip>
</div>
