<script lang="ts">
  import type { MeResult } from "../../../shared/schemas";
  import RoomLink from "../app-navigation/RoomLink.svelte";
  import { homeText, type HomeLanguage } from "./copy";
  import {
    chatList,
    lastLine,
    unread,
    waitsByRoom,
    type RoomTarget,
  } from "./model";
  /**
   * The phone's home, like a chat app's: every room and DM, the newest message
   * first, each with its avatar (unread dot, ✻, waits), its name, who wrote
   * last and what, and when. A tap opens it.
   */
  let {
    me,
    seen,
    now,
    lang,
    ago,
    onnavigate,
  }: {
    me: MeResult;
    seen: Record<string, number>;
    now: number;
    lang: HomeLanguage;
    ago: (time: number) => string;
    onnavigate: (target: RoomTarget) => void;
  } = $props();
  const rows = $derived(chatList(me));
  const byRoom = $derived(waitsByRoom(me.waits));
</script>

<nav data-home-chats aria-label={homeText(lang, "chats")} class="w-full">
  <ul class="m-0 list-none space-y-0.5 p-0">
    {#each rows as { room, dm } (room.id)}{@const fresh = unread(
        room,
        seen[room.id] ?? 0,
      )}
      <li>
        <RoomLink
          {room}
          {dm}
          selfLabel={homeText(lang, "you")}
          seen={seen[room.id] ?? 0}
          waits={byRoom.get(room.id) ?? []}
          {now}
          {lang}
          variant="list"
          line={lastLine(room, me, lang, dm) || homeText(lang, "noMessages")}
          {onnavigate}
        >
          {#snippet trailing()}{#if room.updated_at}<span
                class={[
                  "shrink-0 self-start pt-2 text-xs tabular-nums",
                  fresh
                    ? "font-medium text-foreground"
                    : "text-muted-foreground",
                ]}>{ago(room.updated_at)}</span
              >{/if}{/snippet}
        </RoomLink>
      </li>{/each}
  </ul>
</nav>
