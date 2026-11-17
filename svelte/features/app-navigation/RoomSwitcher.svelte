<script lang="ts">
  import Sheet from "../../lib/studio/Sheet.svelte";
  import SheetContent from "../../lib/studio/SheetContent.svelte";
  import SheetTitle from "../../lib/studio/SheetTitle.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import Count from "../../lib/components/Count.svelte";
  import { Home02 } from "../../lib/studio/icons";
  import { cn } from "../../lib/studio/utils";
  import RoomAvatar from "../rooms/RoomAvatar.svelte";
  import type { WaitReference } from "../waits/model";
  import {
    orderedRooms,
    roomIcon,
    targetHref,
    unread,
    type RoomSummary,
    type RoomTarget,
  } from "../home/model";
  import { homeText, type HomeLanguage } from "../home/copy";
  /**
   * The phone's room switcher: a sheet from the top with Home and every room,
   * each drawn with the same RoomAvatar as the desktop rail. Controlled: the
   * caller owns `open` and passes the rooms, waits and read marks.
   */
  let {
    open = $bindable(false),
    rooms,
    waits,
    seen,
    now,
    current = null,
    lang,
    onhome,
    onnavigate,
  }: {
    open?: boolean;
    rooms: readonly RoomSummary[];
    waits: readonly (WaitReference & { book_id: string })[];
    seen: Record<string, number>;
    now: number;
    /** The open room's id; null on Home. */
    current?: string | null;
    lang: HomeLanguage;
    onhome: () => void;
    onnavigate: (target: RoomTarget) => void;
  } = $props();
  const text = (
    key: Parameters<typeof homeText>[1],
    vars?: Record<string, string | number>,
  ) => homeText(lang, key, vars);
  let sheet = $state<HTMLElement | null>(null);
  const plain = (event: MouseEvent) =>
    !(event.ctrlKey || event.metaKey || event.shiftKey || event.altKey);
  const row =
    "tw:flex tw:min-h-12 tw:items-center tw:gap-3 tw:rounded-control tw:px-2 tw:text-foreground tw:no-underline tw:outline-none tw:hover:bg-accent tw:focus-visible:ring-2 tw:focus-visible:ring-ring";
</script>

<Sheet bind:open>
  <SheetContent
    side="top"
    hideCloseButton
    bind:ref={sheet}
    onOpenAutoFocus={(event) => {
      // Focus the sheet, not the first row: no ring on open, Tab still walks the rows.
      event.preventDefault();
      sheet?.focus();
    }}
    tabindex={-1}
    data-vb-native="room-switcher"
    class="tw:max-h-[80dvh] tw:gap-2 tw:outline-none tw:rounded-b-2xl tw:px-3 tw:pt-[max(0.75rem,env(safe-area-inset-top))] tw:pb-3 tw:font-sans tw:text-sm"
  >
    <SheetTitle class="tw:sr-only">{text("switchRoom")}</SheetTitle>
    <nav aria-label={text("switchRoom")} class="tw:min-h-0 tw:overflow-y-auto">
      <ul class="tw:m-0 tw:list-none tw:space-y-0.5 tw:p-0">
        <li>
          <a
            href="/app?ui=svelte"
            aria-current={current ? undefined : "page"}
            class={cn(row, !current && "tw:bg-accent")}
            onclick={(event) => {
              if (!plain(event)) return;
              event.preventDefault();
              open = false;
              onhome();
            }}
            ><span
              class="tw:grid tw:size-9 tw:shrink-0 tw:place-items-center tw:rounded-[0.6875rem] tw:bg-muted"
              ><Icon icon={Home02} /></span
            ><b class="tw:min-w-0 tw:flex-1 tw:truncate tw:font-semibold"
              >{text("startTitle")}</b
            >{#if waits.length}<Count
                value={waits.length}
                label={text("waiting", { n: waits.length })}
              />{/if}</a
          >
        </li>
        {#each orderedRooms(rooms) as room (room.id)}{@const title =
            room.title ?? "vibebook"}
          <li>
            <a
              href={targetHref({ roomId: room.id })}
              aria-current={current === room.id ? "page" : undefined}
              class={cn(row, current === room.id && "tw:bg-accent")}
              onclick={(event) => {
                if (!plain(event)) return;
                event.preventDefault();
                open = false;
                onnavigate({ roomId: room.id });
              }}
              ><RoomAvatar
                {title}
                icon={roomIcon(room)}
                {lang}
                surface="background"
                unread={current === room.id
                  ? null
                  : unread(room, seen[room.id] ?? 0)}
                busy={(room.busy_until ?? 0) > now}
                cloud={!!room.sandboxes_running}
                waits={waits.filter((wait) => wait.book_id === room.id)}
              /><span class="tw:min-w-0 tw:flex-1 tw:truncate">{title}</span></a
            >
          </li>{/each}
      </ul>
    </nav>
  </SheetContent>
</Sheet>
