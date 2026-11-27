<script lang="ts">
  import { onDestroy, tick, untrack, type Snippet } from "svelte";
  import { MediaQuery } from "svelte/reactivity";
  import { MOBILE_QUERY } from "../../lib/breakpoints";
  import type { Room, Epic } from "../../../shared/room";
  import type { RoomMutations } from "../room-sidebar/session";
  import { epicStatus, epicStatusLook } from "../room-sidebar/model";
  import PersonAvatar from "../../lib/components/PersonAvatar.svelte";
  import { studioType } from "../../lib/components/type";
  import Button from "../../lib/studio/Button.svelte";
  import Progress from "../../lib/studio/Progress.svelte";
  import { EPIC_PROGRESS } from "../room-shell/shape";
  import Icon from "../../lib/studio/Icon.svelte";
  import Tabs from "../../lib/studio/Tabs.svelte";
  import TabsContent from "../../lib/studio/TabsContent.svelte";
  import TabsList from "../../lib/studio/TabsList.svelte";
  import TabsTrigger from "../../lib/studio/TabsTrigger.svelte";
  import { cn } from "../../lib/studio/utils";
  import EmptyState from "../../lib/components/EmptyState.svelte";
  import WaitBadge from "../waits/WaitBadge.svelte";
  import { waitCount, type WaitReference } from "../waits/model";
  import Tooltip from "../../lib/studio/Tooltip.svelte";
  import TooltipContent from "../../lib/studio/TooltipContent.svelte";
  import TooltipTrigger from "../../lib/studio/TooltipTrigger.svelte";
  import SortableItem from "../../lib/components/SortableItem.svelte";
  import { landing } from "../../lib/components/sortOrder";
  import SortableList, {
    ROOT_GROUP,
    type SortMove,
  } from "../../lib/components/SortableList.svelte";
  import { copyChatText } from "../chat/clipboard";
  import {
    roomMenuTrigger,
    type MenuPoint,
  } from "../app-navigation/roomMenuTrigger";
  import ThreadMenu from "./ThreadMenu.svelte";
  import {
    doneEpics,
    activeEpics,
    epicForest,
    mineEpics,
    reorderEpics,
    sidebarEpics,
    visibleEpics,
    threadLink,
    threadMenuStatus,
    EPIC_PAGE,
    type ThreadView,
  } from "./model";
  import {
    enterNavigationThread,
    setNavigationView,
    type NavigationSession,
  } from "./session";

  let {
    room,
    thread,
    session,
    mutations,
    onopen,
    onviewchange,
    selectionDisabled = false,
    onBeforeOpen,
    lead,
    vb,
  }: {
    room: Room;
    thread: string;
    session: NavigationSession;
    mutations: RoomMutations;
    onopen: (id: string) => void;
    onviewchange: (view: ThreadView) => void;
    selectionDisabled?: boolean;
    onBeforeOpen?: () => boolean;
    /** A row before the list in each tab: the room's chat on phones (Gimenes #6117). */
    lead?: Snippet;
    vb: {
      t: (text: string, vars?: Record<string, string | number>) => string;
      name: (email: string) => string;
      avatarVersion: (email: string) => number | null | undefined;
      epicBusy: (epic: Epic) => string | null;
      waitsIn: (thread: string) => readonly WaitReference[];
      /** The room's notice at the foot of the screen ("Copiado"); without it, the list's own status line says it. */
      notice?: (text: string) => void;
    };
  } = $props();
  const uid = $props.id();
  // Phone: the drawer's thread rows look like the home's chat list, 72px (Gimenes #6051, #6063): a big face, the
  // title, two lines of the thread's last message (else its task progress), the status at the end.
  const phone = new MediaQuery(MOBILE_QUERY);
  const lastMessages = $derived.by(() => {
    const last = new Map<string, Room["messages"][number]>();
    if (!phone.current) return last;
    for (const message of room.messages)
      if (message.tag !== "fire" && message.text.trim())
        last.set(message.thread, message);
    return last;
  });
  function rowPreview(epic: Epic) {
    const message = lastMessages.get(epic.id);
    if (message) {
      const text = message.text
        .replace(/[*_`#>~]|!?\[([^\]]*)\]\([^)]*\)/g, "$1")
        .replace(/\s+/g, " ")
        .trim();
      return `${vb.name(message.author).split(" ")[0]}: ${text}`;
    }
    const done = epic.tasks.filter((task) => task.done).length;
    return epic.tasks.length
      ? vb.t("{done} de {total} tarefas", { done, total: epic.tasks.length })
      : epic.owner
        ? vb.name(epic.owner)
        : "";
  }
  /** Threads with a message you have not seen (Book.unreadThreads): their names are bolder (Valls). */
  const unread = $derived(new Set(room.unread ?? []));
  let navigation = $derived(session.state);
  const mutation = untrack(() => mutations.state);
  const mutationBusy = $derived(
    $mutation.phase === "pending" || $mutation.phase === "unconfirmed",
  );
  let error = $state("");
  /** The order just dropped, shown until the server confirms (or refuses) it. */
  let localOrder = $state<string[] | null>(null);
  /** The order while a row is dragged: the others make room. */
  let dragOrder = $state<string[] | null>(null);
  let disposed = false;
  const rowNodes = new Map<string, HTMLElement>();
  let generation = 0;
  type OrderRequest = {
    ids: string[];
    from: string;
    thread: string;
    generation: number;
    anchor: HTMLElement | null;
  };
  let requested = $state<OrderRequest | null>(null);
  let announcement = $state("");
  onDestroy(() => {
    disposed = true;
    generation++;
    rowNodes.clear();
  });
  const orderedEpics = $derived.by(() => {
    const order = dragOrder ?? localOrder;
    if (!order) return room.epics;
    const position = new Map(order.map((id, index) => [id, index]));
    return [...room.epics].sort(
      (a, b) =>
        (position.get(a.id) ?? order.length) -
        (position.get(b.id) ?? order.length),
    );
  });
  const active = $derived(sidebarEpics(activeEpics(orderedEpics, thread)));
  /** Past EPIC_PAGE unpinned epics the list stops at "Ver mais" (the open one always shows). */
  let showAll = $state(false);
  /** How many epics fit before the user center with "Ver mais" and the next section's title still above it, so the
   *  rest of the sidebar starts in view (3 to EPIC_PAGE; EPIC_PAGE without a foot, on phones). */
  let fit = $state(EPIC_PAGE);
  let list = $state<HTMLElement | null>(null);
  function measure() {
    const side = list?.closest("[data-room-sidebar-panel]");
    const foot = side?.querySelector("[data-user-center]");
    if (!list || !side || !foot?.getClientRects().length) {
      fit = EPIC_PAGE;
      return;
    }
    const box = side.getBoundingClientRect();
    const top = list.getBoundingClientRect().top - box.top + side.scrollTop;
    const bottom = foot.getBoundingClientRect().top - box.top;
    const pitch =
      (list.firstElementChild?.getBoundingClientRect().height || 36) + 2;
    fit = Math.min(
      EPIC_PAGE,
      // 94: "Ver mais" and the next section's title (the "Nova thread" row, 38 more, is gone: Gimenes #4286).
      Math.max(3, Math.floor((bottom - top - 94) / pitch)),
    );
  }
  $effect(() => {
    const side = list?.closest("[data-room-sidebar-panel]");
    if (!side) return;
    // After layout, and whenever the sidebar or its foot change size (window, a section growing above).
    const observer = new ResizeObserver(() => measure());
    observer.observe(side);
    for (const node of side.querySelectorAll(
      "[data-user-center], [data-room-views]",
    ))
      observer.observe(node);
    return () => observer.disconnect();
  });
  const done = $derived(doneEpics(orderedEpics));
  /** The Open list's threads that are yours, in the same order. */
  const mine = $derived(mineEpics(active, room.me));
  // Three tabs (Viktor): Mine (the open threads you own), Open (to do, doing,
  // requires action, then @vibe's proposals: open one to see it, start it to
  // make it a thread) and Done (the archive). An empty tab says so.
  const mode = $derived($navigation.view);
  /** The list is flat: sub-epics are plain rows, with no branches to open. */
  const flat = (list: readonly Epic[]) =>
    list.map((epic) => (epic.parent ? { ...epic, parent: undefined } : epic));
  const forest = $derived(
    epicForest(flat(mode === "done" ? done : mode === "mine" ? mine : active)),
  );
  const entryForest = $derived(epicForest(room.epics));
  const workingEpics = $derived(
    new Set(
      room.epics.filter((epic) => vb.epicBusy(epic)).map((epic) => epic.id),
    ),
  );
  const allRows = $derived(
    visibleEpics(forest, $navigation.closed, workingEpics, true),
  );
  const page = $derived(
    Math.max(3, fit - allRows.filter((row) => row.epic.pinned).length),
  );
  const hiddenCount = $derived(
    Math.max(0, allRows.filter((row) => !row.epic.pinned).length - page),
  );
  const rows = $derived.by(() => {
    if (showAll || !hiddenCount) return allRows;
    let shown = 0;
    return allRows.filter(
      (row) =>
        row.epic.pinned ||
        shown++ < page ||
        (!selectionDisabled && row.epic.id === thread),
    );
  });
  // The rows are flat, but a sub-thread sorts only among its siblings (the order the server keeps,
  // reorderEpics): its group is its real parent.
  const parents = $derived(
    epicForest(orderedEpics.filter((epic) => !epic.done)).parents,
  );
  const groupOf = (id: string) => parents.get(id) ?? ROOT_GROUP;
  const groupMembers = (group: string) =>
    forest.roots.filter((epic) => groupOf(epic.id) === group);
  const siblingIndex = $derived.by(() => {
    const counts = new Map<string, number>();
    return new Map(
      forest.roots.map((epic) => {
        const group = groupOf(epic.id),
          index = counts.get(group) ?? 0;
        counts.set(group, index + 1);
        return [epic.id, index] as const;
      }),
    );
  });
  const rowIds = $derived(
    new Map(rows.map((row, index) => [row.epic.id, `${uid}-row-${index}`])),
  );
  $effect(() => {
    enterNavigationThread(session, entryForest, thread);
  });

  function switchMode(value: string) {
    const view = views.find((entry) => entry.value === value)?.value;
    if (disposed || !view) return;
    generation++;
    requested = null;
    localOrder = null;
    setNavigationView(session, view);
    onviewchange(view);
    error = "";
  }
  async function submit(command: Parameters<RoomMutations["run"]>[0]) {
    if (disposed || mutationBusy || session.roomId !== room.id) return false;
    error = "";
    const success = await mutations.run(command);
    return success;
  }
  $effect(() => {
    // A suggestion opened from elsewhere (a link, Back) opens the Open tab, with its row.
    if (thread.startsWith("pre:") && untrack(() => $navigation.view) !== "open")
      navigation.update((state) => ({ ...state, view: "open" }));
  });
  function siblings(id: string) {
    return groupMembers(groupOf(id));
  }
  /** Only pinned epics take a hand-made order; the rest follow recency. */
  function adjacent(id: string, direction: -1 | 1) {
    const peers = siblings(id).filter((epic) => epic.pinned);
    return peers[peers.findIndex((epic) => epic.id === id) + direction];
  }
  async function reorder(from: string, to: string, after: boolean) {
    const ids = reorderEpics(orderedEpics, from, to, after);
    if (!ids || disposed) return;
    requested = null;
    const version = ++generation;
    const active = document.activeElement;
    const anchor =
      active instanceof HTMLElement && rowNodes.get(from)?.contains(active)
        ? active
        : null;
    const targetThread = thread;
    localOrder = ids;
    const saved = await submit({ t: "epic.order", ids });
    if (generation !== version) return;
    if (saved && !disposed && thread === targetThread)
      requested = { ids, from, anchor, generation: version, thread };
    else localOrder = null;
  }
  /** A row was dropped at a new place among its siblings. */
  function sorted(move: SortMove) {
    if (disposed || mode !== "open") return;
    const shown = new Set(forest.roots.map((epic) => epic.id));
    const place = landing(
      move.order,
      move.id,
      (id) => shown.has(id) && groupOf(id) === move.group,
    );
    if (place) void reorder(move.id, place.to, place.after);
  }
  const registerRow = (id: string) => (node: HTMLElement) => {
    rowNodes.set(id, node);
    return () => {
      if (rowNodes.get(id) === node) rowNodes.delete(id);
    };
  };
  $effect(() => {
    const request = requested;
    if (!request) return;
    if (request.thread !== thread || mode !== "open") {
      requested = null;
      localOrder = null;
      generation++;
      return;
    }
    const current = room.epics.map((epic) => epic.id);
    if (!current.includes(request.from)) {
      requested = null;
      localOrder = null;
      restoreOrderFocus(request);
      return;
    }
    const known = new Set(current),
      expectedIds = new Set(request.ids);
    const expected = request.ids.filter((id) => known.has(id));
    const actual = current.filter((id) => expectedIds.has(id));
    if (
      actual.length !== expected.length ||
      actual.some((id, index) => id !== expected[index])
    )
      return;
    requested = null;
    localOrder = null;
    announcement = vb.t("Ordem das threads atualizada.");
    restoreOrderFocus(request);
  });
  function restoreOrderFocus(request: OrderRequest) {
    const anchor = request.anchor;
    if (!anchor) return;
    const eligible = () =>
      document.activeElement === document.body ||
      document.activeElement === anchor;
    if (!eligible()) return;
    void tick().then(() => {
      if (disposed || request.generation !== generation || !eligible()) return;
      if (document.activeElement === anchor && !anchor.matches(":disabled"))
        return;
      const row = rowNodes.get(request.from);
      if (row?.hidden) return;
      const target = row?.querySelector<HTMLElement>("[data-epic-thread]");
      target?.focus({ preventScroll: true });
    });
  }
  function move(id: string, direction: -1 | 1) {
    const target = adjacent(id, direction);
    if (mode === "open" && target) reorder(id, target.id, direction === 1);
  }
  // A row's menu (ThreadMenu): a right-click, a long press or Shift+F10 on the row (roomMenuTrigger).
  let menu = $state<{
    id: string;
    trigger: HTMLElement;
    point: MenuPoint;
    keyboard: boolean;
  } | null>(null);
  const menuEpic = $derived(
    menu ? room.epics.find((epic) => epic.id === menu!.id) : undefined,
  );
  const openMenu =
    (id: string) => (trigger: HTMLElement, point?: MenuPoint) => {
      if (disposed) return;
      // From the keyboard: under the row, at its start.
      const box = trigger.getBoundingClientRect();
      menu = {
        id,
        trigger,
        point: point ?? { x: box.left + 12, y: box.bottom },
        keyboard: !point,
      };
    };
  // Opened from the keyboard, the focus goes back to the row. After a pointer, it does not: the row's
  // tooltip opens on focus and stays open over the list.
  function closeMenu() {
    const trigger = menu?.keyboard ? menu.trigger : null;
    menu = null;
    if (trigger?.isConnected) trigger.focus({ preventScroll: true });
  }
  function say(text: string) {
    if (disposed) return;
    if (vb.notice) vb.notice(text);
    else announcement = text;
  }
  async function copyThreadLink(id: string) {
    try {
      await copyChatText(threadLink(location.href, room.id, id));
      navigator.vibrate?.(15);
      say(vb.t("Copiado"));
    } catch {
      say(vb.t("Não consegui copiar o link."));
    }
  }
  /** Done (its open tasks close, like "Mark as done"), or open again from the Done tab. */
  async function toggleDone(epic: Epic) {
    const reopen = !!epic.done;
    const ok = await submit(threadMenuStatus(epic));
    say(
      vb.t(
        reopen
          ? ok
            ? "Thread reaberta"
            : "Não deu pra reabrir a thread. Tente de novo."
          : ok
            ? "Thread marcada como feita"
            : "Não deu pra marcar como feita. Tente de novo.",
      ),
    );
  }
  // The labels are the same English words in both languages (Viktor).
  const views = $derived([
    {
      value: "mine" as const,
      label: vb.t("Mine"),
      empty: {
        icon: "user-01" as const,
        title: vb.t("Nenhuma thread aberta é sua"),
        description: vb.t(
          "As threads que você cria ou que passam para você aparecem aqui.",
        ),
      },
    },
    {
      value: "open" as const,
      label: vb.t("Open"),
      empty: {
        icon: "message-circle-01" as const,
        title: vb.t("Nenhuma thread aberta"),
        description: vb.t("Para abrir uma, use Criar thread numa mensagem."),
      },
    },
    {
      value: "done" as const,
      label: vb.t("Done"),
      empty: {
        icon: "check-circle" as const,
        title: vb.t("Nenhuma thread feita ainda"),
        description: vb.t("Uma thread marcada como feita vem para cá."),
      },
    },
  ]);
</script>

<section
  data-view="epics"
  aria-label={vb.t("Threads")}
  class={cn(
    studioType,
    "m-0 box-border flex shrink-0 flex-col p-0 text-sm leading-5 text-sidebar-foreground max-md:min-h-0 max-md:shrink",
  )}
>
  {#snippet panel(view: (typeof views)[number])}
    {@const value = view.value}
    {#if value === mode}
      {@render lead?.()}
      <ul
        bind:this={list}
        aria-label={view.label}
        class="m-0 flex list-none flex-col gap-1 p-0"
      >
        <SortableList
          ids={orderedEpics.map((epic) => epic.id)}
          bind:order={dragOrder}
          onmove={sorted}
        >
          {#each rows as row (row.epic.id)}
            {@const epic = row.epic}
            {@const current = !selectionDisabled && thread === epic.id}
            {@const fresh = !current && unread.has(epic.id)}
            {@const status = epicStatus(epic)}
            <SortableItem
              as="li"
              {@attach registerRow(epic.id)}
              sortId={epic.id}
              index={siblingIndex.get(epic.id) ?? 0}
              group={groupOf(epic.id)}
              disabled={mutationBusy ||
                value !== "open" ||
                row.hasChildren ||
                !epic.pinned}
              id={rowIds.get(epic.id)}
              data-epic={epic.id}
              class="group/row relative"
            >
              <!-- A long press opens the row's menu, so on a touch screen it does not also select the title. -->
              <div
                role="group"
                aria-label={epic.title}
                use:roomMenuTrigger={openMenu(epic.id)}
                class={cn(
                  "flex items-center rounded-lg transition-colors duration-150 pointer-coarse:select-none [-webkit-touch-callout:none] hover:bg-sidebar-accent",
                  (current || menu?.id === epic.id) &&
                    "bg-sidebar-accent text-sidebar-accent-foreground",
                )}
              >
                <!-- Hover: the full title, whose it is, and how much of it is done (Gimenes #4156). Not while the row's menu is open. -->
                <Tooltip disabled={menu?.id === epic.id}>
                  <TooltipTrigger>
                    {#snippet child({ props })}
                      <Button
                        {...props}
                        variant="ghost"
                        class={cn(
                          "relative h-10 min-w-0 flex-1 justify-start gap-2.5 rounded-lg px-2.5 text-left font-normal hover:bg-transparent",
                          phone.current && "h-18 gap-3 px-2 py-1",
                          current && "font-medium",
                          fresh && "font-semibold",
                          // Done: finished work reads quieter, and comes back on hover or when open.
                          value === "done" &&
                            !current &&
                            !fresh &&
                            "text-muted-foreground group-hover/row:text-sidebar-foreground",
                        )}
                        data-epic-thread={epic.id}
                        data-epic-unread={fresh ? "" : undefined}
                        aria-keyshortcuts={value === "open" && epic.pinned
                          ? "Shift+F10 Alt+ArrowUp Alt+ArrowDown"
                          : "Shift+F10"}
                        onkeydown={(event) => {
                          if (value !== "open" || !event.altKey || !epic.pinned)
                            return;
                          if (
                            event.key === "ArrowUp" ||
                            event.key === "ArrowDown"
                          ) {
                            event.preventDefault();
                            move(epic.id, event.key === "ArrowUp" ? -1 : 1);
                          }
                        }}
                        aria-current={current ? "page" : undefined}
                        onclick={() => {
                          if (onBeforeOpen && !onBeforeOpen()) return;
                          onopen(epic.id);
                        }}
                      >
                        <PersonAvatar
                          email={epic.owner}
                          version={epic.owner
                            ? vb.avatarVersion(epic.owner)
                            : undefined}
                          class={cn(
                            phone.current ? "size-14" : "size-6",
                            value === "done" &&
                              !current &&
                              !fresh &&
                              "opacity-60 group-hover/row:opacity-100",
                          )}
                        />
                        <span
                          class={phone.current
                            ? "flex min-w-0 flex-1 flex-col"
                            : "contents"}
                          ><span
                            class={cn(
                              "min-w-0 flex-1 truncate",
                              phone.current && "flex-none text-lg leading-6",
                            )}
                            data-epic-title
                            >{epic.title}{#if epic.done && value !== "done"}<span
                                class="ml-1 text-xs text-muted-foreground"
                                >({vb.t("Feito")})</span
                              >{/if}</span
                          >{#if phone.current}<span
                              data-epic-preview
                              class="line-clamp-2 min-h-10 text-base leading-5 break-words whitespace-normal text-muted-foreground"
                              >{rowPreview(epic)}</span
                            >{/if}</span
                        >
                        {#if epic.pinned && value !== "done"}<span
                            role="img"
                            data-epic-pinned
                            aria-label={vb.t("Fixado")}
                            class="flex shrink-0 text-muted-foreground"
                            ><Icon icon="pin-02" class="size-3.5" /></span
                          >{/if}
                        <!-- No ✻ for an agent at work (Gimenes #4368): its ack moves the thread to Fazendo, and the status icon says it. -->
                        <!-- One slot at the end (Gimenes #3904): the lime count when something waits on you, else the status (shared/epicStatus.ts; an epic in production shows Feito). -->
                        {#if waitCount(vb.waitsIn(epic.id))}<WaitBadge
                            waits={vb.waitsIn(epic.id)}
                            label={(n) =>
                              vb.t("{n} coisas esperando você", { n })}
                          />{:else}<span
                            role="img"
                            data-epic-status-icon={status}
                            aria-label={vb.t(epicStatusLook(status).label)}
                            class={cn(
                              "flex shrink-0",
                              epicStatusLook(status).text,
                            )}
                            ><Icon
                              icon={epicStatusLook(status).icon}
                              class="size-3.5"
                            /></span
                          >{/if}
                        <!-- Task progress as a bar under the title: gray at 0 done, green fill from the first done task. -->
                        {#if epic.tasks.length && !phone.current}<Progress
                            data-epic-progress={`${epic.tasks.filter((task) => task.done).length}/${epic.tasks.length}`}
                            aria-label={vb.t("{done} de {total} tarefas", {
                              done: epic.tasks.filter((task) => task.done)
                                .length,
                              total: epic.tasks.length,
                            })}
                            value={(100 *
                              epic.tasks.filter((task) => task.done).length) /
                              epic.tasks.length}
                            tone="success"
                            class={EPIC_PROGRESS}
                          />{/if}
                      </Button>
                    {/snippet}
                  </TooltipTrigger>
                  <TooltipContent side="right" class="max-w-64">
                    <span class="block font-medium" data-epic-tooltip-title
                      >{epic.owner
                        ? `${epic.title} · ${vb.name(epic.owner)}`
                        : epic.title}</span
                    >{#if epic.tasks.length}<span
                        class="block"
                        data-epic-tooltip-tasks
                        >{vb.t("{done} de {total} tarefas feitas", {
                          done: epic.tasks.filter((task) => task.done).length,
                          total: epic.tasks.length,
                        })}</span
                      >{/if}
                  </TooltipContent>
                </Tooltip>
              </div>
            </SortableItem>
          {/each}
        </SortableList>
      </ul>
      {#if !rows.length && !(value === "open" && room.suggestions.length)}<div
          data-epics-empty={value}
        >
          <EmptyState {...view.empty} />
        </div>{/if}
      {#if value === "open" && room.suggestions.length}
        <div
          role="group"
          aria-label={vb.t("Sugestões do @vibe")}
          data-epic-plan
          class="mt-1 flex shrink-0 flex-col gap-1"
        >
          {#each room.suggestions as suggestion, index}
            <Button
              variant="ghost"
              class="h-10 w-full justify-start gap-2.5 rounded-lg px-2.5 text-left font-normal text-sidebar-foreground hover:bg-sidebar-accent aria-[current=page]:bg-sidebar-accent aria-[current=page]:font-medium"
              aria-current={thread === `pre:${index}` ? "page" : undefined}
              title={`${suggestion.title} · ${vb.t("sugestão do @vibe, clique para ver")}`}
              data-suggestion={index}
              onclick={() => {
                if (onBeforeOpen && !onBeforeOpen()) return;
                onopen(`pre:${index}`);
              }}
              ><span
                aria-hidden="true"
                class="w-5 shrink-0 text-center text-muted-foreground">✦</span
              ><span class="min-w-0 flex-1 truncate">{suggestion.title}</span
              >{#if suggestion.tasks.length}<span
                  class="shrink-0 text-xs text-muted-foreground tabular-nums"
                  >0/{suggestion.tasks.length}</span
                >{/if}<span class="sr-only">{vb.t("sugestão do @vibe")}</span
              ></Button
            >
          {/each}
        </div>
      {/if}
      {#if hiddenCount}<button
          type="button"
          data-epics-more
          aria-expanded={showAll}
          onclick={() => (showAll = !showAll)}
          class="mt-0.5 flex h-8 w-full shrink-0 cursor-pointer items-center gap-2 rounded-lg border-0 bg-transparent px-2 text-left font-sans text-sm text-muted-foreground transition-colors duration-150 hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring"
        >
          <span class="flex size-5 shrink-0 items-center justify-center"
            ><Icon
              icon="chevron-down"
              size={16}
              class={cn(
                "transition-transform duration-150 motion-reduce:transition-none",
                showAll && "rotate-180",
              )}
            /></span
          ><span class="min-w-0 truncate"
            >{showAll
              ? vb.t("Ver menos")
              : vb.t("Ver mais ({n})", { n: hiddenCount })}</span
          >
        </button>{/if}
      <!-- No "Nova thread" here (Gimenes #4286): one way to start a thread, "Criar thread" on a message. -->
    {/if}
  {/snippet}
  <Tabs
    value={mode}
    onValueChange={switchMode}
    class="gap-2 max-md:min-h-0 max-md:flex-1"
  >
    <TabsList aria-label={vb.t("Threads")} class="h-8 w-full shrink-0">
      {#each views as view (view.value)}<TabsTrigger
          value={view.value}
          data-threads-tab={view.value}
          class="h-6 flex-1 text-xs">{view.label}</TabsTrigger
        >{/each}
    </TabsList>
    {#each views as view (view.value)}<TabsContent
        value={view.value}
        class="flex h-auto flex-col max-md:min-h-0 max-md:overflow-y-auto max-md:overscroll-contain"
        >{@render panel(view)}</TabsContent
      >{/each}
  </Tabs>
  {#key menu}{#if menu && menuEpic}{@const target = menuEpic}<ThreadMenu
        epic={target}
        point={menu.point}
        busy={mutationBusy}
        t={vb.t}
        onclose={closeMenu}
        oncopy={() => void copyThreadLink(target.id)}
        onstatus={() => void toggleDone(target)}
      />{/if}{/key}
  <p role="status" aria-live="polite" class="sr-only">{announcement}</p>
  {#if error}<p role="alert" class="m-0 text-sm text-destructive">
      {error}
    </p>{/if}
</section>
