<script lang="ts">
  import type { WaitReference } from "../waits/model";
  import SectionHeader from "../room-sidebar/SectionHeader.svelte";
  import {
    orderedRooms,
    waitsByRoom,
    type DmEntry,
    type RoomSummary,
    type RoomTarget,
  } from "../home/model";
  import { homeText, type HomeLanguage } from "../home/copy";
  import HomeRow from "./HomeRow.svelte";
  import RoomLink from "./RoomLink.svelte";
  /**
   * Home, every room in the rail's order, then your DMs (`dms`), each with the
   * rail's RoomAvatar (unread dot, ✻, waits). The phone's room switcher sheet
   * and the thread sheet's All rooms tab both draw it.
   */
  let {
    rooms,
    dms = [],
    waits,
    seen,
    now,
    current = null,
    lang,
    onhome,
    onnavigate,
  }: {
    rooms: readonly RoomSummary[];
    dms?: readonly DmEntry[];
    waits: readonly (WaitReference & { book_id: string })[];
    seen: Record<string, number>;
    now: number;
    /** The open room's id; null on Home. */
    current?: string | null;
    lang: HomeLanguage;
    onhome: () => void;
    onnavigate: (target: RoomTarget) => void;
  } = $props();
  const byRoom = $derived(waitsByRoom(waits));
</script>

{#snippet link(room: RoomSummary, dm?: DmEntry)}<li>
    <RoomLink
      {room}
      {dm}
      selfLabel={homeText(lang, "you")}
      seen={seen[room.id] ?? 0}
      waits={byRoom.get(room.id) ?? []}
      {now}
      {lang}
      variant="list"
      selected={current === room.id}
      {onnavigate}
    />
  </li>{/snippet}

<nav aria-label={homeText(lang, "switchRoom")} class="min-h-0 overflow-y-auto">
  <ul class="m-0 list-none space-y-0.5 p-0">
    <li>
      <HomeRow
        variant="list"
        selected={!current}
        waits={waits.length}
        {lang}
        {onhome}
      />
    </li>
    {#each orderedRooms(rooms) as room (room.id)}{@render link(room)}{/each}
    {#if dms.length}<li class="mt-3">
        <SectionHeader level={4} title={homeText(lang, "dms")} />
      </li>
      {#each dms as dm (dm.room.id)}{@render link(dm.room, dm)}{/each}{/if}
  </ul>
</nav>
