<script lang="ts">
  import FocusPeek from "./FocusPeek.svelte";
  import { onDestroy, tick, untrack } from "svelte";
  import { get } from "svelte/store";
  import { provideRichFileIndex } from "../rich-text/fileContext";
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
  import { searchPlaceholder } from "../chat/roomSearch";
  import { threadTitle } from "../room-sidebar/model";
  import DocumentToolbar from "../documents/DocumentToolbar.svelte";
  import { isDmId } from "../../../shared/dm";
  import type { SendRoomCommand } from "../../../shared/commands";
  import AgentBanners from "../agents/AgentBanners.svelte";
  import AgentTrigger from "../agents/AgentTrigger.svelte";
  import AccountRow from "../app-navigation/AccountRow.svelte";
  import AgentFoot from "../agents/AgentFoot.svelte";
  import UpdateRow from "../user-center/UpdateRow.svelte";
  import ThreadFiles from "../file-viewer/ThreadFiles.svelte";
  import NotifyOffer from "../notifications/NotifyOffer.svelte";
  import AppOffer from "../user-center/AppOffer.svelte";
  import Requests from "../app-navigation/Requests.svelte";
  import { roomAvatarVersion } from "../room-scope/model";
  import CallControls from "../call/CallControls.svelte";
  import CallStage from "../call/CallStage.svelte";
  import { createStageNav } from "../call/stageNav";
  import { joinsByItself } from "../call/session";
  import CallSidebarRow from "../call/CallSidebarRow.svelte";
  import CallPanel from "../call/CallPanel.svelte";
  import { callHub } from "../call/hub";
  import { isRecorder, roomHasThread } from "../../../shared/call";
  import SuggestionPreview from "../room-sidebar/SuggestionPreview.svelte";
  import RoomHeader from "./RoomHeader.svelte";
  import PhoneRoomSection from "./PhoneRoomSection.svelte";
  import { phoneDrawerPanes, phonePanes } from "./panelViews";
  import type { DocumentPane } from "../documents/types";
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
  import ForwardBar from "../forward/ForwardBar.svelte";
  import {
    copyForward,
    forwardPicking,
    forwardSelection,
    stopForward,
  } from "../forward/selection";
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
  const personal = untrack(() => services.personal.state),
    appInstalled = untrack(() => services.navigation.appInstalled);
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
  // Selection mode of "Encaminhar" in this thread: its bar takes the composer's place, as in WhatsApp.
  const forwarding = $derived(
    !!$view?.chat?.actions.forward &&
      $forwardSelection?.room === $view.chat.room.id &&
      $forwardSelection.thread === $view.chat.thread,
  );
  // The room's call (voice and screen). It lives with this view, so threads, panes and pins keep it on; leaving
  // the room leaves the call (the room's socket closes, and the room takes the person out of the call:
  // Book.webSocketClose).
  const sendCommand: SendRoomCommand = (command) =>
    get(owner.state)?.decisions.send(command) ?? false;
  // The room's call session is the app's (callHub): in the call, it goes on when this view closes (another room,
  // Home), and the sidebar's call panel shows it everywhere. Leaving is a hang-up.
  const hub = callHub(),
    liveCall = hub.live;
  const call = hub.session(captured.roomId, {
    thread: () => get(owner.state)?.header.thread ?? "main",
    title: () => get(owner.state)?.header.room.book.title ?? "",
  });
  const callView = call.state;
  // Who is in the room's call. Opening a room never joins its call: a click does (Entrar na call, Iniciar call,
  // Atender; a DM's call rings). The call I am in hears the room from its own socket (hub.ts): the room's view, which
  // may show a saved room for a moment, does not tell it who is in it.
  $effect(() => {
    const peers = $view?.header.room.call,
      me = $view?.header.room.me;
    untrack(() => {
      if (!hub.isLive(call)) call.setPeers(peers, me);
      // The room's recorder is not a person: its page joins by itself, to record (joinsByItself).
      if (me && joinsByItself(me, peers, get(call.state))) call.join(true);
    });
  });
  const inCall = $derived($callView.phase !== "idle");
  // In the call, the stage is on show until a click elsewhere (a thread, a pane, a pin) closes it: the call goes on
  // (the voices keep playing) and the sidebar's call panel or the top bar's green phone open it again.
  let stageOpen = $state(false);
  const staged = $derived(inCall && stageOpen);
  // The chat column beside the stage: the person can hide it, so the call has all the width.
  let chatHidden = $state(false);
  let cameraOpen = $state(false);
  // What opening the stage changed in the layout (the doc beside the chat closes, so the stage has the room's
  // width), to put it back when the stage closes.
  let closedPane = false;
  // The stage shows the call's own thread beside it (room.callThread): opening it goes there once (stageNav.ts).
  const stageNav = createStageNav();
  function openStage() {
    if (!stageOpen && !layout.read().mobile) {
      closedPane = layout.read().documentVisible;
      if (closedPane) layout.toggleDocument();
    }
    stageOpen = true;
    stageNav.opened();
  }
  function closeStage() {
    stageOpen = false;
    stageNav.closed();
    chatHidden = false;
    // The stage in full screen (CallStage) leaves it with the stage.
    if (document.fullscreenElement) void document.exitFullscreen();
    if (closedPane && !layout.read().documentVisible) layout.toggleDocument();
    closedPane = false;
  }
  // Joining opens the stage; leaving closes it. A view that opens on a call already on (I came back from another
  // screen) opens the stage only when a click asked for it (hub.openStage, taken below).
  let wasInCall = untrack(() => inCall);
  $effect(() => {
    const now = inCall;
    untrack(() => {
      if (now && !wasInCall) openStage();
      if (!now && wasInCall) closeStage();
      wasInCall = now;
    });
  });
  // The stage asked for from another screen (the call's panel, Atender): opened once the room is up and this view's
  // first look at its thread and panes is done. Opened before, that first look took it for a move away and closed it
  // (Jonas, 2026-11-25: the panel brought him back to the room's chat).
  $effect(() => {
    if (!$view?.header.room || !inCall) return;
    void tick().then(() => {
      if (!active || !inCall) return;
      const asked = hub.takeStage(captured.roomId);
      if (!asked) return;
      openStage();
      if (asked.camera) cameraOpen = true;
    });
  });
  // Another thread (the sidebar, a link, Back) closes the stage; the call's own thread keeps it. The call's thread
  // is a normal thread (a room's call has one, a DM's is the conversation): with the stage closed it stays open as
  // any other, so nothing ever sends the person back to it.
  $effect(() => {
    const room = $view?.header.room,
      thread = $view?.header.thread ?? "",
      target = room?.callThread,
      open = staged;
    untrack(() => {
      const move = stageNav.see(
        thread,
        target,
        open,
        (id) => !!room && roomHasThread(room, id),
      );
      if (move && "close" in move) closeStage();
      else if (move) owner.actions.setThread(move.go);
    });
  });
  // A pane that opens (doc, files, apps, people, a pinned file) closes the stage too.
  let lastDoc = false,
    lastPane = "";
  $effect(() => {
    const shown = $geometry.mobile
        ? $geometry.sheet === "doc"
        : $geometry.documentVisible,
      pane = $geometry.pane,
      open = staged;
    untrack(() => {
      const opened = shown && (!lastDoc || pane !== lastPane);
      lastDoc = shown;
      lastPane = pane;
      if (open && opened) closeStage();
    });
  });
  // Where the call is: the room (a DM: the person).
  const callTitle = $derived($view?.header.room.book.title ?? "");
  $effect(() => hub.retitle(captured.roomId, callTitle));
  // The call I am in, in this room or another one: the sidebar's panel shows it. In another room, opening it goes
  // back to the call's room, whose view opens the stage.
  const elsewhere = $derived(
    $liveCall && $liveCall.room !== captured.roomId ? $liveCall : null,
  );
  function openLiveCall(camera = false) {
    if (!elsewhere) {
      openStage();
      if (camera) cameraOpen = true;
      return;
    }
    hub.openStage(elsewhere.room, camera);
    services.actions.navigate(`/b/${elsewhere.room}`);
  }
  // "Iniciar call" shows while the room has no call. With a call on, the stage or its one-line bar has the controls.
  const callIdle = $derived(
    !!$view?.header.room.call &&
      !$view.header.room.call.some((peer) => !isRecorder(peer.email)) &&
      $callView.phase === "idle",
  );
  // The top bar's call button: the room has calls, and the stage is not on show (it has its own controls). In the
  // call with the stage closed, it opens the stage again.
  const callReady = $derived(!!$view?.header.room.call && !staged);
  const personName = (email: string) =>
    ($view?.header.room.names?.[email] ?? email.split("@")[0] ?? "").split(
      /\s+/,
    )[0] ?? "";
  provideRichFileIndex(owner.richFiles);
  function back(expectedThread: string) {
    const value = get(owner.state);
    if (!current() || !value || value.header.thread !== expectedThread) return;
    // Phones have no bottom bar (#3738): Back first leaves the doc sheet, back to the chat.
    const state = layout.read();
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
  const Files = $derived($filesView.component),
    Decisions = $derived($decisionsView.component),
    Reminders = $derived($remindersView.component),
    AppsPanel = $derived($appsView.component),
    AgentsPane = $derived($agentsView.component),
    FileViewer = $derived($viewerView.component);
  const viewerState = owner.viewer.state;
  const documentShown = $derived(
    $geometry.mobile
      ? $geometry.sheet === "doc" || $geometry.presentedSheet === "doc"
      : $geometry.documentVisible,
  );
  $effect(() => {
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
    hub.release(captured.roomId, call);
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

<!-- Outside RoomLayout, so they are not taken for its snippets. -->
{#snippet callControls()}<CallControls
    {call}
    peers={$view?.header.room.call}
    name={personName}
    onopen={openStage}
    t={services.t}
  />{/snippet}
{#snippet callPanel(collapsed: boolean)}<CallPanel
    call={elsewhere?.session ?? call}
    title={elsewhere?.title ?? callTitle}
    {collapsed}
    onopen={() => openLiveCall()}
    oncamera={() => openLiveCall(true)}
    t={services.t}
  />{/snippet}
{#snippet callRow(collapsed: boolean)}{#if $view}<CallSidebarRow
      {call}
      peers={$view.header.room.call}
      {collapsed}
      avatar={(email) =>
        roomAvatarVersion($view?.header.room, $personal.me, email)}
      name={personName}
      t={services.t}
    />{/if}{/snippet}
{#snippet callStage(fill: boolean)}{#if $view}<CallStage
      room={$view.header.room}
      {call}
      send={sendCommand}
      open={browser.openExternal}
      avatar={(email) =>
        roomAvatarVersion($view?.header.room, $personal.me, email)}
      title={callTitle}
      {fill}
      {staged}
      bind:cameraOpen
      chatHidden={fill ? chatHidden : undefined}
      onchat={() => (chatHidden = !chatHidden)}
      onclose={fill ? closeStage : undefined}
      t={services.t}
    />{/if}{/snippet}
{#snippet callBeside()}{@render callStage(true)}{/snippet}
<RoomLayout
  controller={layout}
  stage={staged ? callBeside : undefined}
  stageOnly={chatHidden}
  {labels}
  onChatSurface={owner.attachChat}
  onCells={edgeBack}
>
  {#snippet sidebar()}{#if $view}<Sidebar
        {...$view.sidebar}
        hideSheetHandle
        call={$view.header.room.call?.length ? callRow : undefined}
        callPanel={inCall || elsewhere ? callPanel : undefined}
      >
        <!-- Phones: the drawer keeps the tabs that the strip under the top bar and the people avatars do not show (Apps, Agents; A2, Gimenes #4331). -->
        {#snippet phoneMenu()}{#if $view && $geometry.mobile}<div
              data-phone-menu
            >
              <DocumentToolbar
                {...$view.peek}
                pane={"" as DocumentPane}
                only={phoneDrawerPanes(!!$view.header.room.book.dm)}
                onPane={(pane) => {
                  if (current()) owner.actions.setPane(pane, { open: true });
                }}
              />
            </div>{/if}{/snippet}
        {#snippet phoneAccount()}{#if $personal.me}<AccountRow
              me={$personal.me}
              row={false}
            />{/if}{/snippet}
        {#snippet footer(
          collapsed,
          rows,
        )}{#if $personal.updateAvailable && !collapsed}<UpdateRow
              lang={services.language === "en" ? "en" : "pt"}
            />{/if}{#if !collapsed}<NotifyOffer
              owner={services.pwa}
              lang={services.language}
              row
            /><AppOffer
              installed={$appInstalled}
              lang={services.language === "en" ? "en" : "pt"}
            />{#if $personal.me}<Requests
                center
                invites={$personal.me.invites ?? []}
                requests={$personal.me.requests}
                lang={services.language === "en" ? "en" : "pt"}
                onjoin={services.navigation.callbacks.answerInvite}
                onanswer={services.navigation.callbacks.answerRequest}
              />{/if}{/if}{#if $view?.trigger}<!-- Your agents, at the foot of the sidebar: machines and one-off agents with their delivery switches, or the ways to get one (collapsed rail: the ✻ alone). -->
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
        viewControls={callReady ? callControls : undefined}
        onPane={(pane) => {
          if (current()) owner.actions.setPane(pane, { open: true });
        }}
      />{/if}{/snippet}
  {#snippet peek()}{#if $view}<DocumentToolbar
        {...$view.peek}
        only={[...phonePanes(!!$view.header.room.book.dm), "view"]}
        onPane={(pane) => {
          if (current()) owner.actions.setPane(pane, { open: true });
        }}
      />{/if}{/snippet}
  {#snippet attention()}{#if $view}
      <div>
        <!-- Phones: the top bar has no space for the controls of the view (docs/design.md). -->
        {#if callIdle}<div class="flex justify-end px-4 pt-2 md:hidden">
            {@render callControls()}
          </div>{/if}
        <!-- Phones in the call with the stage closed: the call's panel, to open it again (the drawer has no foot). -->
        {#if $geometry.mobile && inCall && !stageOpen}<div class="px-4 pt-2">
            {@render callPanel(false)}
          </div>{/if}
        <!-- Desktop, on the stage: it is at the left of the chat (RoomLayout's `stage`), not here. Closed: only its
             toasts and the camera's dialog. -->
        {#if $geometry.mobile || !staged}{@render callStage(false)}{/if}
        <div>
          {#if $view.banners}<AgentBanners
              {...$view.banners}
              agentsOpen={$geometry.pane === "agents" &&
                ($geometry.mobile
                  ? $geometry.sheet === "doc"
                  : $geometry.documentVisible)}
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
  {#snippet focusPeek()}{#if $view?.chat && $personal.me}<FocusPeek
        room={$view.chat.room}
        thread={$view.chat.thread}
        list={$view.chat.list}
        me={$personal.me.email}
        vb={$view.chat.vb}
      />{/if}{/snippet}
  {#snippet composer()}{#if $view?.composer}{#if forwarding}<ForwardBar
          count={$forwardSelection?.ids.length ?? 0}
          vb={$view.composer.vb}
          oncancel={stopForward}
          onforward={() => forwardPicking.set(true)}
          oncopy={() =>
            $view?.chat?.actions.forward
              ? copyForward($view.chat.actions.forward)
              : Promise.resolve(false)}
        />{/if}<Composer
        {...$view.composer}
        hidden={$view.composer.hidden || forwarding}
        onsend={() => services.pwa.offerOnSend()}
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
      <!-- People beside the chat (desktop), or in the doc sheet (phone), like Discord's member list (the sidebar no longer has it). -->
      {#if $geometry.pane === "people"}<div data-pane-people class="min-h-0">
          <PhoneRoomSection part="people" sidebar={$view.sidebar} members />
        </div>{/if}
      {#if $geometry.pane === "search"}<RoomSearch
          roomId={$view.sidebar.room.id}
          messages={$view.sidebar.room.messages}
          members={$view.sidebar.room.members}
          me={$view.sidebar.room.me}
          placeholder={searchPlaceholder($view.sidebar.room.book, services.t)}
          phone={$geometry.mobile}
          epicTitle={(thread) =>
            threadTitle($view.sidebar.room, thread) ?? null}
          vb={{
            t: services.t,
            name: $view.sidebar.vb.name,
            ago: $view.sidebar.vb.ago,
            avatarVersion: $view.sidebar.vb.avatarVersion,
          }}
          search={(filter, signal) =>
            services.personal.api.roomSearch(
              $view.sidebar.room.id,
              filter,
              signal,
            )}
          onjump={(id, thread) => $view?.chat?.actions.navigate(id, thread)}
        />{/if}
    {/if}{/snippet}
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
  <!-- Above the phone's drawer (z-50) and its backdrop: a thread menu in the drawer says "Copiado" here too. -->
  {#if $view.notice}<aside
      role="status"
      class="fixed bottom-4 left-1/2 z-50 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-control border border-border bg-popover p-3 font-sans text-sm text-popover-foreground shadow-md"
    >
      {$view.notice}
    </aside>{/if}
{/if}
