<script lang="ts">
  import type { Snippet } from "svelte";
  import type { MeResult } from "../../../shared/schemas";
  import { listRowVariants } from "../../lib/studio/list-row";
  import RoomAvatar from "../rooms/RoomAvatar.svelte";
  import VibeCube from "./VibeCube.svelte";
  import { homeText, type HomeLanguage } from "./copy";
  import {
    dmEntry,
    lastLine,
    quietRooms,
    roomIcon,
    roomLabel,
    targetHref,
    type RoomSummary,
  } from "./model";
  /**
   * The Inbox at zero (the desktop's open-item side, a phone's "Pra você"):
   * the cube, a headline, and what is still moving: the rooms an agent works
   * in now and the rooms that moved last, one click away. Not filler: each row
   * opens its room.
   */
  let {
    me,
    now,
    lang,
    title,
    ago,
    layout = "desk",
    clear = true,
    onopen,
    children,
  }: {
    me: MeResult | null;
    now: number;
    lang: HomeLanguage;
    /** The tab's headline: "Tudo em dia", "Nenhuma menção"… */
    title: string;
    ago: (ts: number) => string;
    /** desk: cube, headline, agents and recent rooms. phone: the recent rooms are the Chats list already. */
    layout?: "desk" | "phone";
    /** Nothing waits on you at all ("Pra você" is empty): the line under the headline says so. */
    clear?: boolean;
    onopen: (roomId: string) => void;
    /** Under the headline: the ways to start (a phone's chips). */
    children?: Snippet;
  } = $props();
  const rooms = $derived(quietRooms(me, now, layout === "desk" ? 4 : 2));
  const working = $derived(rooms.working.length);
  const status = $derived(
    working === 1
      ? homeText(lang, "clearWorkingOne")
      : working
        ? homeText(lang, "clearWorkingMany", { n: working })
        : clear
          ? homeText(lang, "clearHint")
          : "",
  );
</script>

<div
  data-inbox-clear={layout}
  class="flex w-full flex-col items-center gap-8 text-center {layout === 'desk'
    ? 'max-w-md px-6 py-14'
    : 'px-4 pt-8 pb-4'}"
>
  <div class="flex flex-col items-center gap-3">
    <VibeCube size={layout === "desk" ? "xl" : "base"} />
    <div class="flex flex-col gap-1">
      <h2
        class="m-0 font-semibold text-balance text-foreground {layout === 'desk'
          ? 'text-xl'
          : 'text-lg'}"
      >
        {title}
      </h2>
      {#if clear || status}<p class="m-0 text-sm text-muted-foreground">
          {clear ? homeText(lang, "clearNobody") : ""}
          {status}
        </p>{/if}
    </div>
  </div>
  {@render children?.()}
  {#if rooms.working.length}{@render group(
      "now",
      homeText(lang, "clearNow"),
      rooms.working,
    )}{/if}
  {#if layout === "desk" && rooms.recent.length}{@render group(
      "recent",
      homeText(lang, "clearRecent"),
      rooms.recent,
    )}{/if}
</div>

{#snippet group(id: string, label: string, list: RoomSummary[])}<section
    data-inbox-clear-group={id}
    aria-label={label}
    class="flex w-full flex-col gap-1 text-left"
  >
    <h3 class="m-0 px-2 pb-1 text-xs font-medium text-muted-foreground">
      {label}
    </h3>
    {#each list as room (room.id)}{@const dm = dmEntry(
        me,
        room.id,
      )}{@const name = roomLabel(
        me,
        room.id,
        room.title ?? "deco.chat",
        lang,
      )}{@const busy = (room.busy_until ?? 0) > now}<a
        data-inbox-clear-room={room.id}
        href={targetHref({ roomId: room.id })}
        class="{listRowVariants({
          interactive: true,
        })} text-foreground no-underline"
        onclick={(event) => {
          if (
            event.ctrlKey ||
            event.metaKey ||
            event.shiftKey ||
            event.altKey ||
            event.button !== 0
          )
            return;
          event.preventDefault();
          onopen(room.id);
        }}
        ><RoomAvatar
          title={name}
          icon={roomIcon(room)}
          person={dm}
          {lang}
          size="sm"
          surface="background"
          {busy}
        /><span class="flex min-w-0 flex-1 flex-col gap-0.5"
          ><span class="truncate text-sm">{name}</span><span
            class="truncate text-xs text-muted-foreground"
            >{busy
              ? homeText(lang, "busy")
              : lastLine(room, me, lang, dm)}</span
          ></span
        >{#if !busy && room.updated_at}<span
            class="shrink-0 text-xs text-muted-foreground tabular-nums"
            >{ago(room.updated_at)}</span
          >{/if}</a
      >{/each}
  </section>{/snippet}
