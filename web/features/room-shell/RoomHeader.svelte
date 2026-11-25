<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import type { ComponentProps, Snippet } from "svelte";
  import Separator from "../../lib/studio/Separator.svelte";
  import RoomBarTitle from "./RoomBarTitle.svelte";
  import { tabTitle } from "../notifications/title";
  import { setFaviconBadge } from "../notifications/favicon";
  import type { ThreadHeaderProps } from "../room-sidebar/types";
  import DocumentToolbar from "../documents/DocumentToolbar.svelte";
  import type { DocumentPane } from "../documents/types";
  import type { ApplicationRoomPresentation } from "../application/shellTypes";
  import type { RoomLayoutController } from "../room-layout/types";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import RoomAvatar from "../rooms/RoomAvatar.svelte";
  import { threadTitle } from "../room-sidebar/model";
  import Snapshot from "../../lib/components/Snapshot.svelte";
  import AccountRow from "../app-navigation/AccountRow.svelte";
  import type { SidebarProps } from "../../app/sidebar";
  import { dmPeer, roomAvatarVersion } from "../room-scope/model";
  import { isPanelToggleKey, phoneStripPanes } from "./panelViews";
  import PersonAvatar from "../../lib/components/PersonAvatar.svelte";
  import PresenceDot from "../../lib/components/PresenceDot.svelte";
  import AvatarStack from "../../lib/components/AvatarStack.svelte";
  import { roomSearchQuery } from "../chat/roomSearch";
  let {
    presentation,
    header,
    layout,
    current,
    appNavigation,
    back,
    tabs,
    onPane,
    viewControls,
  }: {
    presentation: ApplicationRoomPresentation;
    header: ThreadHeaderProps;
    layout: RoomLayoutController;
    current(): boolean;
    /** Search and your settings: on a phone the rail is hidden, so the header carries them. */
    appNavigation?: SidebarProps["appNavigation"];
    back(expectedThread: string): void;
    /** Desktop: the pane tabs live in this bar (one top bar, the split below it). */
    tabs?: ComponentProps<typeof DocumentToolbar>;
    onPane?(pane: DocumentPane): void;
    /** Desktop: the controls of the view in the middle, before the pane's tabs,
     * after a vertical divider. See docs/design.md (Top bar). */
    viewControls?: Snippet;
  } = $props();
  const personal = untrack(() => presentation.services.personal.state),
    geometry = untrack(() => layout.state);
  const live = (event: Event) =>
    current() &&
    event.currentTarget instanceof HTMLElement &&
    event.currentTarget.isConnected;
  const waits = $derived($personal.me?.waits ?? []);
  // The tab's icon carries a red dot while the title shows "(n)".
  $effect(() => setFaviconBadge(waits.length > 0));
  onDestroy(() => setFaviconBadge(false));
  // A DM's face stands for it, the same as in your DM list.
  const peer = $derived(dmPeer(header.room));
  // Phone, a room: the other people, online first; two faces, then "+N".
  const phonePeople = $derived.by(() => {
    const room = header.room;
    const others = room.members.filter((email) => email !== room.me);
    const online = others.filter((email) => room.online.includes(email));
    const order = [
      ...online,
      ...others.filter((email) => !online.includes(email)),
    ];
    return {
      faces: order.slice(0, 2),
      online,
      more: Math.max(0, order.length - 2),
    };
  });
  const en = $derived(presentation.services.language === "en");
  // Phone title: the most important line first (the open thread, or a DM's
  // person), and under it the room with the epic's progress (Gimenes #3739).
  const phoneTitle = $derived(
    header.room.book.dm
      ? header.room.book.title
      : (threadTitle(header.room, header.thread) ??
          presentation.services.t("Sala principal")),
  );
  // Desktop: in a room's main thread the search takes the quiet "Sala principal"
  // label's place, at the bar's start (Gimenes #3902). Elsewhere the bar names
  // the epic or the view, and the search stays at the end.
  const searchInTitle = $derived(
    !header.room.book.dm &&
      threadTitle(header.room, header.thread) === undefined,
  );
  const searchLabel = $derived(
    header.room.book.dm
      ? presentation.services.t("Buscar na conversa")
      : header.room.book.title
        ? presentation.services.t("Buscar em {room}", {
            room: header.room.book.title,
          })
        : presentation.services.t("Buscar nesta sala"),
  );
  const phoneEpic = $derived(
    header.room.epics.find((epic) => epic.id === header.thread),
  );
  const phoneSubtitle = $derived(
    header.room.book.dm
      ? ""
      : [
          header.room.book.title,
          phoneEpic?.tasks.length
            ? presentation.services.t("{done} de {total} tarefas", {
                done: phoneEpic.tasks.filter((task) => task.done).length,
                total: phoneEpic.tasks.length,
              })
            : "",
        ]
          .filter(Boolean)
          .join(" · "),
  );
  const t = (text: string, vars?: Record<string, string | number>) =>
    presentation.services.t(text, vars);
  const mac =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  // Desktop: the right pane (doc, files, apps, decisions, reminders) beside
  // the chat. The pane open beside the chat: its tab shows selected.
  const split = $derived(!$geometry.mobile && $geometry.documentVisible);
  // A tab brings the chat back, then opens that pane, or closes it when it's
  // the one already open (this replaced the pane toggle button).
  /** The open pane's tab is a toggle: a second click closes the pane, the Doc too (Gimenes #3900). */
  function closePane() {
    layout.toggleDocument();
  }
  function pickPane(pane: DocumentPane) {
    if (!current()) return;
    if (split && layout.read().pane === pane) {
      closePane();
      return;
    }
    if (!layout.read().documentVisible) layout.toggleDocument();
    onPane?.(pane);
  }
  // The room's search (like Discord's): typing opens the Search pane beside the chat, which lists the matches.
  function searchRoom(value: string) {
    if (!current()) return;
    roomSearchQuery.set(value);
    if (value.trim() && !(split && layout.read().pane === "search")) {
      if (!layout.read().documentVisible) layout.toggleDocument();
      onPane?.("search");
    }
  }
  function onwindowkeydown(event: KeyboardEvent) {
    if (event.defaultPrevented || !current()) return;
    if (!isPanelToggleKey(event, mac)) return;
    event.preventDefault();
    if (split) closePane();
    else layout.toggleDocument();
  }
</script>

<svelte:window onkeydown={onwindowkeydown} />
<!-- The room's search field: at the bar's start in the main thread, else at its end. -->
{#snippet search(size: string)}<label
    data-room-search-field
    class={[
      "hidden shrink-0 items-center gap-1.5 rounded-lg bg-muted text-muted-foreground focus-within:text-foreground md:flex",
      size,
    ]}
    ><Icon icon="search-md" size={14} /><input
      type="text"
      inputmode="search"
      value={$roomSearchQuery}
      placeholder={searchLabel}
      aria-label={searchLabel}
      class="h-full min-w-0 flex-1 border-0 bg-transparent font-sans text-sm text-foreground outline-none placeholder:text-muted-foreground"
      oninput={(event) => searchRoom(event.currentTarget.value)}
      onkeydown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          searchRoom("");
          event.currentTarget.blur();
        }
      }}
    />{#if $roomSearchQuery}<IconButton
        label={t("Limpar busca")}
        tooltipSide="bottom"
        size="icon-xs"
        class="-mr-1.5 text-muted-foreground hover:text-foreground"
        onclick={() => searchRoom("")}><Icon icon="x" size={14} /></IconButton
      >{/if}</label
  >{/snippet}
<!-- The tab's name follows the room (the server's <title> only names the first page, in the room's language). -->
<svelte:head
  ><title
    >{tabTitle(
      header.room.book.title
        ? `${header.room.book.title} · deco.chat`
        : "deco.chat",
      waits.length,
    )}</title
  ></svelte:head
>

<header
  data-room-bar
  data-room-document-toolbar
  class="flex min-w-0 flex-1 flex-wrap items-center gap-1 font-sans text-sm text-foreground md:flex-nowrap"
>
  {#key header.thread}<Snapshot value={header.thread}
      >{#snippet children(expectedThread)}<IconButton
          label={t(
            expectedThread === "main"
              ? "Suas salas"
              : "Voltar pra sala principal",
          )}
          tooltipSide="bottom"
          data-phone-back
          size="icon"
          class="size-10 rounded-full md:hidden"
          onclick={(event) => {
            if (live(event)) back(expectedThread);
          }}><Icon icon="arrow-left" size={20} /></IconButton
        >{/snippet}</Snapshot
    >{/key}
  <button
    type="button"
    data-phone-title
    aria-label={t("Trocar de conversa")}
    class="flex min-w-0 flex-1 basis-0 cursor-pointer items-center justify-start gap-2 rounded-lg border-0 bg-transparent px-1.5 py-1 text-left font-sans text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
    onclick={(event) => {
      if (live(event)) header.onopenside();
    }}
    >{#if peer}<!-- A DM: the person's face beside their name. --><RoomAvatar
        title={header.room.book.title}
        icon={header.roomIcon}
        person={{
          email: peer,
          version: roomAvatarVersion(header.room, $personal.me, peer),
        }}
        lang={en ? "en" : "pt"}
        surface="background"
      />{/if}<!-- Left, right after ← (Gimenes #3791). --><span
      class="flex min-w-0 flex-col items-start"
      ><span
        class="flex max-w-full min-w-0 items-center gap-1 text-base leading-5 font-semibold"
        ><span data-phone-thread class="truncate">{phoneTitle}</span><Icon
          icon="chevron-down"
          size={16}
          class="shrink-0"
        /></span
      >{#if phoneSubtitle}<span
          data-phone-room
          class="max-w-full truncate text-xs leading-4 text-muted-foreground"
          >{phoneSubtitle}</span
        >{/if}</span
    ></button
  >
  <!-- Desktop, one bar over chat and pane: what fills the middle (with the epic's actions), then the pane's tabs at the end. -->
  <div class="contents md:flex md:min-w-0 md:flex-1 md:items-center md:gap-1">
    <div
      data-header-title
      class="hidden min-w-0 flex-1 basis-0 md:flex md:min-w-24"
    >
      {#if searchInTitle}{@render search("h-8 w-full max-w-80 px-2.5")}{/if}
      <RoomBarTitle
        room={header.room}
        thread={header.thread}
        owner={header.owner}
        vb={header.vb}
        quietLabel={!searchInTitle}
      />
    </div>
  </div>
  <div class="contents md:flex md:min-w-0 md:shrink md:items-center md:gap-1">
    {#if viewControls}<div
        data-header-view-controls
        class="hidden shrink-0 items-center gap-1 md:flex"
      >
        {@render viewControls()}{#if tabs}<Separator
            orientation="vertical"
            class="mx-1.5 h-5 data-[orientation=vertical]:h-5"
          />{/if}
      </div>{/if}
    <!-- A DM has the search too (Gimenes #4326), at the bar's end: the person's name keeps the title's place. -->
    {#if !searchInTitle}{@render search(
        "mr-1 h-8 w-44 px-2.5 transition-[width] duration-150 focus-within:w-60",
      )}{/if}
    {#if tabs}<div data-header-tabs class="hidden min-w-0 md:block">
        <DocumentToolbar
          {...tabs}
          bare
          exclude={header.room.book.dm
            ? ["agents", "doc", "people", "search"]
            : ["agents", "search"]}
          pane={split ? tabs.pane : ("" as DocumentPane)}
          onPane={pickPane}
        />
      </div>{/if}
    {#if !header.room.book.dm && $geometry.mobile}<!-- Phone, a room (A2, Gimenes #4309): the people at the bar's end, online first; a tap opens Pessoas. Your own account is at the drawer's top. --><button
        type="button"
        data-phone-people
        aria-label={t("Pessoas na sala")}
        class="flex h-10 shrink-0 cursor-pointer items-center rounded-full border-0 bg-transparent px-1 focus-visible:outline-2 focus-visible:outline-ring md:hidden"
        onclick={() => onPane?.("people")}
        >{#if phonePeople.faces.length || phonePeople.more}<AvatarStack
            class="items-center"
            items={phonePeople.faces}
            key={(email) => email}
            more={phonePeople.more}
            >{#snippet face(email)}<PersonAvatar
                {email}
                version={roomAvatarVersion(header.room, $personal.me, email)}
                class="size-7 ring-2 ring-background"
              />{#if phonePeople.online.includes(email)}<PresenceDot
                  online
                  class="size-2.5 ring-background"
                />{/if}{/snippet}</AvatarStack
          >{:else}<Icon icon="user-plus-01" size={20} />{/if}</button
      >{:else if $personal.me}<span
        data-phone-account
        class="contents md:hidden"
        ><AccountRow me={$personal.me} row={false} /></span
      >{/if}
  </div>
  <!-- Phone (A2, Gimenes #4309, #4331): Doc · Arquivos · Decisões · Lembretes under the bar. A tap opens that pane in
       the sheet; while the sheet is open its own tab row (the one you drag to close it) takes this row's place.
       Drawn only on a phone, not hidden with CSS: the desktop bar must have one set of pane tabs. -->
  {#if tabs && $geometry.mobile && $geometry.sheet !== "doc"}<div
      data-phone-strip
      class="basis-full md:hidden [&_button]:justify-center [&_button]:gap-1 [&_button]:px-1.5 [&>div]:border-b-0 [&>div]:px-0 [&>div]:pt-0"
    >
      <DocumentToolbar
        {...tabs}
        compact
        pane={"" as DocumentPane}
        only={phoneStripPanes(!!header.room.book.dm)}
        onPane={(pane) => onPane?.(pane)}
      />
    </div>{/if}
</header>
