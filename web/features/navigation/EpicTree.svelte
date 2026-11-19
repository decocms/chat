<script lang="ts">
  import { get } from "svelte/store";
  import { onDestroy, tick, untrack } from "svelte";
  import type { Room, Epic } from "../../../shared/room";
  import type { RoomMutations } from "../room-sidebar/session";
  import InlineAdd from "../../lib/components/InlineAdd.svelte";
  import PersonAvatar from "../../lib/components/PersonAvatar.svelte";
  import { studioType } from "../../lib/components/type";
  import Button from "../../lib/studio/Button.svelte";
  import DropdownMenu from "../../lib/studio/DropdownMenu.svelte";
  import DropdownMenuContent from "../../lib/studio/DropdownMenuContent.svelte";
  import DropdownMenuItem from "../../lib/studio/DropdownMenuItem.svelte";
  import DropdownMenuLabel from "../../lib/studio/DropdownMenuLabel.svelte";
  import DropdownMenuRadioGroup from "../../lib/studio/DropdownMenuRadioGroup.svelte";
  import DropdownMenuRadioItem from "../../lib/studio/DropdownMenuRadioItem.svelte";
  import DropdownMenuSeparator from "../../lib/studio/DropdownMenuSeparator.svelte";
  import DropdownMenuTrigger from "../../lib/studio/DropdownMenuTrigger.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import Label from "../../lib/studio/Label.svelte";
  import Tabs from "../../lib/studio/Tabs.svelte";
  import TabsContent from "../../lib/studio/TabsContent.svelte";
  import TabsList from "../../lib/studio/TabsList.svelte";
  import TabsTrigger from "../../lib/studio/TabsTrigger.svelte";
  import {
    ArrowDown,
    ArrowUp,
    CheckCircle,
    ChevronDown,
    DotsHorizontal,
    Pin02,
    Plus,
    RefreshCw01,
    Rocket01,
    Stars01,
  } from "../../lib/studio/icons";
  import { cn } from "../../lib/studio/utils";
  import WaitBadge from "../waits/WaitBadge.svelte";
  import type { WaitReference } from "../waits/model";
  import { productionStatuses } from "../chat/production";
  import {
    archivedEpics,
    activeEpics,
    epicForest,
    reorderEpics,
    sidebarEpics,
    visibleEpics,
    EPIC_PAGE,
  } from "./model";
  import {
    createSortableRows,
    ROOT_GROUP,
    type SortableMove,
  } from "./sortable";
  import { enterNavigationThread, type NavigationSession } from "./session";

  let {
    room,
    thread,
    session,
    mutations,
    onopen,
    onarchchange,
    selectionDisabled = false,
    onBeforeOpen,
    vb,
  }: {
    room: Room;
    thread: string;
    session: NavigationSession;
    mutations: RoomMutations;
    onopen: (id: string) => void;
    onarchchange: (archived: boolean) => void;
    selectionDisabled?: boolean;
    onBeforeOpen?: () => boolean;
    vb: {
      t: (text: string, vars?: Record<string, string | number>) => string;
      name: (email: string) => string;
      avatarVersion: (email: string) => number | null | undefined;
      epicBusy: (epic: Epic) => string | null;
      waitsIn: (thread: string) => readonly WaitReference[];
    };
  } = $props();
  const uid = $props.id();
  let navigation = $derived(session.state);
  const mutation = untrack(() => mutations.state);
  const mutationBusy = $derived(
    $mutation.phase === "pending" || $mutation.phase === "unconfirmed",
  );
  let error = $state("");
  /** The order just dropped, shown until the server confirms (or refuses) it. */
  let localOrder = $state<string[] | null>(null);
  let input: HTMLInputElement | null = $state(null);
  let newButton: HTMLButtonElement | null = $state(null);
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
  const sorter = createSortableRows((move) => sorted(move));
  onDestroy(() => {
    disposed = true;
    generation++;
    rowNodes.clear();
    sorter.destroy();
  });
  const orderedEpics = $derived.by(() => {
    const order = localOrder;
    if (!order) return room.epics;
    const position = new Map(order.map((id, index) => [id, index]));
    return [...room.epics].sort(
      (a, b) =>
        (position.get(a.id) ?? order.length) -
        (position.get(b.id) ?? order.length),
    );
  });
  const active = $derived(
    sidebarEpics(activeEpics(orderedEpics, thread), room.messages),
  );
  /** Past EPIC_PAGE unpinned epics the list stops at "Ver mais" (the open one always shows). */
  let showAll = $state(false);
  /** How many epics fit before the sidebar's foot with "Ver mais", "Novo épico" and the next section's title still
   *  above it, so the rest of the sidebar starts in view (3 to EPIC_PAGE; EPIC_PAGE without a foot, on phones). */
  let fit = $state(EPIC_PAGE);
  let list = $state<HTMLElement | null>(null);
  function measure() {
    const side = list?.closest("[data-native-room-sidebar]");
    const foot = side?.querySelector("[data-sidebar-self]");
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
      Math.max(3, Math.floor((bottom - top - 132) / pitch)),
    );
  }
  $effect(() => {
    const side = list?.closest("[data-native-room-sidebar]");
    if (!side) return;
    // After layout, and whenever the sidebar or its foot change size (window, a section growing above).
    const observer = new ResizeObserver(() => measure());
    observer.observe(side);
    for (const node of side.querySelectorAll(
      "[data-sidebar-self], [data-room-views]",
    ))
      observer.observe(node);
    return () => observer.disconnect();
  });
  const archived = $derived(archivedEpics(orderedEpics, room.messages));
  const production = $derived(productionStatuses(room));
  const mode = $derived(
    $navigation.archived && archived.length > 0 ? "archived" : "active",
  );
  /** The list is flat: sub-epics are plain rows, with no branches to open. */
  const flat = (list: readonly Epic[]) =>
    list.map((epic) => (epic.parent ? { ...epic, parent: undefined } : epic));
  const forest = $derived(
    epicForest(flat(mode === "archived" ? archived : active)),
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
  const groupOf = (id: string) => forest.parents.get(id) ?? ROOT_GROUP;
  const groupMembers = (group: string) =>
    group === ROOT_GROUP ? forest.roots : (forest.children.get(group) ?? []);
  const siblingIndex = $derived(
    new Map(
      [ROOT_GROUP, ...forest.children.keys()].flatMap((group) =>
        groupMembers(group).map((epic, index) => [epic.id, index] as const),
      ),
    ),
  );
  const rowIds = $derived(
    new Map(rows.map((row, index) => [row.epic.id, `${uid}-row-${index}`])),
  );
  $effect(() => {
    enterNavigationThread(session, entryForest, thread);
  });

  function switchMode(value: string) {
    if (disposed) return;
    generation++;
    requested = null;
    localOrder = null;
    const archived = value === "archived";
    navigation.update((state) => ({ ...state, archived }));
    onarchchange(archived);
    error = "";
  }
  async function submit(command: Parameters<RoomMutations["run"]>[0]) {
    if (disposed || mutationBusy || session.roomId !== room.id) return false;
    error = "";
    const success = await mutations.run(command);
    return success;
  }
  async function add(event: SubmitEvent) {
    event.preventDefault();
    if (disposed) return;
    const title = $navigation.draft.trim(),
      original = $navigation.draft,
      draftOwner = navigation;
    if (!title) return input?.focus();
    if (await submit({ t: "epic", title }))
      if (get(draftOwner).draft === original)
        draftOwner.update((value) => ({
          ...value,
          draft: "",
          creating: false,
        }));
  }
  /** The add row shows while asked for, and while a typed title is kept. */
  const creating = $derived(
    mode === "active" && ($navigation.creating || $navigation.draft !== ""),
  );
  const suggestionsOpen = $derived(
    mode === "active" && room.suggestions.length > 0 && $navigation.suggestions,
  );
  $effect(() => {
    // A suggestion opened from elsewhere (a link, Back) keeps its row in view.
    if (thread.startsWith("pre:") && !untrack(() => $navigation.suggestions))
      navigation.update((state) => ({ ...state, suggestions: true }));
  });
  function siblings(id: string) {
    const parent = forest.parents.get(id);
    return parent ? (forest.children.get(parent) ?? []) : forest.roots;
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
  function sorted(move: SortableMove) {
    if (disposed || mode !== "active") return;
    const target = groupMembers(move.group)[move.toIndex];
    if (target) void reorder(move.id, target.id, move.toIndex > move.fromIndex);
  }
  function registerRow(node: HTMLElement, id: string) {
    rowNodes.set(id, node);
    return {
      destroy() {
        if (rowNodes.get(id) === node) rowNodes.delete(id);
      },
    };
  }
  $effect(() => {
    const request = requested;
    if (!request) return;
    if (request.thread !== thread || mode !== "active") {
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
    announcement = vb.t("Ordem dos épicos atualizada.");
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
      const target =
        row?.querySelector<HTMLElement>("[data-epic-thread]") ?? input;
      target?.focus({ preventScroll: true });
    });
  }
  function move(id: string, direction: -1 | 1) {
    const target = adjacent(id, direction);
    if (mode === "active" && target) reorder(id, target.id, direction === 1);
  }
  async function openCreate() {
    if (disposed) return;
    navigation.update((state) => ({ ...state, creating: true }));
    await tick();
    if (!disposed) input?.focus();
  }
  function closeCreate(refocus: boolean) {
    if (disposed) return;
    navigation.update((state) => ({ ...state, creating: false, draft: "" }));
    if (refocus)
      void tick().then(() => {
        if (!disposed) newButton?.focus();
      });
  }
  function toggleSuggestions() {
    if (disposed) return;
    navigation.update((state) => ({
      ...state,
      suggestions: !suggestionsOpen,
    }));
  }
  const owners = $derived([
    { value: "", label: vb.t("Sem dono") },
    ...room.members.map((email) => ({ value: email, label: vb.name(email) })),
  ]);
  const dashedRow =
    "mt-0.5 flex h-9 w-full shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border bg-transparent px-2 text-left font-sans text-sm leading-5 text-muted-foreground transition-colors duration-150 hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:outline-solid";
  const views = $derived([
    { value: "active", label: vb.t("Épicos"), disabled: false },
    {
      value: "archived",
      label: vb.t("Arquivados"),
      disabled: archived.length === 0,
    },
  ]);
</script>

<section
  data-view="epics"
  aria-label={vb.t("Épicos")}
  class={cn(
    studioType,
    "m-0 box-border flex shrink-0 flex-col p-0 text-sm leading-5 text-sidebar-foreground",
  )}
>
  {#snippet panel(value: string)}
    {#if value === mode}
      <ul
        bind:this={list}
        aria-label={value === "archived" ? vb.t("Arquivados") : vb.t("Épicos")}
        class="m-0 flex list-none flex-col gap-0.5 p-0"
      >
        {#each rows as row (row.epic.id)}
          {@const epic = row.epic}
          {@const working = vb.epicBusy(epic)}
          {@const current = !selectionDisabled && thread === epic.id}
          <li
            use:registerRow={epic.id}
            use:sorter.row={{
              id: epic.id,
              index: siblingIndex.get(epic.id) ?? 0,
              group: groupOf(epic.id),
              disabled:
                mutationBusy ||
                value !== "active" ||
                row.hasChildren ||
                !epic.pinned,
            }}
            id={rowIds.get(epic.id)}
            data-epic={epic.id}
            class="group/row relative"
          >
            <div
              role="group"
              aria-label={epic.title}
              class={cn(
                "flex items-center rounded-lg transition-colors duration-150 hover:bg-sidebar-accent group-has-[[data-state=open]]/row:bg-sidebar-accent",
                current && "bg-sidebar-accent text-sidebar-accent-foreground",
              )}
            >
              <Button
                variant="ghost"
                class={cn(
                  "h-9 min-w-0 flex-1 justify-start gap-2 rounded-lg px-2 text-left font-normal transition-[padding] duration-150 ease-out hover:bg-transparent group-hover/row:pr-9 group-focus-within/row:pr-9 group-has-[[data-state=open]]/row:pr-9 motion-reduce:transition-none [@media(hover:none)]:pr-9",
                  current && "font-medium",
                )}
                data-epic-thread={epic.id}
                title={epic.owner
                  ? `${epic.title} · ${vb.name(epic.owner)}`
                  : epic.title}
                aria-keyshortcuts={value === "active" && epic.pinned
                  ? "Alt+ArrowUp Alt+ArrowDown"
                  : undefined}
                onkeydown={(event) => {
                  if (value !== "active" || !event.altKey || !epic.pinned)
                    return;
                  if (event.key === "ArrowUp" || event.key === "ArrowDown") {
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
                  class="size-5"
                />
                <span class="min-w-0 flex-1 truncate" data-epic-title
                  >{epic.title}{#if epic.archived}<span
                      class="ml-1 text-xs text-muted-foreground"
                      >({vb.t("Arquivado")})</span
                    >{/if}</span
                >
                {#if epic.pinned && value === "active"}<span
                    role="img"
                    data-epic-pinned
                    aria-label={vb.t("Fixado")}
                    class="flex shrink-0 text-muted-foreground"
                    ><Icon icon={Pin02} class="size-3.5" /></span
                  >{/if}
                {#if working}<span
                    role="img"
                    aria-label={vb.t("{who} está trabalhando", {
                      who: working,
                    })}
                    class="shrink-0 text-xs text-muted-foreground">✻</span
                  >{/if}
                <WaitBadge
                  waits={vb.waitsIn(epic.id)}
                  label={(n) => vb.t("{n} coisas esperando você", { n })}
                  taskLabel={vb.t("Tarefa sua pendente")}
                />
                {#if epic.prod}{@const changes =
                    production.get(epic.id) === "changes"}<span
                    role="img"
                    data-epic-prod={changes ? "changes" : epic.prod.stage}
                    aria-label={vb.t(
                      changes
                        ? "Uma versão está no ar; você pediu correções depois"
                        : epic.prod.stage === "verified"
                          ? "Verificado em prod"
                          : "No ar, falta verificar em prod",
                    )}
                    title={vb.t(
                      changes
                        ? "Uma versão está no ar; você pediu correções depois"
                        : epic.prod.stage === "verified"
                          ? "Verificado em prod"
                          : "No ar, falta verificar em prod",
                    )}
                    class="flex shrink-0 text-muted-foreground"
                    ><Icon
                      icon={changes
                        ? RefreshCw01
                        : epic.prod.stage === "verified"
                          ? CheckCircle
                          : Rocket01}
                      class="size-3.5"
                    /></span
                  >{/if}
                {#if epic.tasks.length}<span
                    class="shrink-0 text-xs font-normal tabular-nums text-muted-foreground"
                    >{epic.tasks.filter((task) => task.done).length}/{epic.tasks
                      .length}</span
                  >{/if}
              </Button>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger
                data-epic-actions={epic.id}
                aria-label={`${vb.t("Ações do épico")}: ${epic.title}`}
                class="absolute top-1.5 right-1.5 flex size-6 translate-x-1 scale-90 items-center justify-center rounded-full border-0 bg-transparent p-0 text-muted-foreground opacity-0 transition-[opacity,translate,scale] duration-150 ease-out hover:bg-background/60 hover:text-sidebar-foreground focus-visible:translate-x-0 focus-visible:scale-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring group-hover/row:translate-x-0 group-hover/row:scale-100 group-hover/row:opacity-100 data-[state=open]:translate-x-0 data-[state=open]:scale-100 data-[state=open]:opacity-100 motion-reduce:transition-none [@media(hover:none)]:translate-x-0 [@media(hover:none)]:scale-100 [@media(hover:none)]:opacity-100"
                ><Icon
                  icon={DotsHorizontal}
                  class="size-4"
                /></DropdownMenuTrigger
              >
              <DropdownMenuContent align="end" class={cn(studioType, "w-56")}>
                {#if value === "active"}
                  <DropdownMenuItem
                    data-epic-pin={epic.id}
                    disabled={mutationBusy}
                    onSelect={() =>
                      void submit({
                        t: "epic.pin",
                        id: epic.id,
                        pinned: !epic.pinned,
                      })}
                    ><Icon icon={Pin02} />{vb.t(
                      epic.pinned ? "Desafixar" : "Fixar no topo",
                    )}</DropdownMenuItem
                  >
                {/if}
                {#if value === "active" && epic.pinned}
                  <DropdownMenuItem
                    disabled={mutationBusy || !adjacent(epic.id, -1)}
                    onSelect={() => move(epic.id, -1)}
                    ><Icon icon={ArrowUp} />{vb.t(
                      "Mover para cima",
                    )}</DropdownMenuItem
                  >
                  <DropdownMenuItem
                    disabled={mutationBusy || !adjacent(epic.id, 1)}
                    onSelect={() => move(epic.id, 1)}
                    ><Icon icon={ArrowDown} />{vb.t(
                      "Mover para baixo",
                    )}</DropdownMenuItem
                  >
                {/if}
                {#if value === "active"}<DropdownMenuSeparator />{/if}
                <DropdownMenuLabel class="text-xs text-muted-foreground"
                  >{vb.t("Dono do épico")}</DropdownMenuLabel
                >
                <DropdownMenuRadioGroup
                  bind:value={
                    () => epic.owner ?? "",
                    (owner) => {
                      if (owner !== (epic.owner ?? ""))
                        void submit({ t: "epic.owner", id: epic.id, owner });
                    }
                  }
                >
                  {#each owners as owner (owner.value)}<DropdownMenuRadioItem
                      value={owner.value}
                      disabled={mutationBusy}
                      ><span class="min-w-0 truncate">{owner.label}</span
                      ></DropdownMenuRadioItem
                    >{/each}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        {/each}
      </ul>
      {#if hiddenCount}<button
          type="button"
          data-epics-more
          aria-expanded={showAll}
          onclick={() => (showAll = !showAll)}
          class="mt-0.5 flex h-8 w-full shrink-0 cursor-pointer items-center gap-2 rounded-lg border-0 bg-transparent px-2 text-left font-sans text-sm text-muted-foreground transition-colors duration-150 hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring"
        >
          <span class="flex size-5 shrink-0 items-center justify-center"
            ><Icon
              icon={ChevronDown}
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
      {#if value === "active"}
        {#if creating}
          <form
            id="newEpic"
            class="mt-0.5 shrink-0"
            onsubmit={add}
            onfocusout={(event) => {
              const next = event.relatedTarget;
              if (next instanceof Node && event.currentTarget.contains(next))
                return;
              if (!$navigation.draft.trim()) closeCreate(false);
            }}
          >
            <Label for={`${uid}-new`} class="sr-only"
              >{vb.t("Novo épico")}</Label
            >
            <InlineAdd
              id={`${uid}-new`}
              bind:ref={input}
              bind:value={
                () => (disposed ? "" : $navigation.draft),
                (value) => {
                  if (!disposed) $navigation.draft = value;
                }
              }
              placeholder={vb.t("Novo épico: escreva o título…")}
              enterkeyhint="done"
              confirmDisabled={mutationBusy}
              confirmLabel={vb.t("Criar épico")}
              cancelLabel={vb.t("Cancelar")}
              oncancel={() => closeCreate(true)}
            />
          </form>
        {:else}
          <button
            type="button"
            bind:this={newButton}
            data-new-epic
            aria-expanded="false"
            onclick={openCreate}
            class={dashedRow}
          >
            <span class="flex size-5 shrink-0 items-center justify-center"
              ><Icon icon={Plus} size={16} /></span
            >
            <span class="min-w-0 truncate">{vb.t("Novo épico")}</span>
          </button>
        {/if}
        {#if room.suggestions.length}
          <button
            type="button"
            data-epic-suggestions
            aria-expanded={suggestionsOpen}
            aria-controls={suggestionsOpen ? `${uid}-suggestions` : undefined}
            onclick={toggleSuggestions}
            class={cn(dashedRow, suggestionsOpen && "text-sidebar-foreground")}
          >
            <span class="flex size-5 shrink-0 items-center justify-center"
              ><Icon icon={Stars01} size={16} /></span
            >
            <span class="min-w-0 flex-1 truncate"
              >{vb.t("{n} sugestões do @vibe", {
                n: room.suggestions.length,
              })}</span
            >
            <Icon
              icon={ChevronDown}
              size={16}
              class={cn(
                "shrink-0 transition-transform duration-150 motion-reduce:transition-none",
                suggestionsOpen && "rotate-180",
              )}
            />
          </button>
          {#if suggestionsOpen}
            <div
              id={`${uid}-suggestions`}
              role="group"
              aria-label={vb.t("Sugestões do @vibe")}
              class="mt-0.5 flex shrink-0 flex-col gap-0.5"
            >
              {#each room.suggestions as suggestion, index}
                <Button
                  variant="ghost"
                  class="h-9 w-full justify-start gap-2 rounded-lg px-2 text-left font-normal text-muted-foreground hover:bg-sidebar-accent aria-[current=page]:bg-sidebar-accent aria-[current=page]:font-medium aria-[current=page]:text-sidebar-foreground"
                  aria-current={thread === `pre:${index}` ? "page" : undefined}
                  title={`${suggestion.title} · ${vb.t("sugestão do @vibe, clique para ver")}`}
                  data-suggestion={index}
                  onclick={() => {
                    if (onBeforeOpen && !onBeforeOpen()) return;
                    onopen(`pre:${index}`);
                  }}
                  ><span aria-hidden="true" class="w-5 shrink-0 text-center"
                    >✦</span
                  ><span class="min-w-0 flex-1 truncate"
                    >{suggestion.title}</span
                  >{#if suggestion.tasks.length}<span
                      class="shrink-0 text-xs tabular-nums"
                      >{suggestion.tasks.length}</span
                    >{/if}<span class="sr-only"
                    >{vb.t("sugestão do @vibe")}</span
                  ></Button
                >
              {/each}
            </div>
          {/if}
        {/if}
      {/if}
    {/if}
  {/snippet}
  <Tabs value={mode} onValueChange={switchMode} class="gap-2">
    <TabsList aria-label={vb.t("Épicos")} class="h-8 w-full shrink-0">
      {#each views as view (view.value)}<TabsTrigger
          value={view.value}
          disabled={view.disabled}
          class="h-6 flex-1 text-xs">{view.label}</TabsTrigger
        >{/each}
    </TabsList>
    {#each views as view (view.value)}<TabsContent
        value={view.value}
        class="flex h-auto flex-col">{@render panel(view.value)}</TabsContent
      >{/each}
  </Tabs>
  <p role="status" aria-live="polite" class="sr-only">{announcement}</p>
  {#if error}<p role="alert" class="m-0 text-sm text-destructive">
      {error}
    </p>{/if}
</section>
