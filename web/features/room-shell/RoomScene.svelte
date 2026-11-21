<script lang="ts">
  import { onDestroy, tick, untrack } from "svelte";
  import { get, readable } from "svelte/store";
  import { provideRichFileIndex } from "../rich-text/fileContext";
  import type { InboxSnapshot } from "../application/inbox";
  import type { ApplicationRoomPresentation } from "../application/shellTypes";
  import type { ApplicationRoomScope } from "../application/types";
  import type { RoomResources } from "../application/roomResources";
  import type { RoomScope, RoomScopeBrowser } from "../room-scope/types";
  import type { RoomLayoutBrowser } from "../room-layout/types";
  import { createRoomScope } from "../room-scope/controller";
  import { createRoomScopeBrowser } from "../room-scope/browser";
  import { createRoomLayout } from "../room-layout/controller";
  import { createRoomLayoutBrowser } from "../room-layout/browser";
  import RoomLayout from "../room-layout/RoomLayout.svelte";
  import Sidebar from "../room-sidebar/Sidebar.svelte";
  import Chat from "../chat/Chat.svelte";
  import Composer from "../composer/Composer.svelte";
  import DocumentPanel from "../documents/DocumentPanel.svelte";
  import RoomSearch from "../chat/RoomSearch.svelte";
  import { threadTitle } from "../room-sidebar/model";
  import DocumentToolbar from "../documents/DocumentToolbar.svelte";
  import { isDmId } from "../../../shared/dm";
  import AgentBanners from "../agents/AgentBanners.svelte";
  import AgentTrigger from "../agents/AgentTrigger.svelte";
  import AccountRow from "../app-navigation/AccountRow.svelte";
  import AgentFoot from "../agents/AgentFoot.svelte";
  import ThreadFiles from "../file-viewer/ThreadFiles.svelte";
  import SuggestionPreview from "../room-sidebar/SuggestionPreview.svelte";
  import RoomHeader from "./RoomHeader.svelte";
  import InboxControls from "../application/InboxControls.svelte";
  import PhoneRoomMenu from "./PhoneRoomMenu.svelte";
  import PhoneRoomSection from "./PhoneRoomSection.svelte";
  import { phoneTabOf, phoneTabPanes } from "./panelViews";
  import { attachRoomEdgeBack } from "./edgeBack";
  import type { RoomLayoutCells } from "../room-layout/types";
  import Dialog from "../../lib/studio/Dialog.svelte";
  import DialogContent from "../../lib/studio/DialogContent.svelte";
  import DialogHeader from "../../lib/studio/DialogHeader.svelte";
  import DialogTitle from "../../lib/studio/DialogTitle.svelte";
  import Button from "../../lib/studio/Button.svelte";
  import Snapshot from "../../lib/components/Snapshot.svelte";
  import { viewerText } from "../file-viewer/copy";
  import { createDeferredModule } from "../deferred-view/module";
  import DeferredViewStatus from "../deferred-view/DeferredViewStatus.svelte";
  let {
    presentation,
    resources,
    scope,
    browser: suppliedBrowser,
    layoutBrowser: suppliedLayoutBrowser,
  }: {
    presentation: ApplicationRoomPresentation;
    resources: RoomResources;
    scope: ApplicationRoomScope;
    browser?: RoomScopeBrowser;
    layoutBrowser?: RoomLayoutBrowser;
  } = $props();
  const services = untrack(() => presentation.services),
    captured = untrack(() => scope);
  const personal = untrack(() => services.personal.state);
  let active = true,
    scoped: RoomScope | undefined;
  const current = () => active && services.ownsRoom(captured);
  const browser = untrack(
    () => suppliedBrowser ?? createRoomScopeBrowser(window, document),
  );
  const layout = untrack(() =>
    createRoomLayout({
      scopeKey: JSON.stringify([
        captured.roomId,
        captured.account,
        captured.identityRevision,
        captured.roomGeneration,
      ]),
      current,
      documentHidden: isDmId(captured.roomId),
      onDocumentClosed: () => scoped?.actions.closeDocument(),
      onPane: (pane) => {
        if (current() && get(services.state).pane !== pane)
          services.actions.selectPane(pane);
      },
      browser: suppliedLayoutBrowser ?? createRoomLayoutBrowser(window),
    }),
  );
  const owner = untrack(() =>
      createRoomScope({ services, resources, layout, browser }),
    ),
    view = owner.state,
    geometry = layout.state;
  scoped = owner;
  provideRichFileIndex(owner.richFiles);
  function back(expectedThread: string) {
    const value = get(owner.state);
    if (!current() || !value || value.header.thread !== expectedThread) return;
    // Phones have no bottom bar (#3738): Back first leaves the full board or the doc sheet, back to the chat.
    const state = layout.read();
    if (state.mobile && state.boardFull) {
      layout.toggleBoard();
      return;
    }
    if (state.mobile && state.sheet === "doc") {
      layout.closeSheet();
      return;
    }
    if (expectedThread !== "main") owner.actions.setThread("main");
    else services.actions.home();
  }
  function edgeBack(cells: RoomLayoutCells) {
    const win = cells.root.ownerDocument.defaultView;
    return attachRoomEdgeBack(cells.root, {
      current,
      mobile: () => get(layout.state).mobile,
      standalone: () =>
        !!win &&
        (win.matchMedia("(display-mode: standalone)").matches ||
          ("standalone" in win.navigator && win.navigator.standalone === true)),
      target: () => get(owner.state)?.header.thread ?? "",
      back,
    });
  }
  const inbox = untrack(() => presentation.inbox),
    inboxState = untrack(
      () =>
        inbox?.state ??
        readable<InboxSnapshot>({
          binding: null,
          all: false,
          data: { waits: [], mentions: [], tasks: [] },
          phase: "idle",
          error: null,
          hidden: [],
          undo: 0,
        }),
    );
  const roomInboxModule = untrack(() =>
      createDeferredModule(
        () =>
          import("../application/RoomInbox.svelte").then(
            (module) => module.default,
          ),
        { current },
      ),
    ),
    roomInboxView = roomInboxModule.state;
  const RoomInbox = $derived($roomInboxView.component);
  const inboxOpen = $derived(
    !!inbox &&
      !!$inboxState.binding?.roomScope &&
      $inboxState.binding.roomId === captured.roomId &&
      inbox.owns($inboxState.binding),
  );
  const stopInbox = inbox?.state.subscribe((value) => {
    const shown =
      !!value.binding?.roomScope &&
      value.binding.roomId === captured.roomId &&
      inbox.owns(value.binding);
    owner.setInboxVisible(shown);
    if (shown && layout.read().sheet === "side") layout.closeSheet();
  });
  function leaveInbox() {
    const revision = get(services.state).navigationGeneration,
      binding = inbox ? get(inbox.state).binding : null;
    if (inbox && binding?.roomScope && binding.roomId === captured.roomId)
      inbox.close(binding);
    return current() && get(services.state).navigationGeneration === revision;
  }
  $effect(() => {
    if (inboxOpen) void roomInboxModule.ensure();
  });
  // The chat back in the middle: the inbox and the full board give way.
  function toChat() {
    if (!current()) return;
    if (inboxOpen) leaveInbox();
    if (layout.read().boardFull) layout.toggleBoard();
  }
  // Desktop, the sidebar's views (chat, inbox, board): each takes the middle.
  function toggleBoard() {
    if (!current()) return;
    if (inboxOpen) {
      leaveInbox();
      if (!layout.read().boardFull) layout.toggleBoard();
      return;
    }
    layout.toggleBoard();
  }
  function toggleInbox(trigger?: HTMLElement) {
    if (!current()) return;
    if (inboxOpen) return toChat();
    if (!layout.read().mobile && layout.read().boardFull) layout.toggleBoard();
    presentation.openInbox(trigger);
  }
  // Desktop has no board pane any more (the board is always full width): a
  // remembered "board" pane falls back to the doc.
  $effect(() => {
    if (
      !$geometry.mobile &&
      !$geometry.boardFull &&
      $geometry.pane === "board" &&
      current()
    )
      untrack(() => owner.actions.setPane("doc", { quiet: true }));
  });
  const boardModule = untrack(() =>
      createDeferredModule(
        () => import("../board/Board.svelte").then((module) => module.default),
        { current },
      ),
    ),
    boardView = boardModule.state;
  const filesModule = untrack(() =>
      createDeferredModule(
        () => import("../files/Files.svelte").then((module) => module.default),
        { current },
      ),
    ),
    filesView = filesModule.state;
  const decisionsModule = untrack(() =>
      createDeferredModule(
        () =>
          import("../decisions/Decisions.svelte").then(
            (module) => module.default,
          ),
        { current },
      ),
    ),
    decisionsView = decisionsModule.state;
  const remindersModule = untrack(() =>
      createDeferredModule(
        () =>
          import("../reminders/Reminders.svelte").then(
            (module) => module.default,
          ),
        { current },
      ),
    ),
    remindersView = remindersModule.state;
  const appsModule = untrack(() =>
      createDeferredModule(
        () =>
          import("../apps/AppsPanel.svelte").then((module) => module.default),
        { current },
      ),
    ),
    appsView = appsModule.state;
  const agentsModule = untrack(() =>
      createDeferredModule(
        () =>
          import("../agents/AgentsPane.svelte").then(
            (module) => module.default,
          ),
        { current },
      ),
    ),
    agentsView = agentsModule.state;
  const sideModule = untrack(() =>
    createDeferredModule(
      () =>
        import("../file-viewer/SideFilePanel.svelte").then(
          (module) => module.default,
        ),
      { current },
    ),
  );
  const sideView = sideModule.state;
  const SideFilePanel = $derived($sideView.component);
  const viewerModule = untrack(() =>
      createDeferredModule(
        () =>
          import("../file-viewer/FileViewer.svelte").then(
            (module) => module.default,
          ),
        { current },
      ),
    ),
    viewerView = viewerModule.state;
  const Board = $derived($boardView.component),
    Files = $derived($filesView.component),
    Decisions = $derived($decisionsView.component),
    Reminders = $derived($remindersView.component),
    AppsPanel = $derived($appsView.component),
    AgentsPane = $derived($agentsView.component),
    FileViewer = $derived($viewerView.component);
  const viewerState = owner.viewer.state;
  const documentShown = $derived(
    !$geometry.boardFull &&
      ($geometry.mobile
        ? $geometry.sheet === "doc" || $geometry.presentedSheet === "doc"
        : $geometry.documentVisible),
  );
  let boardMounted = $state(false);
  $effect(() => {
    if ($geometry.boardFull || (documentShown && $geometry.pane === "board")) {
      boardMounted = true;
      void boardModule.ensure();
    }
    if (documentShown) {
      if ($geometry.pane === "files") void filesModule.ensure();
      if ($geometry.pane === "view") void sideModule.ensure();
      if ($geometry.pane === "apps") void appsModule.ensure();
      if ($geometry.pane === "decisions") void decisionsModule.ensure();
      if ($geometry.pane === "reminders") void remindersModule.ensure();
      if ($geometry.pane === "agents") void agentsModule.ensure();
    }
    if ($viewerState.open) void viewerModule.ensure();
  });
  $effect(() => {
    const revision = $view?.chatRevision;
    if (revision === undefined) return;
    void tick().then(() => {
      if (current() && owner.current() && get(view)?.chatRevision === revision)
        owner.chatRendered(revision);
    });
  });
  onDestroy(() => {
    active = false;
    stopInbox?.();
    roomInboxModule.dispose();
    boardModule.dispose();
    filesModule.dispose();
    decisionsModule.dispose();
    remindersModule.dispose();
    appsModule.dispose();
    agentsModule.dispose();
    viewerModule.dispose();
    sideModule.dispose();
    owner.dispose();
    layout.dispose();
    scoped = undefined;
  });
  function filesSurface(node: HTMLElement) {
    return { destroy: owner.attachFiles(node) };
  }
  function taskSurface(node: HTMLElement) {
    return { destroy: owner.attachAttention(node) };
  }
  const labels = {
    documentWidth:
      services.language === "en" ? "Document width" : "Largura do documento",
    closeDocument:
      services.language === "en" ? "Close document" : "Fechar documento",
    closeSidebar: services.language === "en" ? "Close sidebar" : "Fechar menu",
    closeSheet: services.t("Fechar"),
    historyUnconfirmed:
      services.language === "en"
        ? "Navigation is not confirmed. Review the current page before continuing."
        : "A navegação ainda não foi confirmada. Confira a página atual antes de continuar.",
    historyRetry: services.t("Tentar de novo"),
    animationUnavailable:
      services.language === "en"
        ? "Room layout could not initialize. Reload the page to try again."
        : "Não foi possível iniciar o layout da sala. Recarregue a página para tentar novamente.",
  };
</script>

{#snippet inboxControls()}{#if inbox && $inboxState.binding}<InboxControls
      owner={inbox}
      binding={$inboxState.binding}
      t={services.t}
    />{/if}{/snippet}

<RoomLayout
  controller={layout}
  {labels}
  onChatSurface={owner.attachChat}
  onCells={edgeBack}
  overlayOpen={inboxOpen}
>
  {#snippet overlay()}{#if inbox && $inboxState.binding && inboxOpen}{#key $inboxState.binding}<Snapshot
          value={$inboxState.binding}
          >{#snippet children(binding)}{#if RoomInbox}<RoomInbox
                owner={inbox}
                {binding}
                {services}
                documentWidth={layout.bindDocumentWidth}
                sidebarCollapsed={$geometry.sidebarCollapsed}
              />{:else}<div data-room-inbox-loading class="p-6">
                <DeferredViewStatus
                  phase={$roomInboxView.phase}
                  lang={services.language}
                  current={() => current() && inbox.owns(binding)}
                  label={services.t("Caixa de entrada")}
                  retry={() => {
                    if (current() && inbox.owns(binding))
                      void roomInboxModule.retry();
                  }}
                />
              </div>{/if}{/snippet}</Snapshot
        >{/key}{/if}{/snippet}
  {#snippet sidebar()}{#if $view}<Sidebar
        {...$view.sidebar}
        {inboxOpen}
        onthreadintent={leaveInbox}
        onroomhome={toChat}
        oninbox={toggleInbox}
        onboard={$geometry.mobile ? undefined : toggleBoard}
        boardOpen={!$geometry.mobile && $geometry.boardFull && !inboxOpen}
        boardCount={$view.toolbar.counts?.board}
        inboxCount={$personal.me?.waits?.length ?? 0}
        hideSheetHandle
      >
        {#snippet phoneMenu()}{#if $view && $geometry.mobile}<PhoneRoomMenu
              {layout}
              {current}
              lang={services.language}
              dm={!!$view.header.room.book.dm}
              boardCount={$view.toolbar.counts?.board}
              agent={$view.toolbar.agent}
              agentTitle={$view.toolbar.agentTitle}
              onPane={(pane) => {
                if (current()) owner.actions.setPane(pane, { open: true });
              }}
              onsearch={(trigger) =>
                $view?.sidebar.appNavigation?.controller.openSearch(trigger)}
            />{/if}{/snippet}
        {#snippet footer(
          collapsed,
          rows,
        )}{#if $view?.trigger}<!-- Your agents, at the foot of the sidebar: machines and one-off agents with their delivery switches, or the ways to get one (collapsed rail: the ✻ alone). -->
            <div
              data-document-pane="agents"
              data-agent-footer
              class={collapsed ? "flex justify-center" : ""}
            >
              {#if collapsed}<AgentTrigger
                  {...$view.trigger}
                />{:else}<AgentFoot
                  owner={$view.trigger.owner}
                  onopen={$view.trigger.onopen}
                  origin={$view.trigger.origin ?? ""}
                  lang={$view.trigger.lang}
                  queue={$view.trigger.queue}
                  ago={$view.sidebar.vb.ago}
                />{/if}
            </div>{:else}{@render rows?.()}{/if}{#if $personal.me && !collapsed}<AccountRow
              me={$personal.me}
            />{/if}{/snippet}
      </Sidebar>{/if}{/snippet}
  {#snippet header()}{#if $view}<RoomHeader
        {presentation}
        header={$view.header}
        appNavigation={$view.sidebar.appNavigation}
        {layout}
        {current}
        {back}
        tabs={$view.toolbar}
        {inboxOpen}
        tochat={toChat}
        viewControls={inbox && inboxOpen && $inboxState.binding
          ? inboxControls
          : undefined}
        onPane={(pane) => {
          if (current()) owner.actions.setPane(pane, { open: true });
        }}
      />{/if}{/snippet}
  {#snippet peek()}{#if $view}<DocumentToolbar
        {...$view.peek}
        only={phoneTabPanes[
          phoneTabOf($geometry.pane) as keyof typeof phoneTabPanes
        ] ?? undefined}
        onPane={(pane) => {
          if (current()) owner.actions.setPane(pane, { open: true });
        }}
      />{/if}{/snippet}
  {#snippet attention()}{#if $view}
      <div>
        <div class={$geometry.boardFull ? "hidden" : ""}>
          {#if $view.banners}<AgentBanners
              {...$view.banners}
              agentsOpen={$geometry.pane === "agents" &&
                ($geometry.mobile
                  ? $geometry.sheet === "doc"
                  : $geometry.documentVisible && !$geometry.boardFull)}
            />{/if}
        </div>
        <div class="px-4"><ThreadFiles {...$view.threadFiles} /></div>
      </div>
    {/if}{/snippet}
  {#snippet chat()}{#if $view}
      {#if $view.suggestion}<SuggestionPreview
          {...$view.suggestion}
        />{:else if $view.chat}<Chat {...$view.chat} />{/if}
    {/if}{/snippet}
  {#snippet composer()}{#if $view?.composer}<Composer
        {...$view.composer}
        hidden={$view.composer.hidden || $geometry.boardFull}
      />{/if}{/snippet}
  <!-- Desktop pane tabs live in the room header now (one top bar). -->
  {#snippet documentToolbar()}{/snippet}
  {#snippet document()}{#if $view}
      <div
        use:taskSurface
        class={$geometry.pane === "doc"
          ? "flex h-full min-h-0 flex-col"
          : "hidden"}
        hidden={$geometry.pane !== "doc"}
      >
        <DocumentPanel {...$view.document} />
      </div>
      <div
        class={$geometry.pane === "view"
          ? "flex h-full min-h-0 flex-col"
          : "hidden"}
        hidden={$geometry.pane !== "view"}
      >
        {#if SideFilePanel}<SideFilePanel
            {...$view.sideFile}
          />{:else}<DeferredViewStatus
            phase={$sideView.phase}
            lang={services.language}
            label={services.language === "en" ? "File" : "Arquivo"}
            retry={() => {
              void sideModule.retry();
            }}
            {current}
          />{/if}
      </div>
      <div
        use:filesSurface
        class={$geometry.pane === "files"
          ? "h-full min-h-0 overflow-auto"
          : "hidden"}
        hidden={$geometry.pane !== "files"}
      >
        {#if $geometry.mobile}<PhoneRoomSection
            part="pins"
            sidebar={$view.sidebar}
          />{/if}
        {#if Files}<Files {...$view.files} />{:else}<DeferredViewStatus
            phase={$filesView.phase}
            lang={services.language}
            label={services.language === "en" ? "Files" : "Arquivos"}
            retry={() => {
              void filesModule.retry();
            }}
            {current}
          />{/if}
      </div>
      <div
        class={$geometry.pane === "apps"
          ? "flex h-full min-h-0 flex-col overflow-auto"
          : "hidden"}
        hidden={$geometry.pane !== "apps"}
      >
        {#if AppsPanel}<AppsPanel
            props={$view.apps}
          />{:else}<DeferredViewStatus
            phase={$appsView.phase}
            lang={services.language}
            label={services.language === "en" ? "Apps" : "Apps"}
            retry={() => {
              void appsModule.retry();
            }}
            {current}
          />{/if}
      </div>
      <div
        class={$geometry.pane === "decisions" ? "min-h-0" : "hidden"}
        hidden={$geometry.pane !== "decisions"}
      >
        {#if Decisions}<Decisions
            {...$view.decisions}
          />{:else}<DeferredViewStatus
            phase={$decisionsView.phase}
            lang={services.language}
            label={services.language === "en" ? "Decisions" : "Decisões"}
            retry={() => {
              void decisionsModule.retry();
            }}
            {current}
          />{/if}
      </div>
      <div
        class={$geometry.pane === "reminders" ? "min-h-0" : "hidden"}
        hidden={$geometry.pane !== "reminders"}
      >
        {#if Reminders}<Reminders
            {...$view.reminders}
          />{:else}<DeferredViewStatus
            phase={$remindersView.phase}
            lang={services.language}
            label={services.language === "en" ? "Reminders" : "Lembretes"}
            retry={() => {
              void remindersModule.retry();
            }}
            {current}
          />{/if}
      </div>
      {#if $geometry.pane === "agents" && $view.agents}{#if AgentsPane}<AgentsPane
            {...$view.agents}
          />{:else}<DeferredViewStatus
            phase={$agentsView.phase}
            lang={services.language}
            label={services.language === "en" ? "Agents" : "Agents"}
            retry={() => {
              void agentsModule.retry();
            }}
            {current}
          />{/if}{/if}
      {#if $geometry.mobile && $geometry.pane === "agents"}<PhoneRoomSection
          part="people"
          sidebar={$view.sidebar}
        />{/if}
      <!-- Desktop: People & agents beside the chat, like Discord's member list (the sidebar no longer has it). -->
      {#if $geometry.pane === "people"}<div data-pane-people class="min-h-0">
          <PhoneRoomSection part="people" sidebar={$view.sidebar} members />
        </div>{/if}
      {#if $geometry.pane === "search"}<RoomSearch
          roomId={$view.sidebar.room.id}
          messages={$view.sidebar.room.messages}
          epicTitle={(thread) =>
            threadTitle($view.sidebar.room, thread) ?? null}
          vb={{
            t: services.t,
            name: $view.sidebar.vb.name,
            ago: $view.sidebar.vb.ago,
            avatarVersion: $view.sidebar.vb.avatarVersion,
          }}
          search={(q, signal) => services.personal.api.search(q, signal)}
          onjump={(id, thread) => $view?.chat?.actions.navigate(id, thread)}
        />{/if}
    {/if}{/snippet}
  {#snippet board()}{#if $view && boardMounted}{#if Board}<Board
          {...$view.board}
        />{:else}<DeferredViewStatus
          phase={$boardView.phase}
          lang={services.language}
          label={services.language === "en" ? "Board" : "Quadro"}
          retry={() => {
            void boardModule.retry();
          }}
          {current}
        />{/if}{/if}{/snippet}
</RoomLayout>
{#if $view}{#if FileViewer}<FileViewer
      {...$view.viewer}
    />{:else if $viewerState.open && $viewerState.target}{#key $viewerState.target}<Snapshot
        value={$viewerState.target}
        >{#snippet children(target)}<Dialog
            open
            onOpenChange={(open) => {
              if (
                !open &&
                !FileViewer &&
                current() &&
                get(viewerState).target === target
              )
                owner.viewer.closeUser();
            }}
          >
            <DialogContent
              class="inset-2 top-2 left-2 flex w-auto max-w-none translate-x-0 translate-y-0 flex-col overflow-auto md:max-w-none font-sans text-sm text-foreground"
              closeLabel={services.language === "en"
                ? "Close file"
                : "Fechar arquivo"}
              preventScroll={false}
              preventBodyPointerEvents={false}
              preventOverflowTextSelection={false}
              onCloseAutoFocus={(event) => {
                const target = owner.viewer.returnFocus();
                if (target?.isConnected) {
                  event.preventDefault();
                  target.focus();
                }
              }}
            >
              <DialogHeader>
                <DialogTitle class="pr-8 font-sans"
                  >{$viewerState.name ||
                    (services.language === "en"
                      ? "File"
                      : "Arquivo")}</DialogTitle
                >
              </DialogHeader><DeferredViewStatus
                phase={$viewerView.phase}
                lang={services.language}
                label={services.language === "en" ? "File" : "Arquivo"}
                retry={() => {
                  void viewerModule.retry();
                }}
                current={() => current() && get(viewerState).target === target}
              />
            </DialogContent>
          </Dialog>{/snippet}</Snapshot
      >{/key}{/if}
  {#if !FileViewer && $viewerState.closingUnconfirmed}<aside
      role="alert"
      class="fixed inset-x-4 top-4 z-50 flex flex-wrap items-center gap-3 rounded-surface border border-border bg-card p-4 font-sans text-sm text-card-foreground shadow-lg"
    >
      <p>{viewerText(services.language, "closing")}</p>
      <Button
        onclick={(event) => {
          if (event.currentTarget.isConnected && current())
            services.actions.reload();
        }}>{viewerText(services.language, "reload")}</Button
      >
    </aside>{/if}
  {#if $view.notice}<aside
      role="status"
      class="fixed bottom-4 left-1/2 z-30 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-control border border-border bg-popover p-3 font-sans text-sm text-popover-foreground shadow-md"
    >
      {$view.notice}
    </aside>{/if}
{/if}
