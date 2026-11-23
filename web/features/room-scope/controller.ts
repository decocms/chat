import { chatTime, chatDateTime } from "../chat/time";
import { derived, get, readonly, writable } from "svelte/store";
import type { Attachment, Room, RoomEvent } from "../../../shared/room";
import type { RoomCommand, CommandOutcome } from "../../../shared/commands";
import type { RequestRoomCommand } from "../../app/roomConnection";
import type { ChatActions, ChatBridge } from "../../app/chatTypes";
import type {
  RootRoomSnapshot,
  RootRoomTransition,
} from "../root-room/session";
import type {
  ApplicationRoomIntent,
  ApplicationRoomScope,
} from "../application/types";
import { createChatViewport, type KeepChat } from "../chat-viewport/controller";
import { createChatSurface } from "../chat-viewport/surface";
import { createChatPresentation } from "../chat-viewport/presentation";
import { createVoiceApi, VoiceFailure } from "../composer/voiceApi";
import { createRichFileIndex } from "../rich-text/roomFiles";
import type { AppsAuthority } from "../apps/authority";
import { createFilesSession } from "../files/session";
import { createFileChipIndex } from "../rich-text/fileIndex";
import { createSideFileSession, type SideFileInput } from "../file-viewer/side";
import { createFileViewer } from "../file-viewer/session";
import { createFileReadApi, FileReadFailure } from "../file-viewer/api";
import { knownViewerFiles, sameFile, fileVersions } from "../file-viewer/model";
import { consumeFileViewerPop } from "../file-viewer/navigation";
import {
  createNavigationSession,
  syncNavigationSession,
} from "../navigation/session";
import {
  createPinsSession,
  syncPinsSession,
  disposePinsSession,
  requestPinnedFiles,
} from "../pins/session";
import { createRoomMutations } from "../room-sidebar/session";
import { suggestionIdentity, suggestionAt } from "../room-sidebar/model";
import { createDocumentSession } from "../documents/session";
import { docVersionEvent } from "../documents/versions";
import { appendDocumentApp, documentEmbedsApp } from "../documents/appMarkers";
import { createAppsSession } from "../apps/session";
import {
  createAppsApi,
  createAppMetrics,
  AppsFailure,
  type AppsApi,
} from "../apps/api";
import { createAppRequests } from "../apps/requests";
import { createDirectMcp } from "../apps/direct";
import {
  roomApps,
  appRouteHash,
  appRouteTarget,
  type AppTarget,
  type AppRouteTarget,
} from "../apps/model";
import { mountChatApp } from "../apps/embed";
import {
  visibleChatMessages,
  visibleMessage,
  permissionAsk,
} from "../chat/privacy";
import { canAnswer, choicesOf } from "../chat-interactive/eligibility";
import { threadWorkers } from "../chat/model";
import {
  agentMark,
  agentPresence,
  agentQueue,
  agentStatus,
} from "../agents/model";
import { agentMarkLabel } from "../agents/roomCopy";
import type { RoomAgentSession } from "../agents/room";
import type { RichActions, RichNavigation } from "../rich-text/types";
import type { ComposerUpload } from "../composer/types";
import type { ComposerEntry } from "../composer/drafts";
import type { DocumentPane } from "../documents/types";
import { createRoomApi } from "../../app/transport";
import {
  roomMessages,
  roomName,
  roomAvatarVersion,
  roomMention,
} from "./model";
import type {
  RoomScopeOptions,
  RoomScopePresentation,
  RoomScope,
} from "./types";

/** A single authenticated Book connection owns feature sessions, not canonical
 * room state. RootRoomSession remains the only reducer/cache/transport owner. */
export function createRoomScope(options: RoomScopeOptions): RoomScope {
  const { services, resources, browser, layout } = options;
  const initialScope = services.roomScope();
  if (!initialScope)
    throw Error("RoomScope requires an authorized room snapshot");
  const scope: ApplicationRoomScope = initialScope;
  const state = writable<RoomScopePresentation | null>(null);
  let active = true,
    synchronizing = false,
    projecting = false,
    projectAgain = false;
  const voiceApi = createVoiceApi(browser.fetcher);
  const voiceLeaving = new Set<() => void>();
  function leaveVoice() {
    for (const stop of [...voiceLeaving]) if (voiceLeaving.has(stop)) stop();
  }
  const current = () => active && services.active() && services.ownsRoom(scope);
  const frame = () => (current() ? services.rootRoom.read() : null);
  const room = () => frame()?.room ?? null;
  const richFiles = createRichFileIndex(
    scope,
    () => {
      const latestScope = services.roomScope(),
        value = room();
      return current() && latestScope && value
        ? { scope: latestScope, room: value }
        : null;
    },
    current,
  );
  const selected = () => frame()?.thread ?? "main";
  const forThread = (thread: string) => current() && selected() === thread;
  function composerRequestFor(thread: string): RequestRoomCommand {
    return (command) => {
      if (!forThread(thread)) return failed();
      if (command.t !== "msg") return request(command);
      if ((command.thread ?? "main") !== thread) return failed();
      const target = side.target();
      return request({
        ...command,
        viewing: target?.roomId === scope.roomId ? target.id : undefined,
      });
    };
  }
  const failed = (): Promise<CommandOutcome> =>
    Promise.resolve({ ok: false, error: "disconnected" });
  const request = (command: RoomCommand) =>
    current() ? services.rootRoom.request(command) : failed();
  const send = (command: RoomCommand) =>
    current() && services.rootRoom.send(command);
  const t = services.t,
    lang = services.language,
    locale = services.locale;
  const me = () => services.personal.peek();
  const name = (email: string) => {
    const value = room();
    return value ? roomName(value, me(), email) : email.split("@")[0]!;
  };
  const ago = (ts: number) => {
    const m = Math.round((Date.now() - ts) / 60000);
    return m < 1
      ? t("agora")
      : m < 60
        ? `${m} min`
        : m < 1440
          ? `${Math.round(m / 60)} h`
          : `${Math.round(m / 1440)} d`;
  };
  const navigation = createNavigationSession(
    scope.roomId,
    false,
    browser.storage,
  );
  const pins = createPinsSession(scope.roomId),
    files = createFilesSession(scope.roomId, browser.clock);
  const mutations = createRoomMutations(
    scope.account,
    scope.roomId,
    browser.clock,
  );
  const fileIndex = createFileChipIndex(
    scope.roomId,
    scope.account,
    current,
    request,
  );
  const uploads = new Set<AbortController>(),
    embeds = new Set<() => void>();
  const stops: (() => void)[] = [];
  const track = (stop: () => void) => {
    if (active) stops.push(stop);
    else stop();
  };
  let agent: RoomAgentSession | null = null,
    stopAgent = () => {};
  let chatElement: HTMLElement | null = null,
    filesElement: HTMLElement | null = null,
    attentionElement: HTMLElement | null = null;
  let chatSurface: ReturnType<typeof createChatSurface> | null = null;
  let chatRevision = 0,
    notice = "";
  let noticeTimer: number | ReturnType<typeof setTimeout> | null = null,
    noticeRevision = 0;
  let pendingMessage: {
    id: number;
    thread?: string;
    navigation: number;
  } | null = null;
  let lastSnapshot = services.rootRoom.read(),
    lastThread = lastSnapshot.thread,
    lastGeneration = -1;
  let suggestionIntent: ReturnType<typeof mutations.suggestionIntent> = null;
  let appsStarted = false;
  let detachApplication = () => {};
  const clock = browser.clock;
  const viewport = createChatViewport({
    current,
    send,
    render: (value) => project(value),
    selectThread: (thread) => {
      if (current()) services.actions.selectThread(thread);
    },
    notice: (kind) =>
      showNotice(
        t(
          kind === "searching"
            ? "Buscando a mensagem…"
            : kind === "missing"
              ? "Não achei essa mensagem nesta sala."
              : "sem conexão",
        ),
        kind === "searching" ? 1500 : 7000,
      ),
    schedule: clock?.schedule,
    cancel: clock?.cancel,
  });
  const chatPresentation = createChatPresentation(viewport);
  const readApi = createFileReadApi(browser.fetcher);
  const guardRead = async <T>(operation: Promise<T>): Promise<T> => {
    try {
      return await operation;
    } catch (error) {
      if (current() && error instanceof FileReadFailure && error.status === 401)
        services.actions.sessionLost();
      throw error;
    }
  };
  const viewerOptions: Parameters<typeof createFileViewer>[0] = {
    href: browser.href,
    state: browser.historyState,
    history: browser.history,
    clock,
    enqueue: browser.enqueue,
    api: {
      probe: (target, signal) => guardRead(readApi.probe(target, signal)),
      text: (target, signal) => guardRead(readApi.text(target, signal)),
    },
  };
  const viewer = createFileViewer(viewerOptions);
  const side = createSideFileSession(
    createFileViewer({ ...viewerOptions, embedded: true }),
    { current, changed: () => project("stay") },
  );
  const document = createDocumentSession({
    drafts: resources.documents,
    authorizationEpoch: scope.roomGeneration,
    request,
    schedule: clock?.schedule,
    cancel: clock?.cancel,
    name: (value) => roomName(value, me(), value.me),
    color: (value) => browser.awarenessColor(value.me),
    label: lang === "en" ? "Document editor" : "Editor do documento",
    readMode: () => browser.storage?.getItem("vb.docView") ?? null,
    writeMode: (mode) => {
      try {
        browser.storage?.setItem("vb.docView", mode);
      } catch {
        /* Local mode still applies. */
      }
    },
  });
  const initialAuthority = services.appsAuthority();
  if (!initialAuthority) {
    document.dispose();
    viewer.dispose();
    side.dispose();
    viewport.dispose();
    files.dispose();
    disposePinsSession(pins);
    mutations.dispose();
    fileIndex.dispose();
    throw Error("Room app authority unavailable");
  }
  const authority: AppsAuthority = initialAuthority;
  const rawApps = createAppsApi(scope.roomId, browser.fetcher),
    metrics = createAppMetrics(browser.fetcher),
    appRequests = createAppRequests(clock);
  const guardApp = async <T>(operation: Promise<T>): Promise<T> => {
    try {
      return await operation;
    } catch (error) {
      if (current() && error instanceof AppsFailure && error.sessionDenied)
        services.actions.sessionLost();
      throw error;
    }
  };
  const direct = createDirectMcp({
    current: () => current() && authority.current(),
    identity: (cid, signal) => guardApp(rawApps.identity(cid, signal)),
    proxy: (cid, name, args, signal) =>
      guardApp(rawApps.call(cid, name, args, signal)),
    fetcher: browser.fetcher,
    clock,
  });
  const changeConnection = <T>(
    cid: string,
    signal: AbortSignal,
    operation: () => Promise<T>,
  ) => {
    direct.invalidate(cid);
    if (!current() || !authority.current() || signal.aborted)
      return Promise.reject(Error("App is no longer active"));
    return guardApp(operation());
  };
  const appApi: AppsApi = {
    identity: (cid, signal) => guardApp(rawApps.identity(cid, signal)),
    list: async (signal) => {
      const value = await guardApp(rawApps.list(signal));
      if (current() && authority.current() && !signal.aborted)
        direct.sync(value.connections);
      return value;
    },
    create: (url, value, signal) =>
      guardApp(rawApps.create(url, value, signal)),
    remove: (cid, signal) =>
      changeConnection(cid, signal, () => rawApps.remove(cid, signal)),
    refresh: (cid, signal) =>
      changeConnection(cid, signal, () => rawApps.refresh(cid, signal)),
    signout: (cid, signal) =>
      changeConnection(cid, signal, () => rawApps.signout(cid, signal)),
    ui: (cid, tool, signal) => guardApp(rawApps.ui(cid, tool, signal)),
    call: (cid, tool, args, signal) =>
      guardApp(direct.call(cid, tool, args, signal)),
    context: (cid, tool, text, signal) =>
      guardApp(rawApps.context(cid, tool, text, signal)),
  };
  const apps = createAppsSession(
    appApi,
    {
      current: () => current() && authority.current(),
      navigate: (url) => {
        if (current()) services.actions.navigate(url);
      },
      changed: () => project("stay"),
      denied: () => authority.deny(),
    },
    clock,
  );
  // The app showing in the right pane, for the sidebar's pinned-app highlight.
  const activePinApp = derived([apps.state, layout.state], ([value, view]) =>
    value.target &&
    view.pane === "apps" &&
    !view.boardFull &&
    (view.mobile || view.documentVisible)
      ? value.target
      : null,
  );
  track(
    authority.listen(() => {
      direct.dispose();
      apps.revoke();
      project("stay");
    }),
  );
  const stopViewerGate = layout.setViewerGate({
    deferNavigation: (callback) =>
      viewer.deferNavigation(() => {
        if (current()) callback();
      }),
  });
  let releaseAgents = () => {};
  const upload: ComposerUpload = async (input, signal) => {
    if (!current() || signal.aborted) throw Error("cancelled");
    const thread = selected(),
      controller = new AbortController(),
      abort = () => controller.abort();
    signal.addEventListener("abort", abort, { once: true });
    uploads.add(controller);
    try {
      const value = await createRoomApi(scope.roomId, async (url, init) => {
        const response = await browser.fetcher(url, {
          ...init,
          signal: controller.signal,
        });
        if (current() && response.status === 401)
          services.actions.sessionLost();
        return response;
      }).uploadFile(input);
      if (!forThread(thread) || controller.signal.aborted)
        throw Error("cancelled");
      return value;
    } finally {
      uploads.delete(controller);
      signal.removeEventListener("abort", abort);
    }
  };
  function defer(callback: () => void) {
    const thread = selected(),
      generation = services.router.generation();
    const run = () => {
      if (forThread(thread) && generation === services.router.generation())
        callback();
    };
    if (
      viewer.deferNavigation(() => {
        if (current() && !layout.deferNavigation(run)) run();
      })
    )
      return true;
    return layout.deferNavigation(run);
  }
  function clearNoticeTimer() {
    if (noticeTimer !== null) {
      if (clock) clock.cancel(noticeTimer);
      else clearTimeout(noticeTimer);
      noticeTimer = null;
    }
  }
  function showNotice(text: string, duration = 7000) {
    clearNoticeTimer();
    const ticket = ++noticeRevision;
    notice = text;
    project("stay");
    const expire = () => {
      if (!current() || ticket !== noticeRevision) return;
      noticeTimer = null;
      notice = "";
      project("stay");
    };
    noticeTimer = clock
      ? clock.schedule(expire, duration)
      : setTimeout(expire, duration);
  }
  function pickThread(thread: string) {
    if (!current() || defer(() => pickThread(thread))) return;
    const value = room()!;
    if (
      thread !== "main" &&
      !suggestionAt(value, thread) &&
      !value.epics.some((epic) => epic.id === thread)
    )
      return;
    const replace = layout.takeSheetEntry();
    services.actions.selectThread(thread, { replace });
  }
  function navigateMessage(id: number, thread?: string) {
    if (
      !current() ||
      !Number.isSafeInteger(id) ||
      id <= 0 ||
      defer(() => navigateMessage(id, thread))
    )
      return;
    const value = room()!,
      message = roomMessages(value).find((message) => message.id === id);
    if (message && !visibleMessage(value, message)) return;
    services.actions.navigate(
      {
        roomId: scope.roomId,
        thread: message?.thread ?? thread ?? selected(),
        messageId: id,
      },
      layout.takeSheetEntry(),
    );
  }
  function openSideFile(file: SideFileInput): boolean {
    if (!current()) return false;
    let opened = false;
    const captured = { ...file };
    const run = () => {
      if (current() && side.open(captured)) {
        opened = true;
        setPane("view", { open: true });
      }
    };
    if (!defer(run)) run();
    return opened;
  }
  function openFile(
    input: string | Attachment,
    trigger?: HTMLElement,
    label?: string,
  ) {
    if (!current()) return false;
    if (
      typeof input !== "string" &&
      !knownViewerFiles(room()!).some((file) => sameFile(file, input))
    )
      return false;
    if (typeof input === "string" && !/^[0-9a-f]+$/.test(input)) return false;
    return viewer.open(
      typeof input === "string"
        ? { roomId: scope.roomId, id: input, label }
        : { roomId: scope.roomId, id: input.id, metadata: input },
      trigger,
    );
  }
  function richNavigate(target: RichNavigation) {
    if (!current() || defer(() => richNavigate(target))) return;
    const thread = target.id ?? selected();
    if (
      thread !== "main" &&
      !room()!.epics.some((epic) => epic.id === thread)
    ) {
      showNotice(t("Esse épico não existe mais nesta sala."));
      return;
    }
    if (thread !== selected()) pickThread(thread);
    if (target.kind === "document" && current()) setPane("doc", { open: true });
  }
  const rich: RichActions = {
    navigate: navigateMessage,
    openFile,
    navigateRich: richNavigate,
    openFileReference: (file) => {
      if (current() && file.roomId === scope.roomId)
        openFile(file.id, undefined, file.name);
    },
    ensureFileIndex: () => {
      if (current()) void fileIndex.load();
    },
  };
  function openApp(target: AppTarget, requireOpeningConsent = false) {
    const captured = { ...target };
    if (
      !current() ||
      !/^(room|[a-f0-9]{12})$/.test(target.connection) ||
      !/^[\w.-]{1,100}$/.test(target.tool) ||
      defer(() => openApp(captured, requireOpeningConsent))
    )
      return;
    setPane("apps", { open: true });
    if (current()) apps.open(captured, { requireOpeningConsent });
  }
  function openAgentDocument(epic: string) {
    if (!current() || defer(() => openAgentDocument(epic))) return;
    if (epic && !room()!.epics.some((entry) => entry.id === epic)) {
      showNotice(t("Esse épico não existe mais nesta sala."));
      return;
    }
    if (epic && selected() !== epic) pickThread(epic);
    if (!current() || (epic && selected() !== epic)) return;
    // The room doc can open alongside the current epic's conversation.
    document.chooseRoom(!epic);
    if (current()) setPane("doc", { open: true });
  }
  function openAgentApp(target: AppTarget) {
    const captured = { ...target };
    if (!current() || defer(() => openAgentApp(captured))) return;
    if (
      captured.connection === "room" &&
      document.authorized() &&
      documentEmbedsApp(get(document.state).text, captured)
    )
      setPane("doc", { open: true });
    else openApp(captured, true);
  }
  function openAppRoute(target: AppRouteTarget) {
    if (
      !current() ||
      !appRouteHash(target) ||
      defer(() => openAppRoute(target))
    )
      return;
    if (target.tool !== undefined) {
      openApp({ connection: target.connection, tool: target.tool });
      return;
    }
    // A CID-only OAuth continuation returns to the refreshed catalog. It must
    // never guess a tool, start sign-in again, or accept an old frame question.
    appsStarted = true;
    apps.back();
    setPane("apps", { open: true });
    if (current()) apps.load();
  }
  function retryRoom() {
    if (current() && !defer(retryRoom)) services.actions.retryRoom();
  }
  function setPane(
    pane: DocumentPane,
    value?: { open?: boolean; toggle?: boolean; quiet?: boolean },
  ) {
    if (!current() || defer(() => setPane(pane, value))) return;
    layout.setPane(pane, value);
  }
  /** A panel's empty state hands its prompt to your Claude: it lands in this
   * thread's composer, focused, and waits for you to press Send. */
  function composeIn(thread: string, fill: (entry: ComposerEntry) => void) {
    if (!current() || thread.startsWith("pre:")) return;
    const entry = resources.composer.entry({
      account: scope.account,
      roomId: scope.roomId,
      thread,
    });
    fill(entry);
    if (layout.read().sheet) layout.closeSheet();
    entry.focus();
  }
  function reply(id: number, draft?: { thread: string; text: string }) {
    if (!current() || defer(() => reply(id, draft))) return;
    const value = room()!,
      target = roomMessages(value).find((message) => message.id === id);
    if (!target || !visibleMessage(value, target)) return;
    if (
      draft &&
      (target.thread !== draft.thread ||
        !canAnswer(value, target) ||
        !choicesOf(target.choices) ||
        choicesOf(target.choices)?.closed ||
        permissionAsk(target))
    )
      return;
    if (target.thread !== selected()) pickThread(target.thread);
    if (forThread(target.thread))
      resources.composer
        .entry({
          account: scope.account,
          roomId: scope.roomId,
          thread: target.thread,
        })
        .reply(target, draft?.text);
  }
  function syncAgent() {
    const next = services.syncAgents();
    if (next === agent) return;
    stopAgent();
    agent = next;
    const stop =
      agent?.state.subscribe(() => {
        if (!synchronizing) project("stay");
      }) ?? (() => {});
    if (active && agent === next) stopAgent = stop;
    else stop();
  }
  function activateApps() {
    if (!current()) return;
    if (!appsStarted) {
      appsStarted = true;
      apps.load();
    }
    if (!room()?.filesAll) apps.loadFiles(request);
  }
  function sync(snapshot: RootRoomSnapshot) {
    if (!current() || !snapshot.room) {
      dispose();
      return;
    }
    synchronizing = true;
    try {
      const value = snapshot.room,
        fresh = lastGeneration !== snapshot.snapshotGeneration;
      suggestionIntent = mutations.suggestionIntent();
      const changed = viewport.sync(
        value,
        snapshot.thread,
        snapshot.generation,
        snapshot.phase === "live",
        fresh,
      );
      if (changed) chatPresentation.reset();
      if (chatSurface?.connected()) viewport.attach(chatSurface);
      if (changed && lastThread !== snapshot.thread) {
        for (const controller of uploads) controller.abort();
        document.chooseRoom(false);
      }
      const authoritative =
        fresh || value.members !== lastSnapshot.room?.members;
      if (authoritative)
        resources.documents.authorize(value, snapshot.generation);
      document.sync(
        value,
        snapshot.thread,
        fresh,
        authoritative,
        snapshot.generation,
      );
      files.sync(value, fresh);
      syncPinsSession(pins, value);
      if (fresh) pins.filesRequested = false;
      if (snapshot.phase === "live") requestPinnedFiles(pins, value, send);
      syncNavigationSession(
        navigation,
        value,
        snapshot.thread,
        get(navigation.state).archived,
      );
      mutations.sync(value, request);
      viewer.sync(value, request, fresh);
      side.sync(value, request, fresh);
      fileIndex.sync(value, fresh);
      apps.sync({ ...value, messages: roomMessages(value) }, fresh);
      if (layout.read().pane === "files" && fresh) void files.load(request);
      if (layout.read().pane === "apps") activateApps();
      syncAgent();
      resources.composer
        .entry({
          account: scope.account,
          roomId: scope.roomId,
          thread: snapshot.thread,
        })
        .sync(value, composerRequestFor(snapshot.thread), upload);
      lastThread = snapshot.thread;
      lastGeneration = snapshot.snapshotGeneration;
      lastSnapshot = snapshot;
      if (
        changed &&
        snapshot.thread !== "main" &&
        !snapshot.thread.startsWith("pre:") &&
        !layout.read().documentVisible &&
        !layout.read().boardFull
      ) {
        const tasks =
          value.epics.find((epic) => epic.id === snapshot.thread)?.tasks ?? [];
        const waiting = me()?.waits.some(
          (wait) =>
            wait.book_id === value.id &&
            wait.thread === snapshot.thread &&
            wait.ref.startsWith("t"),
        );
        if (
          waiting ||
          tasks.some((task) => !task.done && task.owner === value.me) ||
          !value.messages.some((message) => message.thread === snapshot.thread)
        )
          layout.revealDocument();
      }
      if (
        changed &&
        (snapshot.thread !== "main" ||
          me()?.waits.some(
            (wait) =>
              wait.book_id === value.id && wait.thread === snapshot.thread,
          ))
      ) {
        const thread = snapshot.thread,
          generation = services.router.generation();
        viewport.defer(() => {
          const element = attentionElement,
            latest = room();
          if (
            !forThread(thread) ||
            generation !== services.router.generation() ||
            !element?.isConnected ||
            !latest
          )
            return;
          const tasks =
            thread === "main"
              ? (latest.roomTasks ?? [])
              : (latest.epics.find((epic) => epic.id === thread)?.tasks ?? []);
          const waiting = new Set(
            me()
              ?.waits.filter(
                (wait) =>
                  wait.book_id === latest.id &&
                  wait.thread === thread &&
                  wait.ref.startsWith("t"),
              )
              .map((wait) => wait.ref.slice(1)),
          );
          const wanted = new Set(
            tasks
              .filter((task) =>
                waiting.size
                  ? waiting.has(task.id)
                  : !task.done && task.owner === latest.me,
              )
              .map((task) => task.id),
          );
          const nodes = [
            ...element.querySelectorAll<HTMLElement>("[data-task]"),
          ].filter((node) => wanted.has(node.dataset.task ?? ""));
          nodes[0]?.scrollIntoView({ block: "center", behavior: "smooth" });
          for (const node of nodes)
            if (current() && node.isConnected && element.contains(node))
              node.dispatchEvent(new CustomEvent("vb:task-highlight"));
        }, 400);
      }
      viewport.ensureFilled();
    } finally {
      synchronizing = false;
    }
    project(viewport.pinned() ? undefined : "stay");
  }
  function project(nextKeep?: KeepChat) {
    if (synchronizing) return;
    if (projecting) {
      projectAgain = true;
      return;
    }
    if (!current()) return;
    projecting = true;
    try {
      do {
        projectAgain = false;
        const snapshot = frame(),
          value = snapshot?.room;
        if (!snapshot || !value) break;
        const thread = snapshot.thread,
          owned = () => forThread(thread),
          waits = me()?.waits ?? [],
          display = get(layout.state);
        if (nextKeep !== "stay" && nextKeep !== true) viewport.followLatest();
        chatPresentation.capture(nextKeep, !display.boardFull);
        const revision = ++chatRevision;
        const appProps: import("../apps/types").AppsProps = {
          ask: (prompt) => {
            if (owned()) composeIn(thread, (entry) => entry.edit(prompt));
          },
          connectionModes: direct.state,
          owner: apps,
          api: appApi,
          room: { ...value, messages: roomMessages(value) },
          thread,
          request,
          current: () => current() && authority.current(),
          checkAccess: retryRoom,
          name,
          ago,
          t,
          lang,
          openLink: browser.openExternal,
          metric: (kind, roomOnly) =>
            appRequests.run((signal) =>
              guardApp(metrics(kind, scope.roomId, roomOnly, signal)),
            ),
          putInDocument: (target) => {
            if (!owned()) return;
            const view = get(document.state),
              documentTarget = document.target();
            if (!documentTarget) return;
            const next = appendDocumentApp(view.text, target);
            if (
              next !== null &&
              document.rewrite(documentTarget, view.text, next)
            )
              setPane("doc", { open: true });
          },
        };
        const bridge: ChatBridge = {
          t,
          name,
          ago,
          locale,
          pageUrl: browser.href(),
          knownNames: {
            ...Object.fromEntries(
              me()
                ?.friends.filter((friend) => friend.name)
                .map((friend) => [friend.email, friend.name!]) ?? [],
            ),
            ...(me()?.name ? { [value.me]: me()!.name! } : {}),
          },
          avatarVersion: (email) => roomAvatarVersion(value, me(), email),
          hhmm: (ts) => chatTime(locale, ts),
          dateTime: (ts) => chatDateTime(locale, ts),
          waiting: (id) =>
            waits.some(
              (wait) => wait.book_id === scope.roomId && wait.ref === `m${id}`,
            ),
          typingLabel: (mode) =>
            mode === "route"
              ? t("escolhendo o modelo")
              : mode === "fast"
                ? t("rápido")
                : mode === "smart"
                  ? t("com calma")
                  : mode,
          typingNote: (id) => snapshot.typingNotes.get(id),
        };
        const threadRequest = (command: RoomCommand) =>
          owned() ? request(command) : failed();
        const threadSend = (command: RoomCommand) => owned() && send(command);
        const panel = {
          room: value,
          thread,
          vb: { t, ago, name, locale, avatarVersion: bridge.avatarVersion },
          send: threadSend,
          request: threadRequest,
          waits,
          onopen: pickThread,
          ...(thread.startsWith("pre:")
            ? {}
            : {
                ask: (prompt: string) => {
                  if (owned()) composeIn(thread, (entry) => entry.edit(prompt));
                },
                attach: (files: readonly File[]) => {
                  if (owned())
                    composeIn(thread, (entry) => entry.addFiles(files));
                },
              }),
        };
        const actions: ChatActions = {
          ...rich,
          openSideFile: (file) => {
            if (owned()) openSideFile(file);
          },
          sideFileName:
            display.pane === "view" ? side.target()?.name : undefined,
          request: threadRequest,
          reply: (id) => {
            if (owned()) reply(id);
          },
          draftReply: (draft) => {
            if (owned()) reply(draft.messageId, draft);
          },
          navigate: (id, target) => {
            if (owned()) navigateMessage(id, target);
          },
          openApp: (target) => {
            if (owned()) openApp(target);
          },
          openFile: (file) => {
            if (owned()) openFile(file);
          },
          openFileReference: (file) => {
            if (owned()) rich.openFileReference?.(file);
          },
          ensureFileIndex: () => {
            if (owned()) rich.ensureFileIndex?.();
          },
          mountEmbed: (element, file, controls) => {
            if (!owned() || !element.isConnected) return () => {};
            const detach = mountChatApp({
              frame: element,
              file,
              controls,
              authority,
              room: () =>
                owned()
                  ? { ...room()!, messages: roomMessages(room()!) }
                  : null,
              current: owned,
              request: threadRequest,
              name,
              t,
              locale,
              open: browser.openExternal,
              api: appApi,
              metrics: (kind, id, roomOnly, signal) =>
                guardApp(metrics(kind, id, roomOnly, signal)),
            });
            const stop = () => {
              embeds.delete(stop);
              detach();
            };
            embeds.add(stop);
            return stop;
          },
        };
        const source = value.epics.find((epic) => epic.id === thread)?.from_msg;
        const origin = source
          ? roomMessages(value).find(
              (message) =>
                message.id === source && visibleMessage(value, message),
            )
          : null;
        const selectedMessages = viewport.selection(),
          visible = visibleChatMessages(value, thread);
        const metadata = agent ? get(agent.state) : null;
        const queue = agentQueue(value, Date.now()),
          data = metadata?.data;
        const status = agentStatus(
          agentPresence(data ?? null, value.me, Date.now()),
          metadata ? metadata.hasAgent : null,
          metadata?.askedAt ?? 0,
          Date.now(),
        );
        const mark = agentMark(data ? status : "off", queue);
        const counts = {
          board: [
            ...value.epics.flatMap((epic) => epic.tasks),
            ...(value.roomTasks ?? []),
          ].filter((task) => !task.done && task.owner === value.me).length,
          files: value.filesN ?? value.files?.length ?? 0,
          apps: apps.connectionCount() + roomApps(value).length,
          decisions: value.decisions?.length ?? 0,
          reminders: value.reminders?.some((item) => item.error)
            ? `${value.reminders.length} ⚠`
            : (value.reminders?.length ?? 0),
          agents: queue.length,
        };
        const sidebarBridge = {
          t,
          ago,
          name,
          avatarVersion: bridge.avatarVersion,
          epicBusy: (epic: Room["epics"][number]) => {
            const worker = threadWorkers(value, epic.id, Date.now())[0];
            return worker
              ? t("{via} de {who}", {
                  via: worker.who,
                  who: name(worker.email),
                })
              : null;
          },
          waitsIn: (target: string) =>
            waits.filter(
              (wait) => wait.book_id === value.id && wait.thread === target,
            ),
          waitsInRoom: () => waits.filter((wait) => wait.book_id === value.id),
        };
        const book = me()?.books.find((book) => book.id === value.id),
          icon = book?.icon
            ? `/api/books/${value.id}/icon?v=${book.icon}`
            : undefined;
        const pre = suggestionAt(value, thread);
        const openAgents = () => {
          if (current()) setPane("agents", { open: true });
        };
        const toolbar = {
          owner: document,
          sideFileName: side.target()?.name,
          room: value,
          pane: display.pane,
          lang,
          counts,
          agent: mark,
          agentTitle: agentMarkLabel(
            lang === "en" ? "en" : "pt",
            mark.state,
            data ? status : "off",
            mark.count,
          ),
          onPane: (pane: DocumentPane) => {
            if (current()) setPane(pane);
          },
        };
        const projected: RoomScopePresentation = {
          scope: {
            ...scope,
            navigationGeneration: services.router.generation(),
          },
          chatRevision: revision,
          notice,
          sidebar: {
            room: value,
            thread,
            collapsed: display.sidebarCollapsed && !display.mobile,
            roomIcon: icon,
            locale,
            mutations,
            presence: data ?? undefined,
            vb: sidebarBridge,
            navigation,
            pins,
            send,
            request,
            friends: (me()?.people ?? []).map((person) => person.email),
            appNavigation: { controller: services.navigation, lang },
            ontogglerail: () => {
              if (current()) layout.toggleSidebar();
            },
            onrenameroom: () => {
              if (current()) services.navigation.askRename(value.id);
            },
            onopenside: () => {
              if (current()) layout.openSheet("side");
            },
            onopen: (target) => {
              if (current()) pickThread(target);
            },
            onarchchange: (archived) => {
              if (current()) {
                navigation.state.update((before) => ({ ...before, archived }));
                project("stay");
              }
            },
            onopenpinfile: (file) => {
              if (current()) openFile(file);
            },
            onopenpinapp: (app) =>
              openApp({ connection: app.connectionId, tool: app.tool }),
            activePinApp,
          },
          header: {
            room: value,
            thread,
            owner: mutations,
            vb: sidebarBridge,
            roomIcon: icon,
            onopenside: () => {
              if (current()) layout.openSheet("side");
            },
            onrenameroom: () => {
              if (current()) services.navigation.askRename(value.id);
            },
          },
          chat: pre
            ? null
            : {
                room: value,
                thread,
                ...selectedMessages,
                origin: origin ?? null,
                replyCount: value.counts
                  ? (value.counts[thread] ?? 0) +
                    visible.filter(
                      (message) => message.id > (value.countsAt ?? 0),
                    ).length
                  : visible.length,
                vb: bridge,
                actions,
                onloadolder: () => {
                  if (owned()) viewport.loadOlder();
                },
              },
          composer: pre
            ? null
            : {
                room: value,
                thread,
                vb: bridge,
                drafts: resources.composer,
                request: composerRequestFor(thread),
                upload,
                voice: {
                  current: owned,
                  beforeLeave: (callback) => {
                    voiceLeaving.add(callback);
                    return () => {
                      voiceLeaving.delete(callback);
                    };
                  },
                  transcribe: async (audio, signal) => {
                    if (!owned()) throw new VoiceFailure(0);
                    const latest = room();
                    if (!latest) throw new VoiceFailure(0);
                    const prompt =
                      `Conversa no deco.chat, sala ${latest.book.title}. Pessoas: ${latest.members.map((email) => email.split("@")[0]).join(", ")}. Épicos: ${latest.epics
                        .filter((epic) => !epic.archived)
                        .slice(0, 15)
                        .map((epic) => epic.title)
                        .join("; ")}.`.slice(0, 600);
                    try {
                      return await voiceApi.transcribe(
                        scope.roomId,
                        audio,
                        { lang: locale.split("-")[0] || "pt", prompt },
                        signal,
                      );
                    } catch (error) {
                      if (owned() && error instanceof VoiceFailure) {
                        if (error.unauthenticated)
                          services.actions.sessionLost();
                        else if (error.membershipDenied)
                          services.rootRoom.denyMembership(
                            scope.roomId,
                            scope.account,
                            scope.roomGeneration,
                          );
                      }
                      throw error;
                    }
                  },
                },
                agents: data?.sandboxes ?? [],
                navigate: (id) => {
                  if (owned()) navigateMessage(id, thread);
                },
                hidden: display.boardFull,
              },
          suggestion: pre
            ? {
                room: value,
                index: Number(thread.slice(4)),
                owner: mutations,
                vb: bridge,
              }
            : null,
          document: {
            owner: document,
            props: {
              room: value,
              thread,
              send: threadSend,
              taskProps: panel,
              actions: rich,
              lang,
              pane: display.pane,
              onPane: setPane,
              onAuthorize: retryRoom,
              apps: appProps,
              openApp: (target) => {
                if (current()) {
                  apps.open(target);
                  setPane("apps", { open: true });
                }
              },
            },
          },
          toolbar,
          peek: {
            ...toolbar,
            compact: true,
            onPane: (pane: DocumentPane) => {
              if (current()) setPane(pane, { open: true, toggle: true });
            },
          },
          board: panel,
          decisions: panel,
          reminders: panel,
          files: {
            ...panel,
            session: files,
            request,
            onfolderchange: () => {
              if (current() && filesElement?.isConnected)
                filesElement.scrollTop = 0;
            },
            onopenfile: (file) => {
              if (current()) openFile(file);
            },
          },
          apps: appProps,
          agents: agent
            ? {
                owner: agent,
                origin: browser.origin,
                vb: { t, ago },
                name,
                onnavigate: navigateMessage,
                lang,
              }
            : null,
          banners: agent
            ? {
                owner: agent,
                origin: browser.origin,
                name,
                onopen: openAgents,
                onnavigate: navigateMessage,
                lang,
              }
            : null,
          trigger: agent
            ? {
                owner: agent,
                onopen: openAgents,
                lang,
                queue,
                origin: browser.origin,
              }
            : null,
          threadFiles: {
            room: value,
            thread,
            lang,
            onopen: (file: Attachment, trigger: HTMLElement) => {
              if (current() && trigger.isConnected) openFile(file, trigger);
            },
          },
          sideFile: {
            owner: side,
            lang,
            actions: rich,
            current,
            fullscreen: (id: string) => openFile(id),
            close: () => {
              if (current()) {
                side.close();
                setPane("doc");
              }
            },
          },
          viewer: {
            controller: viewer,
            lang,
            iosStandalone: browser.iosStandalone,
            actions: rich,
          },
        };
        state.set(projected);
      } while (projectAgain && current());
    } finally {
      projecting = false;
    }
  }
  function target(intent: ApplicationRoomIntent) {
    if (
      !current() ||
      intent.scope.connection !== scope.connection ||
      intent.scope.roomGeneration !== scope.roomGeneration ||
      intent.scope.account !== scope.account ||
      intent.scope.navigationGeneration !== services.router.generation()
    )
      return;
    document.chooseRoom(false);
    if (intent.unavailableThread) {
      showNotice(t("Esse épico não existe mais nesta sala."));
      if (intent.target.document) return;
    }
    if (intent.pane) setPane(intent.pane);
    if (intent.target.messageId)
      pendingMessage = {
        id: intent.target.messageId,
        thread: intent.target.thread,
        navigation: intent.scope.navigationGeneration,
      };
    else if (intent.target.fileId) openFile(intent.target.fileId);
    else if (intent.target.document) setPane("doc", { open: true });
    else if (intent.target.app) openAppRoute(intent.target.app);
    project("stay");
  }
  function transition(value: RootRoomTransition) {
    if (!current()) return;
    const event = value.event,
      canonical = room()!;
    docVersionEvent(event);
    if (event.t === "older") viewport.older(event);
    else if (event.t === "openSide") openSideFile(event.file);
    else if (event.t === "openDoc") openAgentDocument(event.epic);
    // auto = a room app the agent just uploaded: the doc that embeds it redraws by itself; never switch to Apps (#2720).
    else if (event.t === "openApp" && !event.auto) {
      const target = appRouteTarget("#app:" + event.ref);
      if (target?.tool !== undefined) {
        openAgentApp({ connection: target.connection, tool: target.tool });
      }
    } else if (event.t === "doc" && event.stale)
      document.invalidate(event.epic);
    else if (event.t === "suggestions" && selected().startsWith("pre:")) {
      const old = value.previous?.suggestions[Number(selected().slice(4))];
      if (old) {
        const identity = suggestionIdentity(old),
          index = canonical.suggestions.findIndex(
            (item) => suggestionIdentity(item) === identity,
          );
        pickThread(
          index >= 0
            ? `pre:${index}`
            : suggestionIntent?.identity === identity &&
                !suggestionIntent.accept &&
                canonical.suggestions.length
              ? `pre:${Math.min(suggestionIntent.index, canonical.suggestions.length - 1)}`
              : "main",
        );
      }
    } else if (event.t === "conns") apps.load();
    else if (event.t === "error") showNotice(event.error || t("falhou"));
    else if (event.t === "blocked")
      showNotice(
        t(
          "Não enviei: parece {reason}. Segredo não entra na sala, nem pra você nem pros agents. Manda por um canal seguro.",
          { reason: event.reason },
        ),
      );
    if (event.t === "msg") {
      services.pwa.notify(
        event.m,
        canonical,
        selected(),
        (handle) => roomMention(canonical, me(), handle),
        (message) =>
          message.author === "ai"
            ? "@vibe"
            : message.kind === "agent"
              ? t("{via} de {who}", {
                  via: message.via || "agent",
                  who: name(message.author),
                })
              : name(message.author),
      );
      project(
        viewport.pinned() ||
          (event.m.author === canonical.me && event.m.kind !== "agent")
          ? undefined
          : "stay",
      );
    } else project(event.t === "older" ? true : "stay");
  }
  let disposing = false;
  function dispose() {
    if (!active || disposing) return;
    disposing = true;
    leaveVoice();
    voiceLeaving.clear();
    active = false;
    direct.dispose();
    richFiles.dispose();
    pendingMessage = null;
    noticeRevision++;
    clearNoticeTimer();
    notice = "";
    detachApplication();
    stopViewerGate();
    stopAgent();
    for (const stop of stops.splice(0)) stop();
    for (const controller of uploads) controller.abort();
    uploads.clear();
    for (const stop of [...embeds]) stop();
    document.dispose();
    viewer.dispose();
    side.dispose();
    viewport.dispose();
    files.dispose();
    disposePinsSession(pins);
    mutations.dispose();
    fileIndex.dispose();
    appRequests.dispose();
    apps.dispose();
    // These actors belong to ApplicationServices; release only the attached room.
    releaseAgents();
    chatElement = filesElement = attentionElement = null;
    chatSurface = null;
    state.set(null);
  }
  track(services.rootRoom.state.subscribe((snapshot) => sync(snapshot)));
  track(
    services.personal.state.subscribe(() => {
      if (current()) {
        syncAgent();
        project("stay");
      }
    }),
  );
  let lastPane = layout.read().pane;
  let layoutProjection = "";
  track(
    layout.state.subscribe((value) => {
      if (!current()) return;
      const projected = [
        value.pane,
        value.sheet,
        value.boardFull,
        value.documentVisible,
        value.sidebarCollapsed,
        value.mobile,
        value.active,
      ].join("|");
      if (projected === layoutProjection) return;
      layoutProjection = projected;
      if (value.pane !== lastPane) {
        lastPane = value.pane;
        if (get(services.state).pane !== value.pane)
          services.actions.selectPane(value.pane);
        if (value.pane === "files") void files.load(request);
        if (value.pane === "apps") activateApps();
        syncAgent();
      }
      project("stay");
    }),
  );
  track(
    services.state.subscribe((value) => {
      if (current() && value.pane !== layout.read().pane)
        layout.setPane(value.pane);
    }),
  );
  track(
    browser.listenVisibility(() => {
      if (current()) {
        syncAgent();
        project("stay");
      }
    }),
  );
  if (current()) releaseAgents = services.agents.claimAttachment();
  detachApplication = services.attachRoom(scope, {
    beforeNavigation() {
      leaveVoice();
      viewer.closeNavigation();
      layout.beforeNavigation();
    },
    reset: dispose,
    consumePop: () =>
      consumeFileViewerPop(
        viewer,
        current()
          ? { roomId: scope.roomId, account: scope.account, thread: selected() }
          : null,
        () => layout.consumePop(),
        browser.href(),
      ),
    deferNavigation: (callback) => defer(callback),
    onTarget: target,
    onTransition: transition,
    onTerminal: dispose,
  });
  return {
    state: readonly(state),
    viewer,
    richFiles,
    current,
    attachChat(element) {
      if (!current() || !element.isConnected) return () => {};
      const surface = createChatSurface(element);
      chatElement = element;
      chatSurface = surface;
      viewport.attach(surface);
      project(viewport.pinned() ? undefined : "stay");
      return () => {
        if (chatSurface === surface) {
          chatElement = null;
          chatSurface = null;
          viewport.detachSurface(surface);
        }
      };
    },
    attachFiles(element) {
      filesElement = element;
      return () => {
        if (filesElement === element) filesElement = null;
      };
    },
    attachAttention(element) {
      attentionElement = element;
      return () => {
        if (attentionElement === element) attentionElement = null;
      };
    },
    chatRendered(revision) {
      if (!current() || revision !== chatRevision || !chatElement?.isConnected)
        return;
      if (chatSurface) viewport.attach(chatSurface);
      if (!chatPresentation.rendered(!layout.read().boardFull)) return;
      const intent = pendingMessage;
      if (intent && intent.navigation === services.router.generation()) {
        pendingMessage = null;
        viewport.go(intent.id, intent.thread);
      }
    },
    actions: {
      setPane,
      setThread: pickThread,
      openFile,
      openSideFile,
      currentSideFile: () => side.target(),
      navigateMessage,
      loadOlder: () => {
        if (current()) viewport.loadOlder();
      },
      retry: retryRoom,
      closeNavigation: () => {
        if (current()) viewer.closeNavigation();
      },
      closeDocument: () => {
        if (current()) document.mode("preview");
      },
    },
    dispose,
  };
}
