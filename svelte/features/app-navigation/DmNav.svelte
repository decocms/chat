<script lang="ts">
  import type { Snippet } from "svelte";
  import Button from "../../lib/studio/Button.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import { SearchMd } from "../../lib/studio/icons";
  import SectionHeader from "../room-sidebar/SectionHeader.svelte";
  import { homeText, type HomeLanguage } from "../home/copy";
  import { dmEntries, waitsByRoom, type DmEntry } from "../home/model";
  import type { AppNavigationSession } from "./controller";
  import FriendRequests from "./FriendRequests.svelte";
  import HomeRow from "./HomeRow.svelte";
  import RoomLink from "./RoomLink.svelte";
  /**
   * Your home's own sidebar, like a room's: Home, "Você" (you and your
   * Claude), then a row per friend, your DMs (src/dm.ts). The open DM expands
   * in place into its threads (`threads`, the room sidebar's own). Search
   * finds a person or a conversation (⌘K).
   */
  let {
    controller,
    lang,
    threads,
  }: {
    controller: AppNavigationSession;
    lang: HomeLanguage;
    /** Under the open DM: its conversation, views and epics. */
    threads?: Snippet;
  } = $props();
  const personal = $derived(controller.personal.state),
    nav = $derived(controller.state);
  const dms = $derived(dmEntries($personal.me));
  const waits = $derived(waitsByRoom($personal.me?.waits ?? []));
  const current = $derived($nav.roomId ?? null);
</script>

{#snippet dm(entry: DmEntry, faded = false)}<li>
    <RoomLink
      room={entry.room}
      dm={entry}
      selfLabel={homeText(lang, "you")}
      seen={$personal.seen[entry.room.id] ?? 0}
      waits={waits.get(entry.room.id) ?? []}
      now={$personal.now}
      {lang}
      status
      note={entry.self ? homeText(lang, "youMeta") : undefined}
      {faded}
      selected={current === entry.room.id}
      children={current === entry.room.id ? threads : undefined}
      onnavigate={controller.callbacks.navigate}
    />
  </li>{/snippet}

<nav
  aria-label={homeText(lang, "dms")}
  data-dm-nav
  class="tw:flex tw:min-h-0 tw:flex-col tw:gap-3 tw:font-sans"
>
  <Button
    variant="outline"
    class="tw:w-full tw:shrink-0 tw:justify-start tw:gap-2 tw:font-normal tw:text-muted-foreground"
    onclick={(event) => {
      if (event.currentTarget.isConnected)
        controller.openSearch(event.currentTarget);
    }}
    ><Icon icon={SearchMd} size={16} /><span class="tw:truncate"
      >{homeText(lang, "findConversation")}</span
    ></Button
  >
  {#if dms}<ul
      class="tw:m-0 tw:flex tw:min-h-0 tw:list-none tw:flex-col tw:gap-0.5 tw:overflow-y-auto tw:p-0"
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
      {#if $personal.me?.requests.length}<li class="tw:mt-3">
          <FriendRequests
            requests={$personal.me.requests}
            {lang}
            onanswer={controller.callbacks.answerFriend}
          />
        </li>{/if}
      {#if dms.talked.length || dms.untalked.length}<li class="tw:mt-3">
          <SectionHeader title={homeText(lang, "dms")} />
        </li>{/if}
      {#each dms.talked as entry (entry.room.id)}{@render dm(entry)}{/each}
      {#if dms.untalked.length}<li class="tw:mt-2">
          <SectionHeader level={4} title={homeText(lang, "notTalked")} />
        </li>
        {#each dms.untalked as entry (entry.room.id)}{@render dm(
            entry,
            true,
          )}{/each}{/if}
    </ul>{/if}
</nav>
