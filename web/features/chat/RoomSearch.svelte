<script lang="ts">
  import { onDestroy } from "svelte";
  import PersonAvatar from "../../lib/components/PersonAvatar.svelte";
  import AgentMark from "../../lib/components/AgentMark.svelte";
  import VibeCube from "../home/VibeCube.svelte";
  import Badge from "../../lib/studio/Badge.svelte";
  import Button from "../../lib/studio/Button.svelte";
  import { AGENT_NAMES, agentProvider } from "../../lib/components/agent";
  import Spinner from "../../lib/studio/Spinner.svelte";
  import type { RoomSearchResult } from "../../../shared/schemas";
  import {
    matchesSearch,
    mergeHits,
    roomSearch,
    searchActive,
    searchOf,
    type SearchFilter,
  } from "./roomSearch";
  import RoomSearchField from "./RoomSearchField.svelte";
  /**
   * The room's message search, in the pane beside the chat (like Discord's): by words, by a person, or both. It lists
   * the matches this room has loaded and the server's pages of the room's history, newest first, with "Mostrar mais"
   * for the next page. A click jumps to the message. A phone draws the field at the top (the top bar has no space).
   */
  type Hit = {
    id: number;
    thread: string;
    author: string;
    ts: number;
    text: string;
    /** Written by the person's agent (kind "agent"), in their name. */
    kind?: string | null;
    via?: string | null;
    deleted?: number | null;
    files?: readonly { name: string }[] | null;
  };
  let {
    roomId,
    messages,
    members,
    me,
    placeholder,
    phone = false,
    epicTitle,
    vb,
    search,
    onjump,
  }: {
    roomId: string;
    messages: readonly Hit[];
    members: readonly string[];
    me: string;
    placeholder: string;
    /** A phone: the pane draws the field, and says what to do while the search is empty. */
    phone?: boolean;
    epicTitle: (thread: string) => string | null;
    vb: {
      t: (text: string, vars?: Record<string, string | number>) => string;
      name: (email: string) => string;
      ago: (ts: number) => string;
      avatarVersion: (email: string) => number | null | undefined;
    };
    search: (
      filter: SearchFilter & { before?: number },
      signal: AbortSignal,
    ) => Promise<RoomSearchResult>;
    onjump: (id: number, thread: string) => void;
  } = $props();
  const filter = $derived(searchOf($roomSearch, roomId));
  const active = $derived(searchActive(filter));
  let remote = $state<Hit[]>([]),
    more = $state(false),
    loading = $state(false),
    paging = $state(false),
    timer: ReturnType<typeof setTimeout> | undefined,
    abort: AbortController | null = null;
  const local = $derived(
    active ? messages.filter((m) => matchesSearch(m, filter)) : [],
  );
  const hits = $derived(mergeHits(local, remote, more));
  const toHit = (m: RoomSearchResult["messages"][number]): Hit => ({
    id: m.id,
    thread: m.thread,
    author: m.author,
    ts: m.ts,
    text: m.snippet,
    kind: m.by_agent ? "agent" : null,
    via: m.via,
    files: m.files,
  });
  /** One page from the server, then `done` with it (null: it failed, the list keeps what it has), unless a newer
   *  search replaced this one. */
  function ask(
    next: SearchFilter,
    before: number | undefined,
    done: (result: RoomSearchResult | null) => void,
  ) {
    abort?.abort();
    const controller = new AbortController();
    abort = controller;
    search({ ...next, before }, controller.signal).then(
      (result) => !controller.signal.aborted && done(result),
      () => !controller.signal.aborted && done(null),
    );
  }
  $effect(() => {
    const next = { text: filter.text.trim(), person: filter.person };
    clearTimeout(timer);
    abort?.abort();
    remote = [];
    more = false;
    paging = false;
    if (!searchActive(next)) {
      loading = false;
      return;
    }
    loading = true;
    timer = setTimeout(() => {
      ask(next, undefined, (result) => {
        loading = false;
        if (!result) return;
        remote = result.messages.map(toHit);
        more = result.more;
      });
    }, 300);
  });
  function showMore() {
    if (paging || !remote.length) return;
    const next = { text: filter.text.trim(), person: filter.person };
    paging = true;
    ask(next, Math.min(...remote.map((hit) => hit.id)), (result) => {
      paging = false;
      if (!result) return;
      remote = [...remote, ...result.messages.map(toHit)];
      more = result.more;
    });
  }
  onDestroy(() => {
    clearTimeout(timer);
    abort?.abort();
  });
  /** The query's words marked in a line of the message. */
  function parts(value: string, q: string) {
    const words = q
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 1);
    if (!words.length) return [{ text: value, hit: false }];
    const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    return value
      .split(new RegExp(`(${escaped.join("|")})`, "ig"))
      .filter(Boolean)
      .map((piece) => ({
        text: piece,
        hit: words.some((w) => w.toLowerCase() === piece.toLowerCase()),
      }));
  }
  /** What a row shows: the text, or the names of the files of a message without text. */
  const line = (hit: Hit) =>
    hit.text || (hit.files ?? []).map((file) => file.name).join(", ");
</script>

<section
  data-room-search
  aria-label={vb.t("Buscar nesta sala")}
  class="flex min-h-0 flex-1 flex-col font-sans text-sm text-foreground"
>
  <!-- Desktop: the field is in the top bar; here only how many it found (like Discord's "N Results"). -->
  {#if phone}<RoomSearchField
      value={filter}
      onchange={(next) => roomSearch.set({ room: roomId, ...next })}
      {members}
      {me}
      {placeholder}
      vb={{ t: vb.t, name: vb.name, avatarVersion: vb.avatarVersion }}
      focus
      class="mx-3 mt-3 h-10 px-3"
    />{/if}
  {#if active}<p
      role="status"
      class="m-0 flex shrink-0 items-center gap-2 px-4 pt-3 pb-1 text-xs font-semibold text-muted-foreground"
    >
      {more
        ? vb.t("{n}+ resultados", { n: hits.length })
        : vb.t(hits.length === 1 ? "1 resultado" : "{n} resultados", {
            n: hits.length,
          })}{#if loading}<Spinner size="xs" />{/if}
    </p>{:else if phone}<p
      class="m-0 px-4 py-10 text-center text-sm text-muted-foreground"
    >
      {vb.t("Busque por palavras ou escolha uma pessoa.")}
    </p>{/if}
  <ol
    class="m-0 flex min-h-0 flex-1 list-none flex-col gap-1 overflow-y-auto p-2"
  >
    {#each hits as hit (hit.id)}<li>
        <button
          type="button"
          data-search-hit={hit.id}
          class="flex w-full cursor-pointer gap-3 rounded-lg border-0 bg-transparent p-2.5 text-left font-sans text-foreground transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
          onclick={() => onjump(hit.id, hit.thread)}
          ><!-- Who wrote it, drawn as in the chat: @vibe's ✦, an agent's tile with its person in the corner, or the person. -->
          {#if hit.author === "ai"}<VibeCube
              size="sm"
              class="text-sm"
            />{:else if hit.kind === "agent"}<span
              class="relative size-8 shrink-0"
              ><AgentMark
                via={hit.via}
                tint
                size="sm"
                class="text-base"
              /><PersonAvatar
                size="2xs"
                email={hit.author}
                version={vb.avatarVersion(hit.author)}
                class="absolute -right-1 -bottom-1 size-4 ring-2 ring-background"
              /></span
            >{:else}<PersonAvatar
              email={hit.author}
              version={vb.avatarVersion(hit.author)}
              size="sm"
            />{/if}<span class="flex min-w-0 flex-1 flex-col gap-0.5"
            ><span class="flex min-w-0 items-center gap-2 text-xs"
              ><b
                class={[
                  "truncate text-sm font-semibold",
                  hit.kind === "agent" && AGENT_NAMES[agentProvider(hit.via)],
                ]}
                >{hit.author === "ai"
                  ? "@vibe"
                  : hit.kind === "agent"
                    ? vb.t("{via} de {who}", {
                        via: hit.via || "agent",
                        who: vb.name(hit.author),
                      })
                    : vb.name(hit.author)}</b
              >{#if hit.kind === "agent"}<Badge size="sm">agent</Badge
                >{/if}<span class="shrink-0 text-muted-foreground"
                >{vb.ago(hit.ts)}</span
              >{#if hit.thread !== "main" && epicTitle(hit.thread)}<span
                  class="min-w-0 truncate text-muted-foreground"
                  >› {epicTitle(hit.thread)}</span
                >{/if}</span
            ><span class="line-clamp-3 break-words leading-5"
              >{#each parts(line(hit), filter.text) as piece}{#if piece.hit}<mark
                    class="rounded-sm bg-brand/30 px-px text-inherit"
                    >{piece.text}</mark
                  >{:else}{piece.text}{/if}{/each}</span
            ></span
          ></button
        >
      </li>{/each}
    {#if more && !loading}<li class="flex justify-center p-2">
        <Button
          variant="ghost"
          size="sm"
          data-search-more
          disabled={paging}
          aria-busy={paging || undefined}
          onclick={showMore}
          >{#if paging}<Spinner size="xs" />{/if}{vb.t("Mostrar mais")}</Button
        >
      </li>{/if}
    {#if active && !loading && !hits.length}<li
        class="px-4 py-10 text-center text-muted-foreground"
      >
        {vb.t("Nada encontrado nesta sala")}
      </li>{/if}
  </ol>
</section>
