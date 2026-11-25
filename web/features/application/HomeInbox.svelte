<script lang="ts">
  import { untrack } from "svelte";
  import { MediaQuery } from "svelte/reactivity";
  import { MOBILE_QUERY } from "../../lib/breakpoints";
  import Snapshot from "../../lib/components/Snapshot.svelte";
  import type { ApplicationInbox, InboxBinding } from "./inbox";
  import type { BrowserApplicationServices } from "./browser";
  import type { ComposerDrafts } from "../composer/drafts";
  import RoomInbox from "./RoomInbox.svelte";
  import HomeDesk from "./HomeDesk.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import { homeText } from "../home/copy";
  import { mountCube } from "../home/cube";
  import HomeAsk from "../home/HomeAsk.svelte";
  import { roomInboxModel } from "./roomInboxModel";
  /**
   * The home's page (`/` on a desktop, `/?inbox` on a phone): your Inbox for
   * all rooms, the same triage list as a room's (RoomInbox). It has no room, so
   * it has no scope. On a desktop its bar is a room's: the search on the left,
   * where a room has "Buscar em <sala>" (RoomHeader). "Resolve all" is in the
   * Responder label's menu (HomeDesk); phones: RoomInbox draws it itself.
   * On a phone, inbox zero is the reward: the agent's cube, "All caught up"
   * and the home's ask box, for what comes next. On a desktop the cube, a
   * line and the ask box are always on top, over the Inbox grouped by what
   * you have to do (HomeDesk).
   */
  let {
    owner,
    services,
    drafts,
  }: {
    owner: ApplicationInbox;
    services: BrowserApplicationServices;
    drafts: ComposerDrafts;
  } = $props();
  const inbox = untrack(() => owner.state),
    t = untrack(() => services.t),
    personal = untrack(() => services.personal.state);
  const lang = $derived(services.language === "en" ? "en" : "pt");
  const mobile = new MediaQuery(MOBILE_QUERY);
  // Zero: nothing at all in the Inbox (asks, mentions, reviews, your tasks)
  // once this binding has read it (a later refresh keeps the cube up), nothing
  // failed and no Undo is pending. Open tasks keep the list, so its "Suas
  // tarefas" chip stays reachable.
  let loaded = $state.raw<InboxBinding | null>(null);
  $effect(() => {
    if ($inbox.phase === "ready" && $inbox.binding) loaded = $inbox.binding;
  });
  const left = $derived.by(() => {
    const model = roomInboxModel($inbox.data, "", true),
      hidden = new Set($inbox.hidden);
    const waits = [
      ...model.messages.flatMap((message) =>
        message.wait ? [message.wait] : [],
      ),
      ...model.oks,
    ];
    return (
      model.messages.filter((message) => !message.wait).length +
      waits.filter((wait) => !hidden.has(`${wait.book_id}/${wait.ref}`))
        .length +
      model.groups.reduce((sum, group) => sum + group.tasks.length, 0)
    );
  });
  const zero = $derived(
    !!$inbox.binding &&
      loaded === $inbox.binding &&
      !$inbox.error &&
      !$inbox.undo &&
      left === 0,
  );
  const first = $derived($personal.me?.name?.split(" ")[0] ?? "");
  let cube = $state<HTMLCanvasElement | null>(null);
  $effect(() => {
    if (cube) return mountCube(cube);
  });
</script>

<div
  data-view="home"
  data-home-inbox
  class="flex h-full min-h-0 min-w-0 flex-col"
>
  <header
    class="hidden h-13 shrink-0 items-center gap-2 border-b border-border pr-3 pl-5 font-sans text-sm text-foreground md:flex"
  >
    <h2 class="sr-only">{t("Caixa de entrada")}</h2>
    <div class="flex min-w-0 flex-1 items-center">
      <button
        type="button"
        data-home-inbox-search
        class="flex h-8 w-full max-w-80 min-w-0 cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-muted px-2.5 text-left font-sans text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        onclick={() => services.navigation.openSearch()}
        ><Icon icon="search-md" size={14} class="shrink-0" /><span
          class="min-w-0 truncate">{homeText(lang, "searchPlaceholder")}</span
        ></button
      >
    </div>
  </header>
  {#if !mobile.current}{#if $inbox.binding}{#key $inbox.binding}<Snapshot
          value={$inbox.binding}
          >{#snippet children(binding)}<HomeDesk
              {owner}
              {binding}
              {services}
              {drafts}
            />{/snippet}</Snapshot
        >{/key}{/if}
  {:else if zero}<section
      data-home-inbox-zero
      class="flex min-h-0 flex-1 animate-in flex-col items-center justify-center overflow-auto px-8 pt-8 pb-[12vh] duration-500 ease-out [--tw-enter-opacity:0] [--tw-enter-scale:0.97] motion-reduce:animate-none"
    >
      <canvas
        bind:this={cube}
        width="512"
        height="512"
        aria-hidden="true"
        class="size-[200px] shrink-0"
      ></canvas>
      <h1
        class="m-0 mt-1 text-center text-4xl font-medium tracking-tight text-balance"
      >
        {first ? t("Tudo em dia, {name}.", { name: first }) : t("Tudo em dia.")}
        <span class="text-muted-foreground"
          >{t("O que vamos fazer agora?")}</span
        >
      </h1>
      <div
        data-home-ask="inbox"
        class="mt-7 flex w-full max-w-[640px] flex-col items-center gap-3"
      >
        <HomeAsk
          personal={services.personal}
          {lang}
          onnavigate={(target) => services.actions.navigate(target)}
          onnew={(trigger) => services.navigation.openCreate(trigger)}
          onsearch={() => services.navigation.openSearch()}
        />
      </div>
    </section>
  {:else if $inbox.binding}{#key $inbox.binding}<Snapshot value={$inbox.binding}
        >{#snippet children(binding)}<RoomInbox
            {owner}
            {binding}
            {services}
          />{/snippet}</Snapshot
      >{/key}{/if}
</div>
