<script lang="ts" module>
  // Opening a DM draws a new list (the room is rebuilt): the row you clicked
  // stays where it was on screen, so the list doesn't jump under the pointer.
  let anchor: { id: string; top: number } | null = null;
  const link = (row: Element | null | undefined) =>
    row?.querySelector<HTMLElement>(":scope > a") ?? null;
  function keepRow(node: HTMLElement) {
    const remember = (event: MouseEvent) => {
      const row =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>("li[data-dm]")
          : null;
      const rowLink = link(row);
      anchor =
        row && rowLink
          ? {
              id: row.dataset.dm ?? "",
              top: rowLink.getBoundingClientRect().top,
            }
          : null;
    };
    node.addEventListener("click", remember, true);
    const selected = anchor
      ? link(node.querySelector(`li[data-dm="${anchor.id}"]`))
      : null;
    if (anchor && selected?.hasAttribute("aria-current")) {
      let box = selected.parentElement;
      while (box && box.scrollHeight <= box.clientHeight)
        box = box.parentElement;
      if (box)
        box.scrollTop += selected.getBoundingClientRect().top - anchor.top;
    }
    return { destroy: () => node.removeEventListener("click", remember, true) };
  }
</script>

<script lang="ts">
  import SectionHeader from "../room-sidebar/SectionHeader.svelte";
  import { homeText, type HomeLanguage } from "../home/copy";
  import { dmEntries, waitsByRoom, type DmEntry } from "../home/model";
  import type { AppNavigationSession } from "./controller";
  import NewMessage from "./NewMessage.svelte";
  import Requests from "./Requests.svelte";
  import HomeRow from "./HomeRow.svelte";
  import RoomLink from "./RoomLink.svelte";
  import SearchField from "./SearchField.svelte";
  /**
   * Your home's own sidebar, like a room's: Home, "Você" (you and your
   * Claude), "Pedidos" (invites and message requests waiting for your yes),
   * then the conversations you've had (src/dm.ts), with a `+` to start one. A DM is only a
   * conversation: its row opens it, with nothing nested under it. Search
   * finds a person or a conversation (⌘K).
   */
  let {
    controller,
    lang,
  }: {
    controller: AppNavigationSession;
    lang: HomeLanguage;
  } = $props();
  const personal = $derived(controller.personal.state),
    nav = $derived(controller.state);
  const dms = $derived(dmEntries($personal.me));
  const waits = $derived(waitsByRoom($personal.me?.waits ?? []));
  const current = $derived($nav.roomId ?? null);
</script>

{#snippet dm(entry: DmEntry)}<li data-dm={entry.room.id}>
    <RoomLink
      room={entry.room}
      dm={entry}
      selfLabel={homeText(lang, "you")}
      seen={$personal.seen[entry.room.id] ?? 0}
      waits={waits.get(entry.room.id) ?? []}
      now={$personal.now}
      {lang}
      status
      selected={current === entry.room.id}
      onnavigate={controller.callbacks.navigate}
    />
  </li>{/snippet}

<nav
  aria-label={homeText(lang, "dms")}
  data-dm-nav
  use:keepRow
  class="flex min-h-0 flex-col gap-3 font-sans"
>
  <SearchField {controller} label={homeText(lang, "findConversation")} />
  {#if dms}<ul
      class="m-0 flex min-h-0 list-none flex-col gap-0.5 overflow-y-auto p-0"
    >
      <li>
        <HomeRow
          selected={!current}
          waits={$personal.me?.waits.length ?? 0}
          {lang}
          onhome={controller.callbacks.home}
        />
      </li>
      {@render dm(dms.self)}
      {#if $personal.me && ($personal.me.requests.length || $personal.me.invites?.length)}<li
          class="mt-3"
        >
          <Requests
            invites={$personal.me.invites ?? []}
            requests={$personal.me.requests}
            {lang}
            onjoin={controller.callbacks.answerInvite}
            onanswer={controller.callbacks.answerRequest}
          />
        </li>{/if}
      <li class="mt-3">
        <SectionHeader title={homeText(lang, "dms")}
          >{#snippet action()}{#if $personal.me}<NewMessage
                me={$personal.me}
                {lang}
                onconnect={controller.callbacks.connect}
                ondismiss={controller.callbacks.dismiss}
              />{/if}{/snippet}</SectionHeader
        >
      </li>
      {#each dms.talked as entry (entry.room.id)}{@render dm(entry)}{/each}
    </ul>{/if}
</nav>
