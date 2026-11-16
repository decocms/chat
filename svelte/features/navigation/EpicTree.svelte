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
        draftOwner.update((value) => ({ ...value, draft: "" }));
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

<section
  data-vb-native
  aria-label={vb.t("Épicos")}
  class="tw:m-0 tw:box-border tw:space-y-1 tw:p-0 tw:font-sans tw:text-sm tw:leading-5 tw:text-sidebar-foreground"
>
  {#snippet panel(value: string)}
    {#if value === mode}
      <ul
        aria-label={value === "archived" ? vb.t("Arquivados") : vb.t("Épicos")}
        class={cn(
          "tw:m-0 tw:list-none tw:space-y-1 tw:p-0",
          value === "archived" &&
            "tw:max-h-[40vh] tw:overflow-y-auto tw:overscroll-contain",
        )}
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
                "tw:flex tw:items-center tw:gap-1 tw:rounded-control tw:border-l-2 tw:border-transparent",
                !selectionDisabled &&
                  thread === epic.id &&
                  "tw:border-l-primary tw:bg-sidebar-accent tw:text-sidebar-accent-foreground",
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
      {#if value === "active"}
        <form id="newEpic" onsubmit={add} class="tw:mt-2 tw:space-y-2">
          <Label for={`${uid}-new`} class="tw:sr-only"
            >{vb.t("Novo épico")}</Label
          >
          <div class="tw:flex tw:gap-2">
            <Input
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
            /><IconButton
              disabled={mutationBusy}
              type="submit"
              icon="plus"
              variant="primary"
              label={vb.t("Criar épico")}
            />
          </div>
        </form>
        {#each room.suggestions as suggestion, index}
          <Button
            variant="outline"
            class="tw:h-auto tw:w-full tw:justify-start tw:whitespace-normal tw:border-dashed tw:text-left"
            aria-current={thread === `pre:${index}` ? "page" : undefined}
            onclick={() => onopen(`pre:${index}`)}
            >{suggestion.title}<span class="tw:text-xs tw:text-muted-foreground"
              >{vb.t("sugestão do @vibe, clique para ver")}</span
            ></Button
          >
        {/each}
      {/if}
    {/if}
  {/snippet}
  {#if archived.length > 0}
    <Tabs
      compact
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
    >
      {#snippet children(value)}{@render panel(value)}{/snippet}
    </Tabs>
  {:else}
    {@render panel("active")}
  {/if}
  <p role="status" aria-live="polite" class="tw:sr-only">{announcement}</p>
  {#if error}<p role="alert" class="tw:m-0 tw:text-sm tw:text-destructive">
      {error}
    </p>{/if}
</section>
