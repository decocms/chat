<script lang="ts">
  import { untrack } from "svelte";
  import Skeleton from "../../lib/studio/Skeleton.svelte";
  import {
    COMPOSER_BOX,
    COMPOSER_FRAME,
    COMPOSER_ROW,
    COMPOSER_SLOT,
  } from "../composer/shape";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import RoomMark from "../room-sidebar/RoomMark.svelte";
  import DmNav from "../app-navigation/DmNav.svelte";
  import { isDmId } from "../../../shared/dm";
  import RoomAvatar from "../rooms/RoomAvatar.svelte";
  import PersonAvatar from "../../lib/components/PersonAvatar.svelte";
  import { roomIcon, switcherDms } from "../home/model";
  import { homeText } from "../home/copy";
  import { roomDocumentWidth } from "../room-layout/preview";
  import type { BrowserApplicationServices } from "../application/browser";
  /** A room that is still connecting, drawn in the room's own frame (the cells of
   * RoomLayoutFrame: sidebar, chat with its header and composer, the doc on the
   * right) with the name and icon the home already knows, so nothing moves when
   * the state lands. On a phone it is RoomHeader's one row (back, the thread
   * over the room, centered, you) and the composer alone at the bottom. */
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
  const en = $derived(services.language === "en");
  const t = (text: string, vars?: Record<string, string | number>) =>
    services.t(text, vars);
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
      class={["shrink-0 rounded-md", size, square].join(" ")}
    />{/if}
{/snippet}

{#snippet line(width: string, height = "h-3")}
  <Skeleton class={[height, width, "rounded-full"].join(" ")} />
{/snippet}

<div
  data-room-skeleton
  class="grid h-full min-h-0 w-full min-w-0 grid-cols-[minmax(0,1fr)] overflow-hidden bg-background font-sans text-sm text-foreground [container-type:inline-size] md:bg-sidebar md:py-2 md:pr-2 md:pl-px"
>
  <!-- Desktop: the room's one frame (RoomLayoutFrame): sidebar, one top bar over
       chat and doc, hairlines between. Phones: just the chat column below. -->
  <div
    class="contents md:grid md:min-h-0 md:grid-cols-[auto_minmax(0,1fr)_auto] md:grid-rows-[52px_minmax(0,1fr)] md:overflow-hidden md:rounded-surface md:bg-background md:shadow-edge"
  >
    <!-- Sidebar: the room's name, the main thread, epics, Pinned, People, then
       your Claude and you at its foot. -->
    <aside
      aria-hidden={dm ? undefined : "true"}
      class="hidden w-room-sidebar min-h-0 flex-col gap-6 border-r border-border bg-sidebar px-2 pb-4 text-sidebar-foreground md:row-span-2 md:flex"
    >
      {#if dm}<div class="flex min-h-0 flex-col pt-2">
          <DmNav controller={services.navigation} lang={services.language} />
        </div>{:else}<div class="flex flex-col gap-3">
          <!-- The room's name row (SidebarHeader) as it will land. -->
          <div
            class="-mx-2 flex h-[52px] shrink-0 items-center gap-2 border-b border-border pr-2 pl-4 font-semibold"
          >
            {@render mark("size-6")}
            {#if title}<span class="min-w-0 flex-1 truncate">{title}</span
              >{:else}{@render line("w-32")}{/if}
          </div>
          <div
            class={[
              "flex h-9 min-w-0 items-center gap-2 rounded-lg px-2 font-medium",
              thread === "main" && "bg-sidebar-accent",
            ]}
          >
            <Icon
              icon="message-circle-01"
              size={16}
              class="shrink-0 text-muted-foreground"
            />
            <span class="min-w-0 flex-1 truncate">{t("Sala principal")}</span>
          </div>
          <Skeleton class="h-9 w-full rounded-lg opacity-60" />
          {#each ["w-3/5", "w-2/5", "w-1/2"] as width (width)}
            <div class="flex h-9 items-center gap-2 px-2">
              <Skeleton class="size-5 shrink-0 rounded-full" />
              {@render line(width, "h-2.5")}
            </div>
          {/each}
        </div>
        <div class="flex flex-col gap-3 px-2">
          {@render line("w-14", "h-2.5")}
          <Skeleton class="h-8 w-full rounded-lg opacity-60" />
        </div>
        <div class="flex flex-col gap-3 px-2">
          {@render line("w-24", "h-2.5")}
          <Skeleton class="h-8 w-full rounded-lg opacity-60" />
        </div>{/if}
      <div
        class="mt-auto flex flex-col gap-0.5 rounded-xl bg-sidebar-accent/50 p-1"
      >
        <div class="flex h-11 items-center gap-2.5 px-2.5">
          <Skeleton class="size-7 shrink-0 rounded-full" />
          {@render line("w-28", "h-2.5")}
        </div>
        <div class="flex h-11 items-center gap-2.5 px-2.5">
          <!-- You are online while the room loads: AccountRow as it will land. -->
          {#if me}<span class="relative flex shrink-0"
              ><PersonAvatar
                email={me.email}
                version={me.avatar}
                class="size-7"
              /><span
                data-status-dot="online"
                class="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full bg-brand ring-2 ring-sidebar"
              ></span></span
            ><span class="flex min-w-0 flex-col"
              ><span class="truncate font-medium">{me.name || me.email}</span
              ><span class="truncate text-xs text-muted-foreground">Online</span
              ></span
            >{:else}<Skeleton
              class="size-7 shrink-0 rounded-full"
            />{@render line("w-20", "h-2.5")}{/if}
        </div>
      </div>
    </aside>

    <!-- Desktop: one top bar over chat and doc: the room, its actions, then the doc's tabs at the end. -->
    <header
      aria-hidden="true"
      class="hidden min-w-0 items-center gap-1 border-b border-border pr-3 pl-5 md:col-span-2 md:flex"
    >
      {@render mark("size-6")}
      {#if title}<span class="min-w-0 flex-1 truncate px-2 text-sm font-medium"
          >{title}</span
        >{:else}<div class="flex min-w-0 flex-1 items-center px-2">
          {@render line("w-40")}
        </div>{/if}
      {#each [0, 1] as slot (slot)}
        <span class="grid size-8 shrink-0 place-items-center"
          ><Skeleton class="size-4 rounded-full" /></span
        >
      {/each}
      <Skeleton class="h-7 w-16 shrink-0 rounded-full" />
      {#each [0, 1, 2, 3, 4, 5] as slot (slot)}
        <span class="grid size-8 shrink-0 place-items-center"
          ><Skeleton class="size-4 rounded-full" /></span
        >
      {/each}
    </header>

    <!-- Chat: header with the room's icon and name, the messages, the composer. -->
    <main class="flex min-h-0 min-w-0 flex-col bg-background">
      <!-- Phones: RoomHeader's row, in RoomLayoutFrame's header cell. -->
      <header
        class="flex min-w-0 shrink-0 items-center gap-1 border-b border-border bg-background px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 md:hidden"
      >
        <IconButton
          label={t("Suas salas")}
          size="icon"
          class="size-10 rounded-full"
          onclick={onhome}><Icon icon="arrow-left" size={20} /></IconButton
        >
        <div
          class="flex min-w-0 flex-1 basis-0 items-center justify-start gap-2 px-1.5 py-1"
        >
          {#if peer && title}<RoomAvatar
              {title}
              {icon}
              person={peer}
              lang={en ? "en" : "pt"}
              surface="background"
            />{/if}
          <!-- Left, right after ←, like RoomHeader's title (Gimenes #3796). -->
          <span class="flex min-w-0 flex-col items-start">
            <span
              class="flex max-w-full min-w-0 items-center gap-1 text-base leading-5 font-semibold"
              >{#if dm && title}<span class="truncate">{title}</span
                >{:else if thread === "main" && !dm}<span class="truncate"
                  >{t("Sala principal")}</span
                >{:else}<span class="flex h-5 items-center"
                  >{@render line("w-32")}</span
                >{/if}<Icon
                icon="chevron-down"
                size={16}
                class="shrink-0"
              /></span
            >
            {#if !dm}{#if title}<span
                  class="max-w-full truncate text-xs leading-4 text-muted-foreground"
                  >{title}</span
                >{:else}<span class="flex h-4 items-center"
                  >{@render line("w-20", "h-2.5")}</span
                >{/if}{/if}
          </span>
        </div>
        <span
          aria-hidden="true"
          class="grid size-10 shrink-0 place-items-center"
          >{#if me}<PersonAvatar
              email={me.email}
              version={me.avatar}
              size="sm"
            />{:else}<Skeleton class="size-8 rounded-full" />{/if}</span
        >
      </header>

      <div class="flex min-h-0 flex-1 flex-col overflow-hidden px-4 md:px-6">
        <div
          class="flex flex-1 flex-col items-center justify-center gap-3 py-8 text-center"
        >
          {@render mark("size-12", "rounded-xl")}
          {#if title}<p class="m-0 max-w-full truncate text-base font-semibold">
              {title}
            </p>{/if}
          <p
            role="status"
            class="m-0 text-muted-foreground motion-safe:animate-pulse"
          >
            {t("Carregando…")}
          </p>
        </div>
        <div aria-hidden="true" class="flex flex-col gap-5 pb-4">
          {#each [["w-24", "w-3/5"], ["w-32", "w-2/5"], ["w-20", "w-1/2"]] as [name, body] (name)}
            <div class="flex items-start gap-3">
              <Skeleton class="size-8 shrink-0 rounded-full" />
              <div class="flex min-w-0 flex-1 flex-col gap-2 pt-1">
                {@render line(name, "h-2.5")}
                {@render line(body)}
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- The composer, alone at the bottom on phones: it carries the home-bar inset. -->
      <div
        aria-hidden="true"
        class="shrink-0 max-md:pb-[env(safe-area-inset-bottom)]"
      >
        <!-- The composer's own shape (composer/shape.ts), so nothing moves when it loads. -->
        <div class={["max-md:contents", COMPOSER_SLOT]}>
          <div class={COMPOSER_FRAME}>
            <div
              class={[
                "flex items-center gap-2 text-muted-foreground",
                COMPOSER_BOX,
                COMPOSER_ROW,
              ]}
            >
              <span class="min-w-0 flex-1 truncate pl-2.5"
                >{t("Mensagem…")}</span
              >
              <Skeleton class="h-8 w-16 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- Doc: a few lines at the width the room opens with (vb.docW, the same
       width animation the room's doc cell seeks); its tabs are in the top bar. -->
    {#if !dm}<section
        aria-hidden="true"
        use:roomDocumentWidth
        class="hidden min-h-0 animate-room-document-width flex-col border-l border-border md:flex"
      >
        <div class="flex flex-col gap-3 px-4 pt-4">
          {@render line("w-2/5", "h-4")}
          {@render line("w-full")}
          {@render line("w-5/6")}
          {@render line("w-3/5")}
        </div>
      </section>{/if}
  </div>
</div>
