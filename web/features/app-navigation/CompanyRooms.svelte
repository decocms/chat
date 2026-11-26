<script lang="ts">
  import { MediaQuery } from "svelte/reactivity";
  import { MOBILE_QUERY } from "../../lib/breakpoints";
  import Button from "../../lib/studio/Button.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import Popover from "../../lib/studio/Popover.svelte";
  import PopoverContent from "../../lib/studio/PopoverContent.svelte";
  import PopoverTrigger from "../../lib/studio/PopoverTrigger.svelte";
  import Sheet from "../../lib/studio/Sheet.svelte";
  import SheetContent from "../../lib/studio/SheetContent.svelte";
  import SheetTitle from "../../lib/studio/SheetTitle.svelte";
  import RoomAvatar from "../rooms/RoomAvatar.svelte";
  import RailButton from "./RailButton.svelte";
  import { homeText, type HomeLanguage } from "../home/copy";
  import type { OrgRoom } from "../../../shared/schemas";
  /**
   * "Salas da empresa": a 2×2 grid button that opens the rooms open to your
   * company email domain that you did not join (GET /api/org/rooms), each with
   * who opened it and Entrar (joins and opens it). They stay out of the room
   * list, so it only holds the rooms you are in. On the rail (desktop) it sits
   * right above search and opens a popover beside it; on a phone (the Chats
   * bar, above the search field) it opens a sheet from the bottom.
   */
  let {
    rooms,
    lang,
    phone = false,
    onjoin,
    onopen,
  }: {
    rooms: readonly OrgRoom[];
    lang: HomeLanguage;
    /** The phone bar's round button instead of the rail's. */
    phone?: boolean;
    /** Joins a room open to your company and opens it. */
    onjoin?: (room: string) => Promise<void>;
    /** Called each time the list opens: reads it again. */
    onopen?: () => void;
  } = $props();
  const mobile = new MediaQuery(MOBILE_QUERY);
  let open = $state(false),
    busy = $state<string | null>(null),
    failed = $state<string | null>(null),
    sheet = $state<HTMLElement | null>(null);
  const label = $derived(homeText(lang, "companyRooms"));
  function opened(next: boolean) {
    if (!next) return;
    failed = null;
    onopen?.();
  }
  async function join(room: string) {
    if (busy || !onjoin) return;
    busy = room;
    failed = null;
    try {
      await onjoin(room);
      open = false;
    } catch {
      failed = room;
    } finally {
      busy = null;
    }
  }
</script>

{#snippet trigger(props: Record<string, unknown>)}{#if phone}<Button
      {...props}
      variant="secondary"
      data-company-rooms-button
      aria-label={label}
      class="size-10 shrink-0 rounded-full p-0"
      ><Icon icon="grid-01" class="size-5" /></Button
    >{:else}<RailButton
      {...props}
      icon="grid-01"
      {label}
      data-company-rooms-button
    />{/if}{/snippet}

{#snippet list()}{#if rooms.length === 0}<p
      data-company-rooms-empty
      class="m-0 px-2 py-6 text-center text-sm text-muted-foreground"
    >
      {homeText(lang, "companyRoomsEmpty")}
    </p>{:else}<ul
      class="m-0 flex min-h-0 list-none flex-col gap-0.5 overflow-y-auto overscroll-contain p-0"
    >
      {#each rooms as room (room.id)}{@const who =
          room.opened_by_name || room.opened_by || ""}
        <li
          data-company-room={room.id}
          class="flex min-h-12 min-w-0 items-center gap-3 rounded-lg px-2 py-1.5"
        >
          <RoomAvatar
            size={mobile.current ? "md" : "sm"}
            title={room.title}
            {lang}
            surface="background"
          />
          <span class="flex min-w-0 flex-1 flex-col">
            <span class="truncate text-sm font-medium">{room.title}</span>
            <span class="truncate text-xs leading-4 text-muted-foreground"
              >{homeText(lang, room.people === 1 ? "openedByOne" : "openedBy", {
                who,
                n: room.people,
              })}</span
            >
            {#if failed === room.id}<span
                role="alert"
                class="text-xs leading-4 text-destructive"
                >{homeText(lang, "requestFailed")}</span
              >{/if}
          </span>
          <Button
            size="xs"
            class="shrink-0"
            disabled={!!busy || !onjoin}
            aria-busy={busy === room.id || undefined}
            onclick={() => join(room.id)}>{homeText(lang, "join")}</Button
          >
        </li>{/each}
    </ul>{/if}{/snippet}

{#if mobile.current}{@render trigger({
    "aria-haspopup": "dialog",
    "aria-expanded": open,
    onclick: () => {
      open = true;
      opened(true);
    },
  })}
  <Sheet bind:open>
    <SheetContent
      side="bottom"
      hideCloseButton
      bind:ref={sheet}
      onOpenAutoFocus={(event) => {
        // Focus the sheet, not its ×: no ring or tooltip on open, Tab still walks the rows.
        event.preventDefault();
        sheet?.focus();
      }}
      tabindex={-1}
      data-company-rooms
      class="max-h-[80dvh] gap-2 outline-none rounded-t-2xl px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] font-sans"
    >
      <span
        aria-hidden="true"
        class="mx-auto h-1 w-9 shrink-0 rounded-full bg-border"
      ></span>
      <div class="flex items-center gap-2 pl-2">
        <SheetTitle class="m-0 min-w-0 flex-1 truncate text-base font-semibold"
          >{label}</SheetTitle
        >
        <IconButton
          size="icon-sm"
          label={homeText(lang, "close")}
          class="text-muted-foreground"
          onclick={() => (open = false)}><Icon icon="x" /></IconButton
        >
      </div>
      {@render list()}
    </SheetContent>
  </Sheet>{:else}<Popover bind:open onOpenChange={opened}>
    <PopoverTrigger>
      {#snippet child({ props })}{@render trigger(props)}{/snippet}
    </PopoverTrigger>
    <PopoverContent
      side={phone ? "bottom" : "right"}
      align="end"
      sideOffset={8}
      data-company-rooms
      aria-label={label}
      class="flex max-h-[min(28rem,calc(100dvh-2rem))] w-80 max-w-[calc(100vw-16px)] flex-col gap-1 p-1.5 font-sans text-foreground"
    >
      <p class="m-0 px-2 pt-1.5 pb-1 text-sm font-semibold">{label}</p>
      {@render list()}
    </PopoverContent>
  </Popover>{/if}
