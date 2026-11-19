<script lang="ts">
  import Sheet from "../../lib/studio/Sheet.svelte";
  import SheetContent from "../../lib/studio/SheetContent.svelte";
  import SheetTitle from "../../lib/studio/SheetTitle.svelte";
  import type { WaitReference } from "../waits/model";
  import type { DmEntry, RoomSummary, RoomTarget } from "../home/model";
  import { homeText, type HomeLanguage } from "../home/copy";
  import RoomList from "./RoomList.svelte";
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
    dms = [],
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
    /** Your DMs, after the rooms. */
    dms?: readonly DmEntry[];
    lang: HomeLanguage;
    onhome: () => void;
    onnavigate: (target: RoomTarget) => void;
  } = $props();
  let sheet = $state<HTMLElement | null>(null);
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
    data-view="room-switcher"
    class="max-h-[80dvh] gap-2 outline-none rounded-b-2xl px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 font-sans text-sm"
  >
    <SheetTitle class="sr-only">{homeText(lang, "switchRoom")}</SheetTitle>
    <RoomList
      {rooms}
      {dms}
      {waits}
      {seen}
      {now}
      {current}
      {lang}
      onhome={() => {
        open = false;
        onhome();
      }}
      onnavigate={(target) => {
        open = false;
        onnavigate(target);
      }}
    />
  </SheetContent>
</Sheet>
