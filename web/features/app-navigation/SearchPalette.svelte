<script lang="ts">
  import { tick } from "svelte";
  import { Dialog as DialogPrimitive } from "bits-ui";
  import PersonAvatar from "../../lib/components/PersonAvatar.svelte";
  import Button from "../../lib/studio/Button.svelte";
  import Dialog from "../../lib/studio/Dialog.svelte";
  import DialogContent from "../../lib/studio/DialogContent.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import Spinner from "../../lib/studio/Spinner.svelte";
  import { commandItemVariants } from "../../lib/studio/command";
  import { registerDialog } from "../../lib/studio/dialogController";
  import { cn } from "../../lib/studio/utils";
  import { studioType } from "../../lib/components/type";
  import RoomAvatar from "../rooms/RoomAvatar.svelte";
  import { homeText, homeIssue, type HomeLanguage } from "../home/copy";
  import type { MeResult } from "../../../shared/schemas";
  import {
    dmEntry,
    epicTarget,
    messageTarget,
    roomIcon,
    searchRooms,
    targetHref,
    type RoomTarget,
  } from "../home/model";
  import type { SearchSession } from "./search";
  /**
   * Cmd+K: one field, the results in groups (rooms, DMs, epics, what was said),
   * a hint row for the keys. The session owns the query, the highlighted row and
   * where Enter goes; this draws it, with the rows in the session's own order.
   */
  let {
    search,
    me,
    lang,
    live,
    returnFocus,
  }: {
    search: SearchSession;
    me: MeResult | null;
    lang: HomeLanguage;
    /** False once this opening is no longer the one on screen. */
    live: () => boolean;
    returnFocus: () => HTMLElement | null;
  } = $props();
  const view = $derived(search.state);
  const text = (key: Parameters<typeof homeText>[1]) => homeText(lang, key);
  type Row = {
    key: string;
    group: "rooms" | "dms" | "epics" | "messages";
    target: RoomTarget;
    title: string;
    detail: string;
    room?: MeResult["books"][number];
    person?: { email: string; version?: number | null };
  };
  const rows = $derived<Row[]>([
    ...searchRooms(me?.books ?? [], $view.query).map((room): Row => {
      const dm = room.dm ? dmEntry(me, room.id) : undefined;
      return {
        key: "room:" + room.id,
        group: room.dm ? "dms" : "rooms",
        target: { roomId: room.id },
        title: dm
          ? dm.self
            ? homeText(lang, "you")
            : dm.name
          : (room.title ?? "deco.chat"),
        detail: dm ? "" : (room.folder ?? ""),
        room,
        person: dm ? { email: dm.email, version: dm.version } : undefined,
      };
    }),
    ...($view.result?.epics ?? []).map((epic): Row => ({
      key: "epic:" + epic.room_id + ":" + epic.id,
      group: "epics",
      target: epicTarget(epic),
      title: epic.title,
      detail: epic.room + (epic.done ? " · " + text("doneThread") : ""),
    })),
    ...($view.result?.messages ?? []).map((message): Row => ({
      key: "msg:" + message.room_id + ":" + message.id,
      group: "messages",
      target: messageTarget(message),
      title:
        message.snippet || message.files.map((file) => file.name).join(", "),
      detail: message.room + (message.topic ? " › " + message.topic : ""),
    })),
  ]);
  const groups = $derived(
    (["rooms", "dms", "epics", "messages"] as const)
      .map((group) => ({
        group,
        label: text(
          group === "rooms"
            ? "searchRooms"
            : group === "dms"
              ? "searchDms"
              : group === "epics"
                ? "epics"
                : "conversations",
        ),
        rows: rows
          .map((row, index) => ({ row, index }))
          .filter(({ row }) => row.group === group),
      }))
      .filter(({ rows }) => rows.length),
  );
  let input = $state<HTMLInputElement | null>(null),
    list = $state<HTMLElement | null>(null);
  $effect(() => {
    if ($view.open)
      return registerDialog(() => {
        if (live()) search.close();
      });
  });
  // Keep the highlighted row in view as the arrows move it.
  $effect(() => {
    const index = $view.selected;
    void rows.length;
    void tick().then(() =>
      list
        ?.querySelector(`#result-${index}`)
        ?.scrollIntoView({ block: "nearest" }),
    );
  });
  /** The query's words in bold inside a row's text. */
  function parts(value: string, query: string) {
    const q = query.trim();
    if (q.length < 2) return [{ text: value, hit: false }];
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return value
      .split(new RegExp(`(${escaped})`, "ig"))
      .filter(Boolean)
      .map((piece) => ({
        text: piece,
        hit: piece.toLowerCase() === q.toLowerCase(),
      }));
  }
  const retry = (event: MouseEvent) => {
    if (
      live() &&
      event.currentTarget instanceof HTMLElement &&
      event.currentTarget.isConnected
    )
      search.edit($view.query);
  };
</script>

{#snippet kbd(label: string)}<kbd
    class="inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-border bg-background px-1 font-sans text-[0.6875rem] font-medium text-muted-foreground"
    >{label}</kbd
  >{/snippet}

<Dialog
  open={$view.open}
  onOpenChange={(open) => {
    if (!open && live()) search.close();
  }}
>
  <DialogContent
    data-search
    closeLabel={text("close")}
    closeButtonClassName="hidden"
    preventScroll={false}
    preventOverflowTextSelection={false}
    onOpenAutoFocus={(event) => {
      if (input) {
        event.preventDefault();
        input.focus();
      }
    }}
    onCloseAutoFocus={(event) => {
      const target = returnFocus();
      if (target?.isConnected) {
        event.preventDefault();
        target.focus();
      }
    }}
    class={cn(
      studioType,
      "top-[12dvh] flex max-h-[76dvh] translate-y-0 flex-col gap-0 overflow-hidden p-0 text-sm text-foreground md:max-w-[40rem]",
    )}
  >
    <DialogPrimitive.Title class="sr-only"
      >{text("search")}</DialogPrimitive.Title
    >
    <div
      class="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4"
    >
      {#if $view.loading}<Spinner
          class="size-5 text-muted-foreground"
        />{:else}<Icon
          icon="search-md"
          class="size-5 shrink-0 text-muted-foreground"
        />{/if}
      <input
        bind:this={input}
        role="combobox"
        aria-label={text("search")}
        aria-autocomplete="list"
        aria-expanded="true"
        aria-controls="room-results"
        aria-activedescendant={rows[$view.selected]
          ? `result-${$view.selected}`
          : undefined}
        autocomplete="off"
        spellcheck="false"
        data-1p-ignore
        placeholder={text("searchPlaceholder")}
        value={$view.query}
        class="h-full min-w-0 flex-1 bg-transparent text-base outline-hidden placeholder:text-muted-foreground"
        oninput={(event) => {
          if (live() && event.currentTarget.isConnected)
            search.edit(event.currentTarget.value);
        }}
        onkeydown={(event) => {
          if (!live() || !event.currentTarget.isConnected) return;
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            search.move(event.key === "ArrowDown" ? 1 : -1);
          } else if (event.key === "Enter" && !event.isComposing) {
            event.preventDefault();
            search.activate();
          }
        }}
      />
      <span class="max-md:hidden">{@render kbd("Esc")}</span>
    </div>
    <div
      bind:this={list}
      id="room-results"
      role="listbox"
      aria-label={text("search")}
      class="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 [scrollbar-width:thin]"
    >
      {#each groups as { group, label, rows: entries } (group)}<div
          role="group"
          aria-label={label}
          class="pb-1 not-first:pt-1"
        >
          <div
            aria-hidden="true"
            class="px-2.5 pt-1.5 pb-1 text-xs font-medium text-muted-foreground"
          >
            {label}
          </div>
          {#each entries as { row, index } (row.key)}<a
              href={targetHref(row.target)}
              role="option"
              id={`result-${index}`}
              aria-selected={$view.selected === index}
              data-selected={$view.selected === index ? "" : undefined}
              tabindex="-1"
              class={cn(
                commandItemVariants({ size: "lg" }),
                "text-foreground no-underline",
              )}
              onpointermove={() => {
                if ($view.selected !== index) search.select(index);
              }}
              onclick={(event) => {
                if (!live() || !event.currentTarget.isConnected) {
                  event.preventDefault();
                  return;
                }
                if (
                  event.ctrlKey ||
                  event.metaKey ||
                  event.shiftKey ||
                  event.altKey ||
                  event.button !== 0
                )
                  return;
                event.preventDefault();
                search.activateTarget(row.target);
              }}
            >
              {#if row.room}<RoomAvatar
                  title={row.title}
                  icon={roomIcon(row.room)}
                  person={row.person}
                  {lang}
                  size="md"
                  surface="background"
                />{:else}<span
                  class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
                  ><Icon
                    icon={row.group === "epics"
                      ? "target-04"
                      : "message-circle-01"}
                    class="size-4"
                  /></span
                >{/if}
              <span class="flex min-w-0 flex-1 flex-col">
                <span
                  class={cn(
                    "font-medium",
                    row.group === "messages"
                      ? "line-clamp-2 break-words"
                      : "truncate",
                  )}
                  >{#each parts(row.title, $view.query) as piece}{#if piece.hit}<mark
                        class="rounded-sm bg-brand/30 px-px text-inherit"
                        >{piece.text}</mark
                      >{:else}{piece.text}{/if}{/each}</span
                >
                {#if row.detail}<span
                    class="truncate text-xs text-muted-foreground"
                    >{row.detail}</span
                  >{/if}
              </span>
              <span
                aria-hidden="true"
                class="hidden text-muted-foreground in-data-selected:inline-flex"
                >↵</span
              >
            </a>{/each}
        </div>{/each}
      {#if !rows.length && !$view.loading}<div
          class="flex flex-col items-center gap-2 px-4 py-10 text-center text-muted-foreground"
        >
          <Icon icon="search-md" class="size-6" />
          <p class="m-0">
            {text(
              $view.query.trim().length >= 2 ? "noConversations" : "noMatches",
            )}
          </p>
        </div>{/if}
      {#if $view.loading && !rows.length}<p
          role="status"
          class="m-0 px-4 py-10 text-center text-muted-foreground"
        >
          {text("searching")}
        </p>{:else if $view.loading}<p role="status" class="sr-only">
          {text("searching")}
        </p>{/if}
      {#if $view.result?.failed}<div
          class="flex items-center gap-3 px-2.5 py-2 text-muted-foreground"
        >
          <p role="status" class="m-0 flex-1">{text("partial")}</p>
          <Button variant="outline" size="sm" onclick={retry}
            >{text("retry")}</Button
          >
        </div>{/if}
      {#if $view.error}<div class="flex items-center gap-3 px-2.5 py-2">
          <p role="alert" class="m-0 flex-1 break-words text-destructive">
            {homeIssue(lang, $view.error)}
          </p>
          <Button variant="outline" size="sm" onclick={retry}
            >{text("retry")}</Button
          >
        </div>{/if}
    </div>
    <div
      class="flex shrink-0 items-center gap-4 border-t border-border bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground max-md:hidden"
    >
      <span class="flex items-center gap-1.5"
        >{@render kbd("↑")}{@render kbd("↓")}{text("searchMove")}</span
      >
      <span class="flex items-center gap-1.5"
        >{@render kbd("↵")}{text("searchOpen")}</span
      >
      <span class="flex items-center gap-1.5"
        >{@render kbd("Esc")}{text("searchClose")}</span
      >
    </div>
  </DialogContent>
</Dialog>
