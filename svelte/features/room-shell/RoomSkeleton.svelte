<script lang="ts">
  import { untrack } from "svelte";
  import Skeleton from "../../lib/studio/Skeleton.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import {
    ArrowLeft,
    ChevronDown,
    Inbox01,
    MessageCircle01,
    SearchMd,
  } from "../../lib/studio/icons";
  import RoomMark from "../room-sidebar/RoomMark.svelte";
  import DmNav from "../app-navigation/DmNav.svelte";
  import { isDmId } from "../../../shared/dm";
  import RoomAvatar from "../rooms/RoomAvatar.svelte";
  import PersonAvatar from "../../lib/components/PersonAvatar.svelte";
  import Count from "../../lib/components/Count.svelte";
  import { paneIcons, paneLabel } from "../documents/paneIcons";
  import { roomIcon, switcherDms } from "../home/model";
  import { homeText } from "../home/copy";
  import { roomDocumentWidth } from "../room-layout/preview";
  import type { BrowserApplicationServices } from "../application/browser";
  /** A room that is still connecting, drawn in the room's own frame (the cells of
   * RoomLayoutFrame: sidebar, chat with its header and composer, the doc on the
   * right) with the name and icon the home already knows, so nothing moves when
   * the state lands. On a phone it is RoomHeader's one row (back, the room's
   * avatar with its name over the thread, search, inbox, you) and PhoneTabBar
   * under the composer. */
  let {
    roomId,
    thread = "main",
    services,
    onhome,
  }: {
    roomId: string | null;
    /** The thread the URL opens (?t=): main reads "Sala principal" at once. */
    thread?: string;
    services: BrowserApplicationServices;
    onhome(event: MouseEvent): void;
  } = $props();
  const personal = untrack(() => services.personal.state);
  // A DM's sidebar is your DM list, already known: draw it for real, so it stays put.
  const dm = $derived(!!roomId && isDmId(roomId));
  const room = $derived(
    roomId ? $personal.me?.books.find((book) => book.id === roomId) : undefined,
  );
  const icon = $derived(room ? roomIcon(room) : undefined);
  const me = $derived($personal.me);
  // A DM: the other person's face (you in "Você"), the same entry your DM list draws.
  const peer = $derived(
    dm ? switcherDms(me).find((entry) => entry.room.id === roomId) : undefined,
  );
  // A DM is named after the other person (yours reads "Você"/"You" in the app's language), as its header will be:
  // the row's own title is the pair's ("Gui · Ana", src/dm.ts).
  const title = $derived(
    peer
      ? peer.self
        ? homeText(services.language, "you")
        : peer.name
      : (room?.title ?? ""),
  );
  const waits = $derived(me?.waits.length ?? 0);
  const en = $derived(services.language === "en");
  const t = (text: string, vars?: Record<string, string | number>) =>
    services.t(text, vars);
  // PhoneTabBar's tabs, Chat selected (a room opens on its chat).
  const tabs = $derived([
    { id: "chat", label: "Chat", icon: MessageCircle01 },
    { id: "doc", label: "Doc", icon: paneIcons.doc },
    { id: "board", label: en ? "Board" : "Quadro", icon: paneIcons.board },
    { id: "files", label: en ? "Files" : "Arquivos", icon: paneIcons.files },
    {
      id: "claude",
      label: paneLabel("agents", en),
      icon: paneIcons.agents,
    },
  ]);
</script>

{#snippet mark(size: string, square = "")}
  {#if peer}<PersonAvatar
      email={peer.email}
      version={peer.version}
      class={size}
    />{:else if title}<RoomMark
      {title}
      src={icon}
      class={[size, square].join(" ")}
    />{:else}<Skeleton
      class={["tw:shrink-0 tw:rounded-md", size, square].join(" ")}
    />{/if}
{/snippet}

{#snippet line(width: string, height = "tw:h-3")}
  <Skeleton class={[height, width, "tw:rounded-full"].join(" ")} />
{/snippet}

<div
  data-vb-native
  data-room-skeleton
  class="tw:grid tw:h-full tw:min-h-0 tw:w-full tw:min-w-0 tw:grid-cols-[minmax(0,1fr)] tw:overflow-hidden tw:bg-background tw:font-sans tw:text-sm tw:text-foreground tw:[container-type:inline-size] tw:min-[901px]:bg-sidebar tw:min-[901px]:py-2 tw:min-[901px]:pr-2 tw:min-[901px]:pl-px"
>
  <!-- Desktop: the room's one frame (RoomLayoutFrame): sidebar, one top bar over
       chat and doc, hairlines between. Phones: just the chat column below. -->
  <div
    class="tw:contents tw:min-[901px]:grid tw:min-[901px]:min-h-0 tw:min-[901px]:grid-cols-[auto_minmax(0,1fr)_auto] tw:min-[901px]:grid-rows-[52px_minmax(0,1fr)] tw:min-[901px]:overflow-hidden tw:min-[901px]:rounded-surface tw:min-[901px]:bg-background tw:min-[901px]:shadow-edge"
  >
    <!-- Sidebar: the room's name, the main thread, epics, Pinned, People, then
       your Claude and you at its foot. -->
    <aside
      aria-hidden={dm ? undefined : "true"}
      class="tw:hidden tw:w-room-sidebar tw:min-h-0 tw:flex-col tw:gap-6 tw:border-r tw:border-border tw:bg-sidebar tw:px-2 tw:pb-2 tw:text-sidebar-foreground tw:min-[901px]:row-span-2 tw:min-[901px]:flex"
    >
      {#if dm}<div class="tw:flex tw:min-h-0 tw:flex-col tw:pt-2">
          <DmNav controller={services.navigation} lang={services.language} />
        </div>{:else}<div class="tw:flex tw:flex-col tw:gap-3">
          <div
            class="tw:-mx-2 tw:flex tw:h-[52px] tw:shrink-0 tw:items-center tw:gap-2 tw:border-b tw:border-border tw:pr-2 tw:pl-4 tw:font-semibold"
          >
            {@render mark("tw:size-6")}
            {#if title}<span class="tw:min-w-0 tw:flex-1 tw:truncate"
                >{title}</span
              >{:else}{@render line("tw:w-32")}{/if}
          </div>
          <div
            class={[
              "tw:flex tw:h-9 tw:min-w-0 tw:items-center tw:gap-2 tw:rounded-lg tw:px-2 tw:font-medium",
              thread === "main" && "tw:bg-sidebar-accent",
            ]}
          >
            <Icon
              icon={MessageCircle01}
              size={16}
              class="tw:shrink-0 tw:text-muted-foreground"
            />
            <span class="tw:min-w-0 tw:flex-1 tw:truncate"
              >{t("Sala principal")}</span
            >
          </div>
          <Skeleton class="tw:h-9 tw:w-full tw:rounded-lg tw:opacity-60" />
          {#each ["tw:w-3/5", "tw:w-2/5", "tw:w-1/2"] as width (width)}
            <div class="tw:flex tw:h-9 tw:items-center tw:gap-2 tw:px-2">
              <Skeleton class="tw:size-5 tw:shrink-0 tw:rounded-full" />
              {@render line(width, "tw:h-2.5")}
            </div>
          {/each}
        </div>
        <div class="tw:flex tw:flex-col tw:gap-3 tw:px-2">
          {@render line("tw:w-14", "tw:h-2.5")}
          <Skeleton class="tw:h-8 tw:w-full tw:rounded-lg tw:opacity-60" />
        </div>
        <div class="tw:flex tw:flex-col tw:gap-3 tw:px-2">
          {@render line("tw:w-24", "tw:h-2.5")}
          <Skeleton class="tw:h-8 tw:w-full tw:rounded-lg tw:opacity-60" />
        </div>{/if}
      <div
        class="tw:mt-auto tw:flex tw:flex-col tw:gap-0.5 tw:rounded-xl tw:bg-sidebar-accent/50 tw:p-1"
      >
        <div class="tw:flex tw:h-11 tw:items-center tw:gap-2.5 tw:px-2.5">
          <Skeleton class="tw:size-7 tw:shrink-0 tw:rounded-full" />
          {@render line("tw:w-28", "tw:h-2.5")}
        </div>
        <div class="tw:flex tw:h-11 tw:items-center tw:gap-2.5 tw:px-2.5">
          <!-- You are online while the room loads: AccountRow as it will land. -->
          {#if me}<span class="tw:relative tw:flex tw:shrink-0"
              ><PersonAvatar
                email={me.email}
                version={me.avatar}
                class="tw:size-7"
              /><span
                data-status-dot="online"
                class="tw:absolute tw:-right-0.5 tw:-bottom-0.5 tw:size-2.5 tw:rounded-full tw:bg-brand tw:ring-2 tw:ring-sidebar"
              ></span></span
            ><span class="tw:flex tw:min-w-0 tw:flex-col"
              ><span class="tw:truncate tw:font-medium"
                >{me.name || me.email}</span
              ><span class="tw:truncate tw:text-xs tw:text-muted-foreground"
                >Online</span
              ></span
            >{:else}<Skeleton
              class="tw:size-7 tw:shrink-0 tw:rounded-full"
            />{@render line("tw:w-20", "tw:h-2.5")}{/if}
        </div>
      </div>
    </aside>

    <!-- Desktop: one top bar over chat and doc: the room, its actions, then the doc's tabs at the end. -->
    <header
      aria-hidden="true"
      class="tw:hidden tw:min-w-0 tw:items-center tw:gap-1 tw:border-b tw:border-border tw:pr-3 tw:pl-5 tw:min-[901px]:col-span-2 tw:min-[901px]:flex"
    >
      {@render mark("tw:size-6")}
      {#if title}<span
          class="tw:min-w-0 tw:flex-1 tw:truncate tw:px-2 tw:text-sm tw:font-medium"
          >{title}</span
        >{:else}<div
          class="tw:flex tw:min-w-0 tw:flex-1 tw:items-center tw:px-2"
        >
          {@render line("tw:w-40")}
        </div>{/if}
      {#each [0, 1] as slot (slot)}
        <span class="tw:grid tw:size-8 tw:shrink-0 tw:place-items-center"
          ><Skeleton class="tw:size-4 tw:rounded-full" /></span
        >
      {/each}
      <Skeleton class="tw:h-7 tw:w-16 tw:shrink-0 tw:rounded-full" />
      {#each [0, 1, 2, 3, 4, 5] as slot (slot)}
        <span class="tw:grid tw:size-8 tw:shrink-0 tw:place-items-center"
          ><Skeleton class="tw:size-4 tw:rounded-full" /></span
        >
      {/each}
    </header>

    <!-- Chat: header with the room's icon and name, the messages, the composer. -->
    <main class="tw:flex tw:min-h-0 tw:min-w-0 tw:flex-col tw:bg-background">
      <!-- Phones: RoomHeader's row, in RoomLayoutFrame's header cell. -->
      <header
        class="tw:flex tw:min-w-0 tw:shrink-0 tw:items-center tw:gap-1 tw:border-b tw:border-border tw:bg-background tw:px-4 tw:pt-[max(0.75rem,env(safe-area-inset-top))] tw:pb-3 tw:min-[901px]:hidden"
      >
        <IconButton
          label={t("Seus vibebooks")}
          size="icon"
          class="tw:rounded-full"
          onclick={onhome}><Icon icon={ArrowLeft} size={16} /></IconButton
        >
        <div
          class="tw:flex tw:min-w-0 tw:flex-1 tw:basis-0 tw:items-center tw:gap-2.5 tw:px-1.5 tw:py-1"
        >
          {#if title}<RoomAvatar
              {title}
              {icon}
              person={peer}
              lang={en ? "en" : "pt"}
              surface="background"
            />{:else}<Skeleton
              class="tw:size-8 tw:shrink-0 tw:rounded-lg"
            />{/if}
          <span class="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col">
            {#if title}<span
                class="tw:truncate tw:text-xs tw:leading-4 tw:text-muted-foreground"
                >{title}</span
              >{:else}<span class="tw:flex tw:h-4 tw:items-center"
                >{@render line("tw:w-20", "tw:h-2.5")}</span
              >{/if}
            <span
              class="tw:flex tw:min-w-0 tw:items-center tw:gap-1 tw:text-base tw:leading-5 tw:font-semibold"
              >{#if thread === "main"}<span class="tw:truncate"
                  >{t(dm ? "Conversa" : "Sala principal")}</span
                >{:else}<span class="tw:flex tw:h-5 tw:items-center"
                  >{@render line("tw:w-32")}</span
                >{/if}<Icon
                icon={ChevronDown}
                size={16}
                class="tw:shrink-0"
              /></span
            >
          </span>
        </div>
        <span
          aria-hidden="true"
          class="tw:grid tw:size-8 tw:shrink-0 tw:place-items-center tw:text-muted-foreground"
          ><Icon icon={SearchMd} size={16} /></span
        >
        <span
          aria-hidden="true"
          class="tw:relative tw:grid tw:size-8 tw:shrink-0 tw:place-items-center tw:text-muted-foreground"
          ><Icon icon={Inbox01} size={16} />{#if waits}<Count
              value={waits}
              label={t("Esperando você: {n}", { n: waits })}
              class="tw:absolute tw:-top-1 tw:-right-1 tw:shadow-[0_0_0_2px_var(--vb-background)]"
            />{/if}</span
        >
        <span
          aria-hidden="true"
          class="tw:grid tw:size-8 tw:shrink-0 tw:place-items-center"
          >{#if me}<PersonAvatar
              email={me.email}
              version={me.avatar}
              size="2xs"
            />{:else}<Skeleton class="tw:size-4 tw:rounded-full" />{/if}</span
        >
      </header>

      <div
        class="tw:flex tw:min-h-0 tw:flex-1 tw:flex-col tw:overflow-hidden tw:px-4 tw:min-[901px]:px-6"
      >
        <div
          class="tw:flex tw:flex-1 tw:flex-col tw:items-center tw:justify-center tw:gap-3 tw:py-8 tw:text-center"
        >
          {@render mark("tw:size-12", "tw:rounded-xl")}
          {#if title}<p
              class="tw:m-0 tw:max-w-full tw:truncate tw:text-base tw:font-semibold"
            >
              {title}
            </p>{/if}
          <p
            role="status"
            class="tw:m-0 tw:text-muted-foreground tw:motion-safe:animate-pulse"
          >
            {t("Carregando…")}
          </p>
        </div>
        <div aria-hidden="true" class="tw:flex tw:flex-col tw:gap-5 tw:pb-4">
          {#each [["tw:w-24", "tw:w-3/5"], ["tw:w-32", "tw:w-2/5"], ["tw:w-20", "tw:w-1/2"]] as [name, body] (name)}
            <div class="tw:flex tw:items-start tw:gap-3">
              <Skeleton class="tw:size-8 tw:shrink-0 tw:rounded-full" />
              <div
                class="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:gap-2 tw:pt-1"
              >
                {@render line(name, "tw:h-2.5")}
                {@render line(body)}
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- The composer; on phones the tab bar under it carries the home-bar inset. -->
      <div aria-hidden="true" class="tw:shrink-0">
        <div
          class="tw:px-3 tw:pt-1 tw:pb-3 tw:min-[901px]:pb-4 tw:min-[901px]:px-6"
        >
          <div
            class="tw:mb-2 tw:flex tw:h-14 tw:items-center tw:gap-2 tw:rounded-[22px] tw:bg-[var(--vb-studio-input-background)] tw:pr-3 tw:pl-4 tw:text-muted-foreground tw:shadow-[inset_0_0_0_1px_var(--vb-hairline),0_4px_16px_0_#0000000d]"
          >
            <span class="tw:min-w-0 tw:flex-1 tw:truncate"
              >{t("Mensagem…")}</span
            >
            <Skeleton class="tw:h-8 tw:w-16 tw:rounded-full" />
          </div>
        </div>
      </div>

      <!-- Phones: PhoneTabBar, Chat selected. -->
      <nav
        aria-hidden="true"
        class="tw:grid tw:shrink-0 tw:grid-cols-5 tw:border-t tw:border-border tw:bg-background tw:px-1 tw:pt-1 tw:pb-[max(0.375rem,env(safe-area-inset-bottom))] tw:min-[901px]:hidden"
      >
        {#each tabs as tab (tab.id)}
          {@const on = tab.id === "chat"}
          <span
            class={[
              "tw:flex tw:min-w-0 tw:flex-col tw:items-center tw:gap-0.5 tw:py-1 tw:text-[0.6875rem] tw:leading-4 tw:text-muted-foreground",
              on && "tw:font-semibold tw:text-foreground",
            ]}
            ><span
              class={[
                "tw:flex tw:h-7 tw:w-12 tw:items-center tw:justify-center tw:rounded-full",
                on && "tw:bg-accent",
              ]}><Icon icon={tab.icon} size={18} /></span
            ><span class="tw:max-w-full tw:truncate">{tab.label}</span></span
          >
        {/each}
      </nav>
    </main>

    <!-- Doc: a few lines at the width the room opens with (vb.docW, the same
       width animation the room's doc cell seeks); its tabs are in the top bar. -->
    {#if !dm}<section
        aria-hidden="true"
        use:roomDocumentWidth
        class="tw:hidden tw:min-h-0 tw:animate-room-document-width tw:flex-col tw:border-l tw:border-border tw:min-[901px]:flex"
      >
        <div class="tw:flex tw:flex-col tw:gap-3 tw:px-4 tw:pt-4">
          {@render line("tw:w-2/5", "tw:h-4")}
          {@render line("tw:w-full")}
          {@render line("tw:w-5/6")}
          {@render line("tw:w-3/5")}
        </div>
      </section>{/if}
  </div>
</div>
