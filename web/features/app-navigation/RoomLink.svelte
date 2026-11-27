<script lang="ts">
  import type { Snippet } from "svelte";
  import RoomAvatar from "../rooms/RoomAvatar.svelte";
  import type { NavRowVariant } from "../../lib/components/navRow";
  import type { AvatarSize } from "../../lib/studio/avatar";
  import { waitCount, type WaitReference } from "../waits/model";
  import { homeText, type HomeLanguage } from "../home/copy";
  import {
    callText,
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
    line,
    variant = "sidebar",
    online,
    children,
    trailing,
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
    /** A fixed line under the name (the phone's list: the newest message), in place of `status`. */
    line?: string;
    variant?: NavRowVariant;
    /** A DM: the other person has the app open (their dot on the avatar). Left out: no dot. */
    online?: boolean;
    children?: Snippet;
    /** At the row's end (the phone's list: when the newest message came). */
    trailing?: Snippet;
    onnavigate: (target: RoomTarget) => void;
  } = $props();
  const title = $derived(
    dm ? (dm.self ? selfLabel : dm.name) : (room.title ?? "deco.chat"),
  );
  const presence = $derived(
    online === undefined
      ? null
      : {
          online,
          label: `${title} · ${homeText(lang, online ? "online" : "offline")}`,
        },
  );
  // The phone's chat list draws unread as WhatsApp does, at the row's end (ChatRowEnd), not on the avatar.
  // The sidebar's rows are small (like a room's epics); the phone's lists keep the big avatar, its home's the biggest.
  const AVATAR = {
    sidebar: "xs",
    list: "md",
    chats: "chat",
  } as const satisfies Record<NavRowVariant, AvatarSize>;
  const meta = $derived(
    line ??
      (status
        ? (roomStatus(room, seen, waits, now, lang)[0] ?? note)
        : undefined),
  );
</script>

<RoomRow
  href={targetHref({ roomId: room.id })}
  label={title}
  {meta}
  urgent={status && waitCount(waits) > 0}
  {selected}
  {faded}
  {variant}
  {children}
  {trailing}
  onopen={() => onnavigate({ roomId: room.id })}
>
  {#snippet leading()}<RoomAvatar
      size={AVATAR[variant]}
      {title}
      icon={roomIcon(room)}
      person={dm}
      {presence}
      {lang}
      surface={variant === "sidebar" ? "sidebar" : "background"}
      unread={selected || variant === "chats" ? null : unread(room, seen)}
      busy={(room.busy_until ?? 0) > now}
      {waits}
      call={callText(room, lang) || null}
    />{/snippet}
</RoomRow>
