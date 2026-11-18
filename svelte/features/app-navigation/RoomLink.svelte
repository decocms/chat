<script lang="ts">
  import type { Snippet } from "svelte";
  import RoomAvatar from "../rooms/RoomAvatar.svelte";
  import type { NavRowVariant } from "../../lib/components/navRow";
  import type { WaitReference } from "../waits/model";
  import type { HomeLanguage } from "../home/copy";
  import {
    roomIcon,
    roomStatus,
    targetHref,
    unread,
    type DmEntry,
    type RoomSummary,
    type RoomTarget,
  } from "../home/model";
  import RoomRow from "./RoomRow.svelte";
  /**
   * A room as a row: its avatar with the rail's badges (unread, ✻, waits),
   * its name and, with `status`, its most pressing state as a line under it.
   * A DM passes `dm`: the other person's name and face stand for it
   * ("Você" reads `selfLabel`).
   */
  let {
    room,
    dm,
    selfLabel = "",
    seen,
    waits,
    now,
    lang,
    selected = false,
    faded = false,
    status = false,
    note,
    variant = "sidebar",
    children,
    onnavigate,
  }: {
    room: RoomSummary;
    dm?: DmEntry;
    selfLabel?: string;
    seen: number;
    waits: readonly WaitReference[];
    now: number;
    lang: HomeLanguage;
    selected?: boolean;
    faded?: boolean;
    status?: boolean;
    /** The line under the name when nothing is going on (with `status`). */
    note?: string;
    variant?: NavRowVariant;
    children?: Snippet;
    onnavigate: (target: RoomTarget) => void;
  } = $props();
  const title = $derived(
    dm ? (dm.self ? selfLabel : dm.name) : (room.title ?? "vibebook"),
  );
  const meta = $derived(
    status ? (roomStatus(room, seen, waits, now, lang)[0] ?? note) : undefined,
  );
</script>

<RoomRow
  href={targetHref({ roomId: room.id })}
  label={title}
  {meta}
  urgent={status && waits.length > 0}
  {selected}
  {faded}
  {variant}
  {children}
  onopen={() => onnavigate({ roomId: room.id })}
>
  {#snippet leading()}<RoomAvatar
      {title}
      icon={roomIcon(room)}
      person={dm}
      {lang}
      surface={variant === "sidebar" ? "sidebar" : "background"}
      unread={selected ? null : unread(room, seen)}
      busy={(room.busy_until ?? 0) > now}
      cloud={!!room.sandboxes_running}
      {waits}
    />{/snippet}
</RoomRow>
