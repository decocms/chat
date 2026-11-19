<script lang="ts">
  import PersonAvatar from "../../lib/components/PersonAvatar.svelte";
  import { onDestroy, tick, untrack } from "svelte";
  import type { PanelProps } from "../../app/panels";
  import type { RoomCommand } from "../../../shared/commands";
  import type { TaskStatus } from "../../../shared/room";
  import {
    adjacentStatus,
    boardModel,
    isTaskStatus,
    lanes,
    readBoardMode,
    type AddTarget,
    type BoardTask,
  } from "./model";
  import Badge from "../../lib/studio/Badge.svelte";
  import Button from "../../lib/studio/Button.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import Input from "../../lib/studio/Input.svelte";
  import Label from "../../lib/studio/Label.svelte";
  import Select from "../../lib/studio/Select.svelte";
  import SelectContent from "../../lib/studio/SelectContent.svelte";
  import SelectItem from "../../lib/studio/SelectItem.svelte";
  import SelectTrigger from "../../lib/studio/SelectTrigger.svelte";
  import SelectValue from "../../lib/studio/SelectValue.svelte";
  import Tabs from "../../lib/studio/Tabs.svelte";
  import TabsContent from "../../lib/studio/TabsContent.svelte";
  import TabsList from "../../lib/studio/TabsList.svelte";
  import TabsTrigger from "../../lib/studio/TabsTrigger.svelte";
  import EmptyState from "../../lib/components/EmptyState.svelte";
  import ErrorState from "../../lib/components/ErrorState.svelte";
  import { cn } from "../../lib/studio/utils";

  let {
    room,
    thread,
    send,
    onopen,
    vb,
  }: Pick<PanelProps, "room" | "thread" | "send" | "onopen"> & {
    vb: Pick<PanelProps["vb"], "t" | "name" | "avatarVersion">;
  } = $props();
  const uid = $props.id();
  const model = $derived(boardModel(room, thread));
  let mode = $state(readBoardMode());
  let title = $state("");
  let addInput = $state<HTMLInputElement | null>(null);
  let error = $state("");
  let announcement = $state("");
  let over = $state<TaskStatus | null>(null);
  let dragging = $state<string | null>(null);
  let selectedTarget = $state<AddTarget>(
    untrack(() => {
      const initial =
        model.targets.find((target) => target.id === model.scope) ??
        model.targets.find((target) => target.id !== "main") ??
        model.targets[0];
      return initial ?? { id: thread, title: thread };
    }),
  );
  const targetValid = $derived(
    model.targets.some((target) => target.id === selectedTarget.id),
  );
  const targetItems = $derived<
    { value: string; label: string; disabled?: boolean }[]
  >([
    ...(!targetValid
      ? [
          {
            value: selectedTarget.id,
            label: selectedTarget.title,
            disabled: true,
          },
        ]
      : []),
    ...model.targets.map((target) => ({
      value: target.id,
      label: target.title,
    })),
  ]);
  const options = $derived(
    lanes.map((lane) => ({ value: lane.value, label: vb.t(lane.label) })),
  );
  const views = $derived([
    { value: "board", label: vb.t("Quadro") },
    { value: "list", label: vb.t("Lista") },
  ]);
  const openGroups = $derived(
    model.groups
      .map((group) => ({
        ...group,
        tasks: group.tasks.filter((task) => task.status !== "done"),
      }))
      .filter((group) => group.tasks.length),
  );
  const mine = $derived(
    model.tasks.filter(
      (task) => task.owner === room.me && task.status !== "done",
    ),
  );
  const statusTrigger = "[data-slot=select-trigger]";
  const cards = new Map<string, HTMLElement>();
  let generation = 0;
  let disposed = false;
  type MoveRequest = {
    id: string;
    status: TaskStatus;
    generation: number;
    focus?: { key: string; node: HTMLElement; selector: string };
  };
  let requested = $state<MoveRequest | null>(null);
  onDestroy(() => {
    disposed = true;
    generation++;
    cards.clear();
  });

  function registerCard(node: HTMLElement, key: string) {
    cards.set(key, node);
    return {
      destroy() {
        if (cards.get(key) === node) cards.delete(key);
      },
    };
  }
  function dispatch(command: RoomCommand) {
    try {
      if (send(command)) {
        error = "";
        return true;
      }
    } catch {
      /* Keep drafts and controls when a socket closes during send. */
    }
    error = vb.t("Não deu pra enviar agora. Tente de novo.");
    return false;
  }
  function move(task: BoardTask, status: TaskStatus, key: string) {
    if (task.status === status) return true;
    const active = document.activeElement;
    const focused =
      active instanceof HTMLElement && cards.get(key)?.contains(active)
        ? active
        : null;
    if (!dispatch({ t: "task.status", id: task.id, status })) return false;
    requested = {
      id: task.id,
      status,
      generation: ++generation,
      ...(focused
        ? {
            focus: {
              key,
              node: focused,
              selector: focused.matches(statusTrigger)
                ? statusTrigger
                : "[data-board-open]",
            },
          }
        : {}),
    };
    return true;
  }
  $effect(() => {
    const request = requested;
    if (!request) return;
    const current = [
      ...(room.roomTasks ?? []),
      ...room.epics.flatMap((epic) => epic.tasks),
    ].find((task) => task.id === request.id);
    if (!current) {
      requested = null;
      restoreFocus(request);
      return;
    }
    if (current.status !== request.status) return;
    requested = null;
    announcement = `${current.title}: ${vb.t(lanes.find((lane) => lane.value === current.status)?.label ?? current.status)}`;
    restoreFocus(request);
  });
  function restoreFocus(request: MoveRequest) {
    const focus = request.focus;
    if (
      !focus ||
      (document.activeElement !== focus.node &&
        document.activeElement !== document.body)
    )
      return;
    void tick().then(() => {
      if (
        disposed ||
        request.generation !== generation ||
        (document.activeElement !== focus.node &&
          document.activeElement !== document.body)
      )
        return;
      const replacement =
        cards.get(focus.key)?.querySelector<HTMLElement>(focus.selector) ??
        addInput;
      replacement?.focus({ preventScroll: true });
      replacement?.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
  }
  function changeMode(value: string) {
    if (value !== "board" && value !== "list") return;
    mode = value;
    generation++;
    requested = null;
    try {
      localStorage.setItem("vb.boardMode", value);
    } catch {
      /* Preference is optional. */
    }
  }
  function keyboard(event: KeyboardEvent, task: BoardTask, key: string) {
    const next =
      event.key === "ArrowRight"
        ? adjacentStatus(task.status, 1)
        : event.key === "ArrowLeft"
          ? adjacentStatus(task.status, -1)
          : undefined;
    if (!next) return;
    event.preventDefault();
    move(task, next, key);
  }
  function drop(event: DragEvent, status: TaskStatus) {
    event.preventDefault();
    over = null;
    const id = event.dataTransfer?.getData("application/x-vibebook-task");
    const task = model.tasks.find((candidate) => candidate.id === id);
    dragging = null;
    if (task) move(task, status, `board:${task.id}`);
  }
  function add(event: SubmitEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    if (!targetValid) {
      error = vb.t("Escolha um épico.");
      return;
    }
    if (
      dispatch({ t: "task.add", epic: selectedTarget.id, title: title.trim() })
    )
      title = "";
  }
</script>

<section
  data-board-scope={model.scope ?? "all"}
  aria-label={vb.t("Quadro de tarefas")}
  class="m-0 box-border flex min-h-0 min-w-0 flex-1 flex-col gap-3 rounded-surface bg-background p-3 font-sans text-sm text-foreground"
>
  <p class="m-0 text-xs text-muted-foreground">
    {model.title ??
      (model.scope ? selectedTarget.title : vb.t("Todos os épicos"))}
  </p>
  {#if model.missingScope || !targetValid || error}<ErrorState
      title={model.missingScope
        ? vb.t("Épico não encontrado.")
        : !targetValid
          ? vb.t("Escolha um épico.")
          : error}
      compact
    />{/if}
  <p role="status" aria-live="polite" class="sr-only">{announcement}</p>
  <p id={`${uid}-keys`} class="sr-only">
    {vb.t("Arraste, ou use ← →. Clique pra abrir o épico.")}
  </p>
  <Tabs
    class="min-h-0 flex-1 overflow-hidden"
    value={mode}
    onValueChange={changeMode}
  >
    <TabsList aria-label={vb.t("Quadro de tarefas")}>
      {#each views as view (view.value)}<TabsTrigger value={view.value}
          >{view.label}</TabsTrigger
        >{/each}
    </TabsList>
    {#each views as view (view.value)}<TabsContent
        value={view.value}
        class="min-h-0">{@render panel(view.value)}</TabsContent
      >{/each}
  </Tabs>
  {#snippet panel(value: string)}
    {#if value === mode}
      {#if value === "board"}
        <div class="h-full min-h-0 min-w-0 overflow-auto pb-2">
          <div class="grid grid-cols-[repeat(4,minmax(15rem,1fr))] gap-3">
            {#each lanes as lane (lane.value)}
              {@const tasks = model.tasks.filter(
                (task) => task.status === lane.value,
              )}
              <section
                data-lane={lane.value}
                aria-label={vb.t(lane.label)}
                ondragover={(event) => {
                  if (
                    event.dataTransfer?.types.includes(
                      "application/x-vibebook-task",
                    )
                  ) {
                    event.preventDefault();
                    over = lane.value;
                  }
                }}
                ondragleave={() => {
                  over = null;
                }}
                ondrop={(event) => drop(event, lane.value)}
                class={cn(
                  "min-w-0 space-y-3 rounded-surface border border-border bg-muted/40 p-3",
                  over === lane.value && "ring-2 ring-ring",
                )}
              >
                <h3
                  class="m-0 flex items-center justify-between gap-2 font-sans text-sm font-semibold leading-5 tracking-normal"
                >
                  {vb.t(lane.label)}<Badge>{tasks.length}</Badge>
                </h3>
                <div class="space-y-3">
                  {#each tasks as task (task.id)}{@render card(
                      task,
                      `board:${task.id}`,
                      false,
                    )}
                  {:else}<p class="m-0 py-4 text-xs text-muted-foreground">
                      {vb.t(
                        lane.value === "todo"
                          ? "Nada a fazer."
                          : "Arraste um card pra cá.",
                      )}
                    </p>{/each}
                </div>
              </section>
            {/each}
          </div>
        </div>
      {:else}
        <div class="h-full min-h-0 space-y-5 overflow-auto">
          {#if mine.length}<section
              class="space-y-2"
              aria-label={vb.t("Esperando você")}
            >
              <h3
                class="m-0 flex items-center gap-2 font-sans text-sm font-semibold leading-5 tracking-normal"
              >
                {vb.t("Esperando você")}<Badge
                  class="text-foreground"
                  variant="warning">{mine.length}</Badge
                >
              </h3>
              {#each mine as task (task.id)}{@render card(
                  task,
                  `mine:${task.id}`,
                  true,
                )}{/each}
            </section>{/if}
          {#each openGroups as group (group.id)}<section
              class="space-y-2"
              aria-label={group.title}
            >
              <h3
                class="m-0 flex items-center gap-2 font-sans text-sm font-semibold leading-5 tracking-normal"
              >
                {group.title}<Badge>{group.tasks.length}</Badge>
              </h3>
              {#each group.tasks as task (task.id)}{@render card(
                  task,
                  `group:${task.id}`,
                  true,
                )}{/each}
            </section>{:else}<EmptyState
              title={vb.t("Nenhuma tarefa aberta.")}
            />{/each}
        </div>
      {/if}
    {/if}
  {/snippet}
  <form
    onsubmit={add}
    class="flex shrink-0 flex-wrap items-end gap-2"
    data-board-add
  >
    <div class="min-w-36 flex-1 space-y-1">
      <Label for={`${uid}-title`}>{vb.t("Nova tarefa")}</Label>
      <Input
        id={`${uid}-title`}
        placeholder={vb.t("nova tarefa")}
        bind:ref={addInput}
        bind:value={title}
      />
    </div>
    {#if !model.scope}<div class="min-w-32 flex-1 space-y-1">
        <Label for={`${uid}-epic`}>{vb.t("Épico")}</Label>
        <Select
          items={targetItems}
          bind:value={
            () => selectedTarget.id,
            (value) => {
              const next = model.targets.find((target) => target.id === value);
              if (!next) return;
              selectedTarget = next;
              error = "";
            }
          }
        >
          <SelectTrigger
            id={`${uid}-epic`}
            aria-invalid={!targetValid}
            class="w-full"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent class="font-sans">
            {#each targetItems as target (target.value)}<SelectItem
                value={target.value}
                label={target.label}
                disabled={target.disabled}>{target.label}</SelectItem
              >{/each}
          </SelectContent>
        </Select>
      </div>{/if}
    <Button type="submit" disabled={!title.trim() || !targetValid}
      ><Icon icon="plus" />{vb.t("Nova tarefa")}</Button
    >
  </form>
</section>

{#snippet card(task: BoardTask, key: string, row: boolean)}
  <article
    use:registerCard={key}
    data-board-task={task.id}
    data-status={task.status}
    draggable={!row}
    ondragstart={(event) => {
      if (
        event.target instanceof Element &&
        event.target.closest(statusTrigger)
      ) {
        event.preventDefault();
        return;
      }
      if (event.dataTransfer) {
        event.dataTransfer.setData("application/x-vibebook-task", task.id);
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setDragImage(event.currentTarget, 20, 20);
      }
      dragging = task.id;
    }}
    ondragend={() => {
      dragging = null;
      over = null;
    }}
    class={cn(
      "relative min-w-0 rounded-control border border-border bg-card text-card-foreground shadow-xs",
      row && "flex flex-wrap items-center",
      dragging === task.id && "opacity-50",
      task.status !== "done" && task.owner === room.me && "ring-1 ring-ring/20",
    )}
  >
    <button
      type="button"
      data-board-open
      data-epic={task.epicId}
      aria-describedby={`${uid}-keys`}
      onclick={() => onopen?.(task.epicId)}
      onkeydown={(event) => keyboard(event, task, key)}
      class={cn(
        "block w-full min-w-0 flex-1 space-y-2 rounded-control border-0 bg-transparent p-3 text-left font-sans text-sm text-card-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
        !row && "pr-10",
      )}
    >
      <span
        class={cn(
          "block break-words font-medium",
          task.status === "done" && "line-through",
        )}>{task.title}</span
      >
      {#if task.flags?.length}<Badge
          variant="warning"
          title={`@vibe: ${task.flags.join(" · ")}`}
          class="text-foreground max-w-full"
          ><Icon icon="alert-triangle" /><span class="truncate"
            >{task.flags.join(" · ")}</span
          ></Badge
        >{/if}
      <span
        class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
      >
        <Badge class="max-w-full"
          ><span class="truncate">{task.epicTitle}</span></Badge
        >
        {#if task.owner}<PersonAvatar
            data-avatar="person"
            size="xs"
            email={task.owner}
            version={vb.avatarVersion(task.owner)}
          /><span
            >{task.owner === room.me ? vb.t("você") : vb.name(task.owner)}</span
          >{/if}
        {#if task.due}<span class="inline-flex items-center gap-1"
            ><Icon icon="calendar" size={12} />{task.due}</span
          >{/if}
      </span>
    </button>
    {#if !row}<span
        data-board-drag
        draggable="true"
        aria-hidden="true"
        title={vb.t("Arraste, ou use ← →. Clique pra abrir o épico.")}
        class="absolute right-2 top-2 grid size-7 cursor-grab place-items-center rounded-md text-muted-foreground active:cursor-grabbing"
        ><Icon icon="dots-grid" size={16} /></span
      >{/if}
    <div class={cn("min-w-32 space-y-1 p-3", !row && "border-t border-border")}>
      <Label for={`${uid}-${key}`}>{vb.t("Status")}</Label>
      <Select
        items={options}
        bind:value={
          () => task.status,
          (value) => {
            if (isTaskStatus(value)) move(task, value, key);
          }
        }
      >
        <SelectTrigger
          id={`${uid}-${key}`}
          aria-label={`${vb.t("Status")}: ${task.title}`}
          class="w-full"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent class="font-sans">
          {#each options as option (option.value)}<SelectItem
              value={option.value}
              label={option.label}>{option.label}</SelectItem
            >{/each}
        </SelectContent>
      </Select>
    </div>
  </article>
{/snippet}
