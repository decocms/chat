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
  import { roomDocumentOpen, roomDocumentWidth } from "../room-layout/preview";
  import { EPIC_PROGRESS, MESSAGE_AVATAR, MESSAGE_ROW } from "./shape";
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
  // The pane as the room will open it: closed if you left it closed (room-layout/model.ts, Gimenes #3938).
  const documentOpen = roomDocumentOpen(
    typeof window === "undefined" ? undefined : window,
  );
  // The main thread's top bar holds the room's search where the thread's name was (RoomHeader, #318).
  const searchLabel = $derived(
    title ? t("Buscar em {room}", { room: title }) : t("Buscar nesta sala"),
  );
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
    <!-- Sidebar: the room's name (the main thread), epics, Pinned, People, then
       your agent and you at its foot. -->
    <aside
      aria-hidden={dm ? undefined : "true"}
      class="hidden w-room-sidebar min-h-0 flex-col gap-6 border-r border-border bg-sidebar px-2 pb-4 text-sidebar-foreground md:row-span-2 md:flex"
    >
      {#if dm}<div class="flex min-h-0 flex-col pt-2">
          <DmNav controller={services.navigation} lang={services.language} />
        </div>{:else}<div class="flex flex-col gap-3">
          <!-- The room's name row (SidebarHeader) as it will land, then the epic list's tabs (EpicTree). -->
          <div
            class="-mx-2 flex h-[52px] shrink-0 items-center gap-2 border-b border-border pr-2 pl-4 font-semibold"
          >
            {@render mark("size-6")}
            {#if title}<span class="min-w-0 flex-1 truncate">{title}</span
              >{:else}{@render line("w-32")}{/if}
          </div>
          <div
            class="grid grid-cols-2 rounded-lg bg-sidebar-accent/60 p-0.5 text-center text-xs text-muted-foreground"
          >
            <span class="rounded-md bg-background py-1 text-foreground"
              >{t("Threads abertas")}</span
            ><span class="py-1">{t("Feitas")}</span>
          </div>
          <!-- Epic rows (EpicTree): avatar, title, the status at the end, the task bar under. -->
          <div class="-mt-1 flex flex-col gap-0.5">
            {#each ["w-3/5", "w-2/5", "w-1/2"] as width (width)}
              <div class="relative flex h-9 items-center gap-2 px-2">
                <Skeleton class="size-5 shrink-0 rounded-full" />
                <span class="flex min-w-0 flex-1"
                  >{@render line(width, "h-2.5")}</span
                >
                <Skeleton class="size-3.5 shrink-0 rounded-full" />
                <span class={[EPIC_PROGRESS, "rounded-full"]}></span>
              </div>
            {/each}
          </div>
          <div
            class="flex h-9 items-center gap-2 rounded-lg border border-dashed border-border px-2 text-muted-foreground"
          >
            <span class="flex size-5 shrink-0 items-center justify-center"
              ><Icon icon="plus" size={16} /></span
            >{t("Nova thread")}
          </div>
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
      <!-- What RoomHeader puts there: on the main thread the room's search; in an epic, its face and name. -->
      <div class="flex min-w-0 flex-1 items-center">
        {#if thread === "main" && !dm}<span
            class="flex h-8 w-full max-w-80 items-center gap-1.5 rounded-lg bg-muted px-2.5 text-muted-foreground"
            ><Icon icon="search-md" size={14} /><span class="truncate"
              >{searchLabel}</span
            ></span
          >{:else}{@render mark("size-6")}<span
            class="flex min-w-0 flex-1 items-center px-2"
            >{#if dm && title}<span class="truncate font-medium">{title}</span
              >{:else}{@render line("w-40")}{/if}</span
          >{/if}
      </div>
      <!-- The pane's tabs (DocumentToolbar): Doc with its name, then five icons. -->
      {#if !dm}<span class="flex h-8 shrink-0 items-center gap-1.5 px-2"
          ><Skeleton class="size-4 rounded-full" />{@render line(
            "w-7",
            "h-2.5",
          )}</span
        >{/if}
      {#each [0, 1, 2, 3, 4] as slot (slot)}
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
        <!-- Messages as Message.svelte draws them: a 40px avatar, the name and time, the text (room-shell/shape.ts). -->
        <div aria-hidden="true" class="flex flex-col gap-3 pb-4">
          {#each [["w-24", "w-3/5", "w-2/5"], ["w-32", "w-4/5", ""], ["w-20", "w-1/2", ""]] as [name, body, more] (name)}
            <div class="px-3 pt-1 pb-0.5">
              <div class={MESSAGE_ROW}>
                <div class={MESSAGE_AVATAR}>
                  <Skeleton class="size-10 rounded-full" />
                </div>
                <div class="flex min-w-0 flex-1 flex-col gap-2 pt-1">
                  <span class="flex items-center gap-2"
                    >{@render line(name, "h-3")}{@render line(
                      "w-10",
                      "h-2.5",
                    )}</span
                  >
                  {@render line(body)}
                  {#if more}{@render line(more)}{/if}
                </div>
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
       width animation the room's doc cell seeks); its tabs are in the top bar.
       None when you left the pane closed, as the room will open (vb.docClosed). -->
    {#if !dm && documentOpen}<section
        data-room-skeleton-document
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
