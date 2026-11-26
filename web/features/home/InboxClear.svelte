<script lang="ts">
  import type { Snippet } from "svelte";
  import type { MeResult } from "../../../shared/schemas";
  import { cn } from "../../lib/studio/utils";
  import RoomAvatar from "../rooms/RoomAvatar.svelte";
  import VibeCube from "./VibeCube.svelte";
  import { homeText, type HomeLanguage } from "./copy";
  import { enter } from "./enter";
  import {
    agentLine,
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
   * in now (whose agent, and what it said last) and the rooms that moved
   * last, one click away. Each row opens its room. Desk: anchored at the top,
   * one left edge for the header, the labels and the rows. It enters once
   * (enter.ts); nothing else moves but the live dot.
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
  class={cn(
    "flex w-full flex-col",
    layout === "desk"
      ? "max-w-[560px] gap-8 px-8 pt-36 pb-12"
      : "items-center gap-6 px-4 pt-8 pb-4",
  )}
>
  <header
    class={cn(
      "flex",
      layout === "desk"
        ? "items-center gap-4 pb-2"
        : "flex-col items-center gap-3 text-center",
      enter(0),
    )}
  >
    <VibeCube size={layout === "desk" ? "xl" : "base"} class="shrink-0" />
    <div class="flex min-w-0 flex-col gap-1">
      <h2
        class={cn(
          "m-0 font-semibold tracking-tight text-balance text-foreground",
          layout === "desk" ? "text-2xl" : "text-lg",
        )}
      >
        {title}
      </h2>
      {#if clear || status}<p
          class="m-0 text-sm text-balance text-muted-foreground"
        >
          {clear ? homeText(lang, "clearNobody") : ""}
          {status}
        </p>{/if}
    </div>
  </header>
  {#if children}<div class={cn("w-full", enter(1))}>
      {@render children()}
    </div>{/if}
  {#if rooms.working.length}{@render group(
      "now",
      homeText(lang, "clearNow"),
      rooms.working,
      children ? 2 : 1,
    )}{/if}
  {#if layout === "desk" && rooms.recent.length}{@render group(
      "recent",
      homeText(lang, "clearRecent"),
      rooms.recent,
      1 + rooms.working.length + 1,
    )}{/if}
</div>

{#snippet group(
  id: string,
  label: string,
  list: RoomSummary[],
  from: number,
)}<section
    data-inbox-clear-group={id}
    aria-label={label}
    class="flex w-full flex-col"
  >
    <h3
      class={cn(
        "m-0 flex h-6 items-center gap-2 text-xs font-medium text-muted-foreground",
        enter(from),
      )}
    >
      <!-- The live dot: the app's online colour (PresenceDot), always solid; a ring grows and fades behind it. -->
      {#if id === "now"}<span
          aria-hidden="true"
          class="relative flex size-2 shrink-0"
          ><span
            class="absolute inset-0 animate-ping rounded-full bg-brand motion-reduce:hidden"
          ></span><span class="relative size-2 rounded-full bg-brand"
          ></span></span
        >{/if}{label}
    </h3>
    <!-- Rows hang into the gutter (-mx-2) so their avatars sit on the header's and the label's left edge. -->
    <ul class="-mx-2 my-0 list-none p-0">
      {#each list as room, index (room.id)}{@const dm = dmEntry(
          me,
          room.id,
        )}{@const name = roomLabel(
          me,
          room.id,
          room.title ?? "deco.chat",
          lang,
        )}{@const busy = (room.busy_until ?? 0) > now}{@const said = busy
          ? agentLine(room, me, lang)
          : null}
        <li class={enter(from + 1 + index)}>
          <a
            data-inbox-clear-room={room.id}
            href={targetHref({ roomId: room.id })}
            class="flex h-14 min-w-0 items-center gap-3 rounded-lg px-2 text-foreground no-underline outline-none transition-[background-color,transform] duration-150 ease-[var(--vb-ease-out-quint)] hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97] motion-reduce:active:scale-100"
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
              ><span class="truncate text-sm font-medium">{name}</span><span
                class="truncate text-xs text-muted-foreground"
                >{#if busy && said}<span class="text-foreground"
                    >{said.who}</span
                  >: {said.text}{:else if busy}{homeText(
                    lang,
                    "busy",
                  )}{:else}{lastLine(room, me, lang, dm)}{/if}</span
              ></span
            ><span
              class="w-12 shrink-0 self-start pt-3 text-right text-xs text-muted-foreground tabular-nums"
              >{#if busy}{homeText(
                  lang,
                  "clearLive",
                )}{:else if room.updated_at}{ago(room.updated_at)}{/if}</span
            ></a
          >
        </li>{/each}
    </ul>
  </section>{/snippet}
