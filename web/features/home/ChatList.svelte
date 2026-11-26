<script lang="ts">
  import type { MeResult, OrgRoom } from "../../../shared/schemas";
  import Button from "../../lib/studio/Button.svelte";
  import RoomLink from "../app-navigation/RoomLink.svelte";
  import RoomRow from "../app-navigation/RoomRow.svelte";
  import SectionHeader from "../room-sidebar/SectionHeader.svelte";
  import RoomAvatar from "../rooms/RoomAvatar.svelte";
  import {
    roomMenuTrigger,
    type MenuPoint,
  } from "../app-navigation/roomMenuTrigger";
  import { homeText, type HomeLanguage } from "./copy";
  import { byImportance } from "./deskHand";
  import ChatRowEnd from "./ChatRowEnd.svelte";
  import {
    chatList,
    claudeWait,
    dmEntry,
    lastLine,
    homeWaitText,
    roomIcon,
    roomLabel,
    targetHref,
    asksYou,
    unreadCount,
    waitTarget,
    waitsByRoom,
    type RoomTarget,
    type Wait,
  } from "./model";
  /**
   * The phone's home, like a chat app's: what waits on you pinned on top (the
   * most pressing first, a few at most; "See all" opens the rest in place,
   * as WhatsApp does, Gimenes #3942), then every room and DM, the newest message first, each with its
   * avatar (✻, waits), its name, who wrote last and what, and when with the
   * unread count and an @ when it mentions you (ChatRowEnd). A room where an
   * agent works says so in place of its last line. Invites and message
   * requests ("Pedidos") are not here: they are rows of the phone's user
   * center, over this list (HomePanel).
   */
  const PINNED = 3;
  let {
    me,
    seen,
    now,
    lang,
    ago,
    onnavigate,
    onmenu,
    mentioned,
  }: {
    me: MeResult;
    seen: Record<string, number>;
    now: number;
    lang: HomeLanguage;
    ago: (time: number) => string;
    onnavigate: (target: RoomTarget) => void;
    /** Opens a room's or DM's menu (a long press, a right-click, Shift+F10). */
    onmenu?: (id: string, trigger: HTMLElement, point?: MenuPoint) => void;
    /** Rooms with an @ of you not yet seen (the Inbox's mentions); asks waiting on you count without it. */
    mentioned?: ReadonlySet<string>;
  } = $props();
  const mentionsYou = (roomId: string) =>
    !!mentioned?.has(roomId) ||
    (byRoom.get(roomId) ?? []).some((wait) => asksYou(wait));
  const rows = $derived(chatList(me));
  const byRoom = $derived(waitsByRoom(me.waits));
  const waits = $derived(byImportance(me.waits));
  let expanded = $state(false);
  const pinned = $derived(expanded ? waits : waits.slice(0, PINNED));
  const who = (wait: Wait) =>
    claudeWait(wait)
      ? homeText(lang, "yourClaude")
      : wait.author === "ai"
        ? "@vibe"
        : (wait.author_name || wait.author.split("@")[0] || "").split(" ")[0];
  const place = (wait: Wait) =>
    roomLabel(me, wait.book_id, wait.room, lang) +
    (wait.topic ? ` · ${wait.topic}` : "");
</script>

<nav data-home-chats aria-label={homeText(lang, "chats")} class="w-full">
  {#if pinned.length}<section data-home-waiting class="mb-2">
      <SectionHeader
        level={4}
        title={homeText(lang, "waiting", { n: waits.length })}
      />
      <ul class="m-0 list-none space-y-0.5 p-0">
        {#each pinned as wait (wait.book_id + wait.ref)}{@const room =
            me.books.find((book) => book.id === wait.book_id)}{@const dm =
            dmEntry(me, wait.book_id)}
          <li>
            <RoomRow
              href={targetHref(waitTarget(wait))}
              label={place(wait)}
              meta={`${who(wait)}: ${homeWaitText(wait, lang)}`}
              urgent
              variant="chats"
              onopen={() => onnavigate(waitTarget(wait))}
            >
              {#snippet leading()}<RoomAvatar
                  size="chat"
                  title={dm ? dm.name : wait.room}
                  icon={room ? roomIcon(room) : undefined}
                  person={dm}
                  {lang}
                  surface="background"
                />{/snippet}
              {#snippet trailing()}<ChatRowEnd
                  time={ago(wait.ts)}
                  mention={asksYou(wait)}
                  {lang}
                />{/snippet}
            </RoomRow>
          </li>{/each}
      </ul>
      {#if waits.length > PINNED}<Button
          variant="ghost"
          size="sm"
          class="ml-1"
          data-home-waiting-more
          aria-expanded={expanded}
          onclick={() => (expanded = !expanded)}
          >{expanded
            ? homeText(lang, "showLess")
            : homeText(lang, "seeAllWaiting", { n: waits.length })}</Button
        >{/if}
    </section>
    <SectionHeader level={4} title={homeText(lang, "chats")} />{/if}
  <ul class="m-0 list-none space-y-0.5 p-0">
    {#each rows as { room, dm } (room.id)}
      <li
        use:roomMenuTrigger={onmenu
          ? (trigger, point) => onmenu(room.id, trigger, point)
          : undefined}
      >
        <RoomLink
          {room}
          {dm}
          selfLabel={homeText(lang, "you")}
          seen={seen[room.id] ?? 0}
          waits={byRoom.get(room.id) ?? []}
          {now}
          {lang}
          variant="chats"
          line={(room.busy_until ?? 0) > now
            ? homeText(lang, "agentWorking")
            : lastLine(room, me, lang, dm) || homeText(lang, "noMessages")}
          {onnavigate}
        >
          {#snippet trailing()}<ChatRowEnd
              time={room.updated_at ? ago(room.updated_at) : null}
              unread={unreadCount(room, seen[room.id] ?? 0)}
              mention={mentionsYou(room.id)}
              {lang}
            />{/snippet}
        </RoomLink>
      </li>{/each}
  </ul>
</nav>
