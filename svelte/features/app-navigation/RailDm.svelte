<script lang="ts">
  import PersonAvatar from "../../lib/components/PersonAvatar.svelte";
  import Tooltip from "../../lib/studio/Tooltip.svelte";
  import TooltipContent from "../../lib/studio/TooltipContent.svelte";
  import TooltipTrigger from "../../lib/studio/TooltipTrigger.svelte";
  import { homeText, type HomeLanguage } from "../home/copy";
  import { targetHref, type DmEntry, type RoomTarget } from "../home/model";
  /**
   * A DM with something new, under Home in the rail (like Discord): the
   * person's picture with a red count at its corner. A click opens the DM.
   */
  let {
    entry,
    count,
    lang,
    onnavigate,
  }: {
    entry: DmEntry;
    count: number;
    lang: HomeLanguage;
    onnavigate: (target: RoomTarget) => void;
  } = $props();
  const label = $derived(
    homeText(lang, "dmUnread", { name: entry.name, n: count }),
  );
</script>

<div role="listitem" data-rail-dm={entry.room.id} class="tw:relative">
  <Tooltip>
    <TooltipTrigger>
      {#snippet child({ props })}
        <a
          {...props}
          href={targetHref({ roomId: entry.room.id })}
          aria-label={label}
          class="tw:relative tw:flex tw:size-9 tw:shrink-0 tw:rounded-full tw:outline-offset-2 tw:focus-visible:outline-2 tw:focus-visible:outline-solid tw:focus-visible:outline-ring"
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
          <span
            aria-hidden="true"
            data-rail-dm-count
            class="tw:absolute tw:-right-1 tw:-bottom-1 tw:flex tw:h-[18px] tw:min-w-[18px] tw:items-center tw:justify-center tw:rounded-full tw:bg-destructive tw:px-1 tw:text-[11px] tw:leading-none tw:font-semibold tw:tabular-nums tw:text-destructive-foreground tw:ring-[3px] tw:ring-sidebar"
            >{count > 99 ? "99+" : count}</span
          >
        </a>
      {/snippet}
    </TooltipTrigger>
    <TooltipContent side="right" sideOffset={8}>{label}</TooltipContent>
  </Tooltip>
</div>
