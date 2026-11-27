<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import { get } from "svelte/store";
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
  import type { SidebarProps } from "../../app/sidebar";
  import { dmPeer, roomAvatarVersion } from "../room-scope/model";
  import { isPanelToggleKey, phoneMenuPanes } from "./panelViews";
  import { paneIcons, paneLabel } from "../documents/paneIcons";
  import DropdownMenu from "../../lib/studio/DropdownMenu.svelte";
  import DropdownMenuTrigger from "../../lib/studio/DropdownMenuTrigger.svelte";
  import DropdownMenuContent from "../../lib/studio/DropdownMenuContent.svelte";
  import DropdownMenuItem from "../../lib/studio/DropdownMenuItem.svelte";
  import DropdownMenuSeparator from "../../lib/studio/DropdownMenuSeparator.svelte";
  import { studioType } from "../../lib/components/type";
  import {
    NO_SEARCH,
    roomSearch,
    searchActive,
    searchOf,
    searchPaneStep,
    searchPlaceholder,
    type PaneBefore,
    type SearchFilter,
  } from "../chat/roomSearch";
  import RoomSearchField from "../chat/RoomSearchField.svelte";
  import Count from "../../lib/components/Count.svelte";
  import { userCenterCount } from "../user-center/count";
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
    agentsOnline = 0,
    onstartcall,
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
    /** Phone: the room's agents that listen now, for the main thread's subtitle. */
    agentsOnline?: number;
    /** "Iniciar chamada" in ⋮, while the room has no call (phone: Gimenes #6032; desktop: #6099). */
    onstartcall?: () => void;
  } = $props();
  const personal = untrack(() => presentation.services.personal.state),
    geometry = untrack(() => layout.state);
  const live = (event: Event) =>
    current() &&
    event.currentTarget instanceof HTMLElement &&
    event.currentTarget.isConnected;
  const waits = $derived($personal.me?.waits ?? []);
  // Phone: the user center's rows wait on the Chats list, not over the chat; ← shows how many (Gimenes, step 4).
  const pwaView = untrack(() => presentation.services.pwa.state);
  const centerCount = $derived(
    $geometry.mobile
      ? userCenterCount({
          update: $personal.updateAvailable,
          pwa: $pwaView,
          me: $personal.me,
        })
      : 0,
  );
  const centerText = $derived(
    centerCount === 1
      ? presentation.services.t("1 aviso pra você")
      : presentation.services.t("{n} avisos pra você", { n: centerCount }),
  );
  const centerLabel = $derived(centerCount ? ` · ${centerText}` : "");
  // The tab's icon carries a red dot while the title shows "(n)".
  $effect(() => setFaviconBadge(waits.length > 0));
  onDestroy(() => setFaviconBadge(false));
  // A DM's face stands for it, the same as in your DM list.
  const peer = $derived(dmPeer(header.room));
  // Phone, a room: how many other members are online now.
  const othersOnline = $derived(
    header.room.members.filter(
      (email) => email !== header.room.me && header.room.online.includes(email),
    ).length,
  );
  const en = $derived(presentation.services.language === "en");
  const t = (text: string, vars?: Record<string, string | number>) =>
    presentation.services.t(text, vars);
  // A room's main thread (not a DM, not an epic or a view).
  const roomMain = $derived(
    !header.room.book.dm &&
      threadTitle(header.room, header.thread) === undefined,
  );
  // Phone title: the most important line first. In a thread, its title, and
  // under it the room with the epic's progress (Gimenes #3739). In a room's
  // main thread, the room's icon and name on one line, like a DM's face and
  // name (Gimenes #5919, #5923).
  const phoneTitle = $derived(
    (!header.room.book.dm && threadTitle(header.room, header.thread)) ||
      header.room.book.title,
  );
  // Desktop: in a room's main thread the search takes the quiet "Sala principal"
  // label's place, at the bar's start (Gimenes #3902). Elsewhere the bar names
  // the epic or the view, and the search stays at the end.
  const searchInTitle = $derived(roomMain);
  const searchLabel = $derived(
    searchPlaceholder(header.room.book, presentation.services.t),
  );
  const phoneEpic = $derived(
    header.room.epics.find((epic) => epic.id === header.thread),
  );
  // Phone, one bar (B, Gimenes #6016, #6030, #6052): the main thread's subtitle is like a WhatsApp group's. With
  // someone online, "3 online · 2 agentes"; with only agents, "2 agentes trabalhando"; else the members' names.
  const mainSubtitle = $derived.by(() => {
    const online = othersOnline;
    if (online)
      return [
        t("{n} online", { n: online }),
        agentsOnline
          ? t(agentsOnline === 1 ? "1 agente" : "{n} agentes", {
              n: agentsOnline,
            })
          : "",
      ]
        .filter(Boolean)
        .join(" · ");
    if (agentsOnline)
      return t(
        agentsOnline === 1 ? "1 agente trabalhando" : "{n} agentes trabalhando",
        { n: agentsOnline },
      );
    const room = header.room;
    const names = room.members
      .filter((email) => email !== room.me)
      .map(
        (email) =>
          (room.names?.[email] ?? email.split("@")[0] ?? "").split(" ")[0],
      );
    const shown = names.slice(0, 5).join(", ");
    return names.length > 5
      ? t("{names} e mais {n}", { names: shown, n: names.length - 5 })
      : shown;
  });
  const peerOnline = $derived(!!peer && header.room.online.includes(peer));
  const peerName = $derived(
    peer
      ? (header.room.names?.[peer] ?? peer.split("@")[0] ?? "").split(" ")[0]
      : "",
  );
  // Phone ⋮: the call first, then the room's panes (a DM has no doc or people).
  const phoneMenu = $derived(
    phoneMenuPanes(!!header.room.book.dm).map((pane) => ({
      pane,
      label: paneLabel(pane, en),
      icon: paneIcons[pane],
    })),
  );
  const phoneSubtitle = $derived(
    header.room.book.dm
      ? peerOnline
        ? t("online")
        : ""
      : roomMain
        ? mainSubtitle
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
  // Phone, a pane open in the sheet (Gimenes #6117): the bar says which pane, with the room under it, and ← goes back
  // to the chat. There is no strip under the bar: the ⋮ switches panes.
  const sheetPane = $derived(
    $geometry.mobile && $geometry.sheet === "doc" ? $geometry.pane : null,
  );
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
  // Desktop ⋮ (Gimenes #6099): the panes the tabs had, in their order. A DM has no doc or people. The open file
  // beside the chat is an item too, with its own name.
  const desktopMenu = $derived.by(() => {
    if (!tabs) return [];
    const dm = !!header.room.book.dm;
    const panes: DocumentPane[] = [
      "doc",
      "files",
      "apps",
      "decisions",
      "reminders",
      "people",
    ].filter(
      (pane) => !dm || (pane !== "doc" && pane !== "people"),
    ) as DocumentPane[];
    if (tabs.sideFileName) panes.push("view");
    const done = phoneEpic?.tasks.filter((task) => task.done).length ?? 0;
    return panes.map((pane) => ({
      pane,
      label:
        pane === "view" && tabs.sideFileName
          ? tabs.sideFileName
          : paneLabel(pane, en),
      icon: paneIcons[pane],
      count:
        pane === "doc"
          ? phoneEpic?.tasks.length
            ? `${done}/${phoneEpic.tasks.length}`
            : ""
          : pane === "reminders"
            ? tabs.counts?.reminders
              ? String(tabs.counts.reminders)
              : ""
            : "",
    }));
  });
  // The pane open beside the chat, for the ✓ in ⋮ and the chip.
  const openPane = $derived(
    split ? desktopMenu.find((item) => item.pane === tabs?.pane) : undefined,
  );
  // The room's search (like Discord's): typing or picking a person opens the Search pane beside the chat, which
  // lists the matches. Clearing it gives the column back as it was: the pane open before, or no pane.
  const searching = $derived(searchOf($roomSearch, header.room.id));
  let paneBefore: PaneBefore | null = null;
  function searchRoom(next: SearchFilter) {
    if (!current()) return;
    roomSearch.set({ room: header.room.id, ...next });
    const step = searchPaneStep(searchActive(next), layout.read(), paneBefore);
    if (step.kind === "open") {
      paneBefore = step.before;
      if (!layout.read().documentVisible) layout.toggleDocument();
      onPane?.("search");
    } else if (step.kind === "restore") {
      paneBefore = null;
      onPane?.(step.pane);
    } else if (step.kind === "close") {
      paneBefore = null;
      // Back to the old pane first (picking a pane opens it), then closed.
      layout.setPane(step.pane, { quiet: true });
      if (layout.read().documentVisible) layout.toggleDocument();
    } else if (!searchActive(next)) paneBefore = null;
  }
  // The search is this room's: leaving the room ends it.
  onDestroy(() => {
    if (get(roomSearch).room === header.room.id)
      roomSearch.set({ room: "", ...NO_SEARCH });
  });
  function onwindowkeydown(event: KeyboardEvent) {
    if (event.defaultPrevented || !current()) return;
    if (!isPanelToggleKey(event, mac)) return;
    event.preventDefault();
    if (split) closePane();
    else layout.toggleDocument();
  }
</script>

<svelte:window onkeydown={onwindowkeydown} />
<!-- The room's search field: at the bar's start in the main thread, else at its end. Desktop only: a phone draws it
     in the Search pane. -->
{#snippet search(size: string)}<RoomSearchField
    value={searching}
    onchange={searchRoom}
    members={header.room.members}
    me={header.room.me}
    placeholder={searchLabel}
    vb={header.vb}
    class={["hidden md:flex", size].join(" ")}
  />{/snippet}
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
            sheetPane
              ? "Voltar para o chat"
              : expectedThread === "main"
                ? "Suas salas"
                : "Voltar pra sala principal",
          ) + centerLabel}
          tooltipSide="bottom"
          data-phone-back
          size="icon"
          class={[
            "size-10 rounded-full",
            // Desktop: ← only in a thread, back to the room's main thread (Gimenes #6122).
            expectedThread === "main" ? "md:hidden" : "md:-ml-1 md:size-8",
          ].join(" ")}
          onclick={(event) => {
            if (!live(event)) return;
            if (sheetPane) layout.closeSheet();
            else back(expectedThread);
          }}
          ><Icon
            icon="arrow-left"
            size={$geometry.mobile ? 20 : 18}
          />{#if $geometry.mobile && centerCount}<Count
              value={centerCount}
              label={centerText}
              class="pointer-events-none absolute -top-0.5 -right-1 ring-2 ring-background"
            />{/if}</IconButton
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
      />{:else}<!-- A room: its icon beside the name, in a thread too (Gimenes #6052). --><RoomAvatar
        title={header.room.book.title}
        icon={header.roomIcon}
        lang={en ? "en" : "pt"}
        surface="background"
      />{/if}<!-- Left, right after ← (Gimenes #3791). --><span
      class="flex min-w-0 flex-col items-start"
      ><span
        class="flex max-w-full min-w-0 items-center gap-1 text-base leading-5 font-semibold"
        ><span data-phone-thread class="truncate"
          >{sheetPane ? paneLabel(sheetPane, en) : phoneTitle}</span
        ><Icon icon="chevron-down" size={16} class="shrink-0" /></span
      >{#if sheetPane || phoneSubtitle}<span
          data-phone-room
          class="max-w-full truncate text-xs leading-4 text-muted-foreground"
          >{sheetPane ? header.room.book.title : phoneSubtitle}</span
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
        [
          "mr-1 h-8 px-2.5 transition-[width] duration-150",
          searching.person ? "w-64" : "w-44 focus-within:w-60",
        ].join(" "),
      )}{/if}
    {#if tabs}<!-- Desktop (Gimenes #6099): the panes and the call sit in ⋮, like the phone's; the bar keeps the search and ⋮. -->
      <div data-header-more class="hidden shrink-0 items-center gap-1 md:flex">
        {#if openPane}<!-- B (Gimenes #6113, #6133): the open pane's chip, × closes it. --><span
            data-header-pane-chip
            class="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg bg-accent pr-0.5 pl-2.5 text-sm font-medium text-foreground"
            ><span class="max-w-40 truncate">{openPane.label}</span
            >{#if openPane.count}<span
                class="text-xs text-muted-foreground tabular-nums"
                >{openPane.count}</span
              >{/if}<IconButton
              label={t("Fechar {pane}", { pane: openPane.label })}
              tooltipSide="bottom"
              size="icon-xs"
              class="text-muted-foreground hover:bg-background hover:text-foreground"
              onclick={(event) => {
                if (live(event)) closePane();
              }}><Icon icon="x" size={14} /></IconButton
            ></span
          >{/if}<DropdownMenu
          ><DropdownMenuTrigger
            >{#snippet child({ props })}<IconButton
                {...props}
                label={t("Mais opções")}
                tooltipSide="bottom"
                data-desktop-more
                size="icon"
                class="shrink-0 text-muted-foreground hover:text-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground"
                ><Icon icon="dots-vertical" size={18} /></IconButton
              >{/snippet}</DropdownMenuTrigger
          ><DropdownMenuContent
            align="end"
            sideOffset={6}
            data-desktop-more-menu
            class={[studioType, "w-56"].join(" ")}
            >{#if onstartcall}<DropdownMenuItem
                data-desktop-more-item="call"
                onSelect={() => {
                  if (current()) onstartcall();
                }}
                ><Icon icon="phone" />{peerName
                  ? t("Ligar para {name}", { name: peerName })
                  : t("Iniciar chamada")}</DropdownMenuItem
              ><DropdownMenuSeparator
              />{/if}{#each desktopMenu as item (item.pane)}<DropdownMenuItem
                data-desktop-more-item={item.pane}
                onSelect={() => pickPane(item.pane)}
                ><Icon icon={item.icon} /><span class="min-w-0 flex-1 truncate"
                  >{item.label}</span
                >{#if item.count}<span
                    class="text-xs text-muted-foreground tabular-nums"
                    >{item.count}</span
                  >{/if}{#if openPane?.pane === item.pane}<Icon
                    icon="check"
                    class="text-foreground"
                  />{/if}</DropdownMenuItem
              >{/each}</DropdownMenuContent
          ></DropdownMenu
        >
      </div>{/if}
    {#if $geometry.mobile}<!-- Phone: the search opens its pane in the sheet, with the field at its top. --><IconButton
        label={searchLabel}
        tooltipSide="bottom"
        data-phone-search
        size="icon"
        class="size-10 shrink-0 rounded-full md:hidden"
        onclick={(event) => {
          if (live(event)) onPane?.("search");
        }}><Icon icon="search-md" size={20} /></IconButton
      >{/if}
    {#if $geometry.mobile}<!-- Phone (B, Gimenes #6016, #6032, #6052): ⋮ holds the call and the room's panes. --><DropdownMenu
        ><DropdownMenuTrigger
          >{#snippet child({ props })}<IconButton
              {...props}
              label={t("Mais opções")}
              tooltipSide="bottom"
              data-phone-more
              size="icon"
              class="size-10 shrink-0 rounded-full data-[state=open]:bg-accent md:hidden"
              ><Icon icon="dots-vertical" size={20} /></IconButton
            >{/snippet}</DropdownMenuTrigger
        ><DropdownMenuContent
          align="end"
          sideOffset={6}
          data-phone-more-menu
          class={[studioType, "w-56"].join(" ")}
          >{#if onstartcall}<DropdownMenuItem
              data-phone-more-item="call"
              onSelect={() => {
                if (current()) onstartcall();
              }}
              ><Icon icon="phone" />{peerName
                ? t("Ligar para {name}", { name: peerName })
                : t("Iniciar chamada")}</DropdownMenuItem
            ><DropdownMenuSeparator
            />{/if}{#each phoneMenu as item (item.pane)}<DropdownMenuItem
              data-phone-more-item={item.pane}
              aria-current={sheetPane === item.pane ? "page" : undefined}
              class="aria-[current=page]:bg-accent"
              onSelect={() => {
                if (current()) onPane?.(item.pane);
              }}><Icon icon={item.icon} />{item.label}</DropdownMenuItem
            >{/each}</DropdownMenuContent
        ></DropdownMenu
      >{/if}
  </div>
</header>
