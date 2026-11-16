<script lang="ts">
  import { get } from "svelte/store";
  import { onDestroy, tick, untrack } from "svelte";
  import type { Room, Epic } from "../../../shared/room";
  import type { RoomMutations } from "../room-sidebar/session";
  import Button from "../../lib/ui/Button.svelte";
  import IconButton from "../../lib/ui/IconButton.svelte";
  import Avatar from "../../lib/ui/Avatar.svelte";
  import Icon from "../../lib/ui/Icon.svelte";
  import WaitBadge from "../waits/WaitBadge.svelte";
  import type { WaitReference } from "../waits/model";
  import Input from "../../lib/ui/Input.svelte";
  import Label from "../../lib/ui/Label.svelte";
  import Tabs from "../../lib/ui/Tabs.svelte";
  import SectionHeader from "../room-sidebar/SectionHeader.svelte";
  import { cn } from "../../lib/ui/utils";
  import { productionStatuses } from "../chat/production";
  import {
    archivedEpics,
    activeEpics,
    epicForest,
    reorderEpics,
    visibleEpics,
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
  let plusButton: HTMLButtonElement | null = $state(null);
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
  const active = $derived(activeEpics(orderedEpics, thread));
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
  const rows = $derived(
    visibleEpics(forest, $navigation.closed, workingEpics, true),
  );
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
  /** The field shows while asked for, and while a typed title is kept. */
  const creating = $derived(
    mode === "active" && ($navigation.creating || $navigation.draft !== ""),
  );
  const openCount = $derived(active.filter((epic) => !epic.archived).length);
  const suggestionsOpen = $derived(
    mode === "active" && room.suggestions.length > 0 && $navigation.suggestions,
  );
  $effect(() => {
    // A suggestion opened from elsewhere (a link, Back) keeps its row in view.
    if (thread.startsWith("pre:") && !untrack(() => $navigation.suggestions))
      navigation.update((state) => ({ ...state, suggestions: true }));
  });
  async function toggleCreate() {
    if (disposed) return;
    if (creating) return closeCreate(true);
    if (mode === "archived") switchMode("active");
    navigation.update((state) => ({ ...state, creating: true }));
    await tick();
    if (!disposed) input?.focus();
  }
  function closeCreate(refocus: boolean) {
    if (disposed) return;
    navigation.update((state) => ({ ...state, creating: false, draft: "" }));
    if (refocus)
      void tick().then(() => {
        if (!disposed) plusButton?.focus();
      });
  }
  function toggleSuggestions() {
    if (disposed) return;
    if (mode === "archived") switchMode("active");
    navigation.update((state) => ({
      ...state,
      suggestions: !suggestionsOpen,
    }));
  }
  function siblings(id: string) {
    const parent = forest.parents.get(id);
    return parent ? (forest.children.get(parent) ?? []) : forest.roots;
  }
  function adjacent(id: string, direction: -1 | 1) {
    const peers = siblings(id);
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
</script>

{#snippet actions()}{#if room.suggestions.length}<Button
      variant={suggestionsOpen ? "secondary" : "ghost"}
      class="tw:h-7 tw:min-h-0 tw:gap-1 tw:px-2 tw:py-0 tw:text-xs tw:font-medium"
      aria-expanded={suggestionsOpen}
      aria-controls={suggestionsOpen ? `${uid}-suggestions` : undefined}
      aria-label={vb.t("{n} sugestões do @vibe", {
        n: room.suggestions.length,
      })}
      title={vb.t("{n} sugestões do @vibe", { n: room.suggestions.length })}
      data-epic-suggestions
      onclick={toggleSuggestions}
      ><span aria-hidden="true">✦</span>{room.suggestions.length}</Button
    >{/if}<IconButton
    bind:ref={plusButton}
    icon="plus"
    label={vb.t("Novo épico")}
    tip="bottom"
    class="tw:size-7 tw:p-1.5"
    aria-expanded={creating}
    data-new-epic
    onclick={toggleCreate}
  />{/snippet}
<section
  data-vb-native
  aria-label={vb.t("Épicos")}
  class="tw:m-0 tw:box-border tw:flex tw:min-h-0 tw:flex-1 tw:flex-col tw:gap-1 tw:p-0 tw:font-sans tw:text-sm tw:leading-5 tw:text-sidebar-foreground"
>
  {#snippet panel(value: string)}
    {#if value === mode}
      {#if value === "active" && creating}
        <form
          id="newEpic"
          onsubmit={add}
          onfocusout={(event) => {
            const next = event.relatedTarget;
            if (
              next instanceof Node &&
              (event.currentTarget.contains(next) || plusButton?.contains(next))
            )
              return;
            if (!$navigation.draft.trim()) closeCreate(false);
          }}
          class="tw:flex tw:shrink-0 tw:gap-1"
        >
          <Label for={`${uid}-new`} class="tw:sr-only"
            >{vb.t("Novo épico")}</Label
          >
          <Input
            id={`${uid}-new`}
            bind:ref={input}
            bind:value={
              () => (disposed ? "" : $navigation.draft),
              (value) => {
                if (!disposed) $navigation.draft = value;
              }
            }
            onkeydown={(event) => {
              if (event.key !== "Escape") return;
              event.preventDefault();
              closeCreate(true);
            }}
            placeholder={vb.t("Novo épico: escreva o título…")}
            enterkeyhint="done"
            class="tw:h-8"
          /><IconButton
            disabled={mutationBusy}
            type="submit"
            icon="check"
            variant="primary"
            class="tw:size-8 tw:p-1.5"
            label={vb.t("Criar épico")}
          />
        </form>
      {/if}
      {#if value === "active" && suggestionsOpen}
        <div
          id={`${uid}-suggestions`}
          role="group"
          aria-label={vb.t("Sugestões do @vibe")}
          class="tw:shrink-0 tw:space-y-0.5 tw:rounded-control tw:border tw:border-dashed tw:border-input tw:p-0.5"
        >
          {#each room.suggestions as suggestion, index}
            <Button
              variant="ghost"
              class={cn(
                "tw:h-8 tw:min-h-0 tw:w-full tw:justify-start tw:gap-2 tw:px-1.5 tw:py-0 tw:text-left tw:font-normal tw:text-muted-foreground",
                thread === `pre:${index}` &&
                  "tw:bg-sidebar-accent tw:font-medium tw:text-sidebar-accent-foreground",
              )}
              aria-current={thread === `pre:${index}` ? "page" : undefined}
              title={`${suggestion.title} · ${vb.t("sugestão do @vibe, clique para ver")}`}
              data-suggestion={index}
              onclick={() => {
                if (onBeforeOpen && !onBeforeOpen()) return;
                onopen(`pre:${index}`);
              }}
              ><span
                aria-hidden="true"
                class="tw:w-5 tw:shrink-0 tw:text-center">✦</span
              ><span class="tw:min-w-0 tw:flex-1 tw:truncate"
                >{suggestion.title}</span
              >{#if suggestion.tasks.length}<span class="tw:shrink-0 tw:text-xs"
                  >{suggestion.tasks.length}</span
                >{/if}<span class="tw:sr-only">{vb.t("sugestão do @vibe")}</span
              ></Button
            >
          {/each}
        </div>
      {/if}
      <ul
        aria-label={value === "archived" ? vb.t("Arquivados") : vb.t("Épicos")}
        class="tw:m-0 tw:min-h-0 tw:flex-1 tw:list-none tw:space-y-1 tw:overflow-x-hidden tw:overflow-y-auto tw:overscroll-contain tw:p-0"
      >
        {#each rows as row (row.epic.id)}
          {@const epic = row.epic}
          {@const working = vb.epicBusy(epic)}
          <li
            use:registerRow={epic.id}
            use:sorter.row={{
              id: epic.id,
              index: siblingIndex.get(epic.id) ?? 0,
              group: groupOf(epic.id),
              disabled:
                mutationBusy ||
                value !== "active" ||
                (row.hasChildren && !closed),
            }}
            id={rowIds.get(epic.id)}
            data-epic={epic.id}
            class="tw:relative"
          >
            <div
              role="group"
              aria-label={epic.title}
              class={cn(
                "tw:flex tw:items-center tw:gap-1 tw:rounded-control",
                !selectionDisabled &&
                  thread === epic.id &&
                  "tw:bg-sidebar-accent tw:text-sidebar-accent-foreground",
              )}
            >
              <Button
                variant="ghost"
                class={cn(
                  "tw:h-8 tw:min-h-0 tw:min-w-0 tw:flex-1 tw:justify-start tw:gap-2 tw:whitespace-nowrap tw:px-1.5 tw:py-0 tw:text-left tw:font-normal",
                  !selectionDisabled && thread === epic.id && "tw:font-medium",
                )}
                data-epic-thread={epic.id}
                title={epic.title}
                aria-keyshortcuts={value === "active"
                  ? "Alt+ArrowUp Alt+ArrowDown"
                  : undefined}
                onkeydown={(event) => {
                  if (value !== "active" || !event.altKey) return;
                  if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                    event.preventDefault();
                    move(epic.id, event.key === "ArrowUp" ? -1 : 1);
                  }
                }}
                aria-current={!selectionDisabled && thread === epic.id
                  ? "page"
                  : undefined}
                onclick={() => {
                  if (onBeforeOpen && !onBeforeOpen()) return;
                  onopen(epic.id);
                }}
              >
                <Avatar
                  name={epic.owner ? vb.name(epic.owner) : epic.title}
                  src={epic.owner && room.avatars?.[epic.owner]
                    ? `/api/avatar/${encodeURIComponent(epic.owner)}?v=${room.avatars[epic.owner]}`
                    : undefined}
                  seed={epic.owner || epic.title}
                  class="tw:size-5 tw:text-[10px]"
                />
                <span class="tw:min-w-0 tw:flex-1 tw:truncate" data-epic-title
                  >{epic.title}{#if epic.archived}<span
                      class="tw:ml-1 tw:text-xs">({vb.t("Arquivado")})</span
                    >{/if}</span
                >
                {#if working}<span
                    role="img"
                    aria-label={vb.t("{who} está trabalhando", {
                      who: working,
                    })}
                    class="tw:text-primary">✻</span
                  >{/if}
                <WaitBadge
                  waits={vb.waitsIn(epic.id)}
                  label={(n) => vb.t("{n} coisas esperando você", { n })}
                  taskLabel={vb.t("Tarefa sua pendente")}
                />
                {#if epic.prod}<span
                    title={vb.t(
                      production.get(epic.id) === "changes"
                        ? "Uma versão está no ar; você pediu correções depois"
                        : epic.prod.stage === "verified"
                          ? "Verificado em prod"
                          : "No ar, falta verificar em prod",
                    )}
                    >{production.get(epic.id) === "changes"
                      ? "🚀↻"
                      : epic.prod.stage === "verified"
                        ? "✓✓"
                        : "🚀"}</span
                  >{/if}
                {#if epic.tasks.length}<span
                    class={!selectionDisabled && thread === epic.id
                      ? "tw:shrink-0 tw:text-xs tw:text-sidebar-accent-foreground"
                      : "tw:shrink-0 tw:text-xs tw:text-muted-foreground"}
                    >{epic.tasks.filter((task) => task.done).length}/{epic.tasks
                      .length}</span
                  >{/if}
              </Button>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  {/snippet}
  {#if archived.length > 0}
    <Tabs
      compact
      class="tw:flex-1"
      items={[
        {
          value: "active",
          label: vb.t("Épicos"),
          count: active.filter((epic) => !epic.archived).length,
        },
        {
          value: "archived",
          label: vb.t("Arquivados"),
          count: archived.length,
        },
      ]}
      label={vb.t("Épicos")}
      value={mode}
      onValueChange={switchMode}
      {actions}
    >
      {#snippet children(value)}{@render panel(value)}{/snippet}
    </Tabs>
  {:else}
    <SectionHeader
      title={vb.t("Épicos")}
      count={openCount}
      sticky={false}
      action={actions}
    />
    {@render panel("active")}
  {/if}
  <p role="status" aria-live="polite" class="tw:sr-only">{announcement}</p>
  {#if error}<p role="alert" class="tw:m-0 tw:text-sm tw:text-destructive">
      {error}
    </p>{/if}
</section>
