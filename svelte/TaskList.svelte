<script lang="ts">
  import type { RoomCommand } from "../shared/commands";
  import type { PanelProps, Task } from "./panels";
  import Button from "./lib/studio/Button.svelte";
  import IconButton from "./lib/studio/IconButton.svelte";
  import Icon from "./lib/studio/Icon.svelte";
  import Input from "./lib/studio/Input.svelte";
  import Select from "./lib/studio/Select.svelte";
  import SelectContent from "./lib/studio/SelectContent.svelte";
  import SelectItem from "./lib/studio/SelectItem.svelte";
  import SelectTrigger from "./lib/studio/SelectTrigger.svelte";
  import SelectValue from "./lib/studio/SelectValue.svelte";
  import Checkbox from "./lib/studio/Checkbox.svelte";
  import Badge from "./lib/studio/Badge.svelte";
  import Dialog from "./lib/studio/Dialog.svelte";
  import DialogContent from "./lib/studio/DialogContent.svelte";
  import DialogDescription from "./lib/studio/DialogDescription.svelte";
  import DialogHeader from "./lib/studio/DialogHeader.svelte";
  import DialogTitle from "./lib/studio/DialogTitle.svelte";
  import Progress from "./lib/studio/Progress.svelte";
  import Field from "./lib/components/Field.svelte";
  import ErrorState from "./lib/components/ErrorState.svelte";
  import { registerDialog } from "./lib/studio/dialogController";
  import { AlertTriangle, Calendar, Plus, X } from "./lib/studio/icons";
  import { cn } from "./lib/studio/utils";

  let {
    room,
    thread,
    vb,
    send,
    waits = [],
  }: Pick<PanelProps, "room" | "thread" | "send" | "waits"> & {
    vb: Pick<PanelProps["vb"], "t" | "name">;
  } = $props();
  const uid = $props.id();
  const list = $derived(
    room.epics.find((epic) => epic.id === thread) ??
      (thread === "main" && room.roomTasks?.length
        ? { id: "main", tasks: room.roomTasks, flags: [] }
        : null),
  );
  const waiting = (task: Task) =>
    waits.some(
      (wait) => wait.book_id === room.id && wait.ref === `t${task.id}`,
    );
  const tasks = $derived(
    (list?.tasks ?? [])
      .map((task, index) => ({ task, index }))
      .sort(
        (a, b) =>
          (a.task.done ? 2 : waiting(a.task) ? 0 : 1) -
            (b.task.done ? 2 : waiting(b.task) ? 0 : 1) || a.index - b.index,
      )
      .map((row) => row.task),
  );
  const done = $derived(list?.tasks.filter((task) => task.done).length ?? 0);
  const owners = $derived([
    { value: "", label: vb.t("sem dono") },
    ...(room.members ?? []).map((email) => ({
      value: email,
      label: email === room.me ? vb.t("você") : vb.name(email),
    })),
  ]);
  let edit = $state<string | null>(null);
  let highlighted = $state<ReadonlySet<string>>(new Set());
  function attention(node: HTMLElement, id: string) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const clear = () => {
      highlighted = new Set([...highlighted].filter((value) => value !== id));
    };
    const show = () => {
      if (!node.isConnected) return;
      if (timer !== undefined) clearTimeout(timer);
      highlighted = new Set([...highlighted, id]);
      timer = setTimeout(clear, 1800);
    };
    node.addEventListener("vb:task-highlight", show);
    return {
      destroy() {
        node.removeEventListener("vb:task-highlight", show);
        if (timer !== undefined) clearTimeout(timer);
        clear();
      },
    };
  }
  let title = $state("");
  let editInput = $state<HTMLInputElement | null>(null);
  let newTitle = $state("");
  let error = $state("");
  let dueID = $state<string | null>(null);
  let dueOpen = $state(false);
  let dueDraft = $state("");
  let dueInput = $state<HTMLInputElement | null>(null);
  const dueTask = $derived(list?.tasks.find((task) => task.id === dueID));

  $effect(() => {
    if (edit && editInput) {
      editInput.focus();
      editInput.select();
    }
  });
  $effect(() => {
    if (dueID && !dueTask) closeDue();
    if (edit && !list?.tasks.some((task) => task.id === edit)) edit = null;
  });
  function dispatch(command: RoomCommand): boolean {
    try {
      if (send(command)) {
        error = "";
        return true;
      }
    } catch {
      /* Keep form data when a socket closes during dispatch. */
    }
    error = vb.t("Não deu pra enviar agora. Tente de novo.");
    return false;
  }
  function save(task: Task, accept = true) {
    if (edit !== task.id) return;
    if (!accept || !title.trim() || title === task.title) {
      edit = null;
      return;
    }
    if (dispatch({ t: "task.rename", id: task.id, title })) edit = null;
  }
  function openDue(task: Task) {
    dueID = task.id;
    dueDraft = task.due ?? "";
    dueOpen = true;
  }
  function closeDue() {
    dueOpen = false;
    dueID = null;
    dueDraft = "";
  }
  $effect(() => {
    if (dueOpen) return registerDialog(closeDue);
  });
</script>

{#if list}
  <section
    data-vb-native
    class="tw:m-0 tw:box-border tw:space-y-3 tw:rounded-surface tw:bg-background tw:p-3 tw:font-sans tw:text-sm tw:text-foreground"
    aria-label={vb.t("Tarefas")}
  >
    <header class="tw:flex tw:items-center tw:gap-3">
      <h3 class="tw:m-0 tw:font-sans tw:text-sm tw:font-semibold">
        {vb.t("Tarefas")}
      </h3>
      <Badge>{done}/{list.tasks.length}</Badge>
      <Progress
        aria-label={vb.t("Tarefas")}
        value={(done / Math.max(1, list.tasks.length)) * 100}
        aria-valuetext={`${done}/${list.tasks.length}`}
        class="tw:ml-auto tw:max-w-24"
      />
    </header>
    {#if list.flags?.length}<Badge
        variant="warning"
        title={`@vibe: ${list.flags.join(" · ")}`}
        class="tw:text-foreground tw:max-w-full"
        ><Icon icon={AlertTriangle} /><span class="tw:truncate"
          >{list.flags.join(" · ")}</span
        ></Badge
      >{/if}
    {#if error && !dueOpen}<ErrorState title={error} compact />{/if}
    <!-- One list, compact rows: the title leads, owner and due are captions under it, delete waits for hover. -->
    <div class="tw:-mx-2 tw:space-y-0.5">
      {#each tasks as task (task.id)}
        <div
          use:attention={task.id}
          data-task={task.id}
          role="group"
          aria-label={task.title}
          class={cn(
            "tw:group/task tw:relative tw:flex tw:items-start tw:gap-2.5 tw:rounded-control tw:py-1.5 tw:pr-8 tw:pl-2 tw:transition-colors tw:duration-150 tw:hover:bg-accent/50",
            task.done ? "tw:text-muted-foreground" : "tw:text-foreground",
            waiting(task) && "tw:bg-warning/10",
            highlighted.has(task.id) &&
              "tw:animate-pulse tw:motion-reduce:animate-none",
          )}
        >
          <Checkbox
            class="tw:mt-0.5"
            bind:checked={
              () => task.done,
              () => {
                dispatch({ t: "task.toggle", id: task.id });
              }
            }
            aria-label={vb.t("Feita")}
          />
          {#if edit === task.id}
            <Input
              data-task-edit={task.id}
              aria-label={vb.t("Clique para editar")}
              class="tw:min-w-32 tw:flex-1"
              bind:ref={editInput}
              bind:value={title}
              onblur={() => save(task)}
              onkeydown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  save(task);
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  save(task, false);
                }
              }}
            />
          {:else}
            <div class="tw:min-w-0 tw:flex-1">
              <Button
                data-task-title={task.id}
                variant="ghost"
                class={cn(
                  "tw:h-auto tw:w-full tw:justify-start tw:whitespace-normal tw:rounded-sm tw:p-0 tw:text-left tw:font-normal tw:leading-5 tw:hover:bg-transparent",
                  task.done && "tw:text-muted-foreground tw:line-through",
                )}
                title={vb.t("Clique para editar")}
                onclick={() => {
                  edit = task.id;
                  title = task.title;
                }}>{task.title}</Button
              >
              <div
                class="tw:-ml-1.5 tw:mt-0.5 tw:flex tw:flex-wrap tw:items-center tw:gap-0.5 tw:text-xs tw:text-muted-foreground"
              >
                <Select
                  items={owners}
                  bind:value={
                    () => task.owner ?? "",
                    (owner) => {
                      dispatch({ t: "task.assign", id: task.id, owner });
                    }
                  }
                >
                  <SelectTrigger
                    data-owner={task.id}
                    aria-label={vb.t("Responsável")}
                    size="xs"
                    class="tw:h-6 tw:w-auto tw:max-w-40 tw:px-1.5 tw:font-normal tw:text-muted-foreground tw:hover:text-foreground tw:data-[variant=outline]:rounded-md tw:data-[variant=outline]:bg-transparent tw:data-[variant=outline]:shadow-none tw:data-[variant=outline]:hover:bg-accent tw:data-[placeholder]:text-muted-foreground"
                  >
                    <SelectValue placeholder={vb.t("sem dono")} />
                  </SelectTrigger>
                  <SelectContent data-vb-native class="tw:font-sans">
                    {#each owners as owner (owner.value)}<SelectItem
                        value={owner.value}
                        label={owner.label}>{owner.label}</SelectItem
                      >{/each}
                  </SelectContent>
                </Select>
                <Button
                  data-due={task.id}
                  variant="ghost"
                  size="sm"
                  title={vb.t("Prazo")}
                  aria-label={task.due
                    ? `${vb.t("Prazo")}: ${task.due}`
                    : vb.t("Prazo")}
                  class={cn(
                    "tw:h-6 tw:gap-1 tw:rounded-md tw:px-1.5 tw:text-xs tw:font-normal tw:text-muted-foreground tw:hover:text-foreground",
                    !task.due &&
                      "tw:opacity-0 tw:group-hover/task:opacity-100 tw:focus-visible:opacity-100 tw:[@media(hover:none)]:opacity-100",
                  )}
                  onclick={() => openDue(task)}
                  ><Icon icon={Calendar} class="tw:size-3" />{task.due ??
                    ""}</Button
                >
                {#if task.flags?.length}<Badge
                    variant="warning"
                    title={`@vibe: ${task.flags.join(" · ")}`}
                    class="tw:max-w-full tw:text-foreground"
                    ><Icon icon={AlertTriangle} /><span class="tw:truncate"
                      >{task.flags.join(" · ")}</span
                    ></Badge
                  >{/if}
              </div>
            </div>
          {/if}
          <IconButton
            data-tdel={task.id}
            label={vb.t("Apagar task")}
            size="icon-xs"
            class="tw:absolute tw:top-1.5 tw:right-1.5 tw:text-muted-foreground tw:opacity-0 tw:group-hover/task:opacity-100 tw:focus-visible:opacity-100 tw:[@media(hover:none)]:opacity-100"
            onclick={() => dispatch({ t: "task.del", id: task.id })}
            ><Icon icon={X} /></IconButton
          >
        </div>
      {/each}
    </div>
    <form
      id="newTask"
      class="tw:flex tw:items-center tw:gap-2"
      onsubmit={(event) => {
        event.preventDefault();
        if (
          newTitle.trim() &&
          dispatch({ t: "task.add", epic: thread, title: newTitle })
        )
          newTitle = "";
      }}
    >
      <Input
        aria-label={vb.t("nova task")}
        placeholder={vb.t("nova task")}
        bind:value={newTitle}
      />
      <IconButton
        type="submit"
        label={vb.t("Nova tarefa")}
        variant="outline"
        size="icon"><Icon icon={Plus} /></IconButton
      >
    </form>
  </section>
{/if}
{#if dueTask}
  <Dialog
    bind:open={dueOpen}
    onOpenChange={(open) => {
      if (!open) closeDue();
    }}
  >
    <DialogContent
      data-vb-native
      class="tw:font-sans tw:text-sm tw:text-foreground"
      closeLabel={vb.t("Fechar")}
      preventScroll={false}
      preventBodyPointerEvents={false}
      preventOverflowTextSelection={false}
      onOpenAutoFocus={(event) => {
        if (!dueInput) return;
        event.preventDefault();
        dueInput.focus();
      }}
    >
      <DialogHeader>
        <DialogTitle class="tw:font-sans">{vb.t("Prazo")}</DialogTitle>
        <DialogDescription
          >{vb.t(
            "Prazo (ex.: sex, qua 23h, 06/11). Vazio tira o prazo:",
          )}</DialogDescription
        >
      </DialogHeader>
      <form
        class="tw:grid tw:grid-cols-1 tw:gap-4"
        onsubmit={(event) => {
          event.preventDefault();
          if (
            dueTask &&
            dispatch({ t: "task.assign", id: dueTask.id, due: dueDraft })
          )
            closeDue();
        }}
      >
        <Field id={`${uid}-due`} label={vb.t("Prazo")}>
          {#snippet children(attributes)}<Input
              {...attributes}
              bind:ref={dueInput}
              bind:value={dueDraft}
            />{/snippet}
        </Field>
        {#if error}<ErrorState title={error} compact />{/if}
        <div class="tw:flex tw:flex-wrap tw:justify-end tw:gap-2">
          <Button variant="outline" onclick={closeDue}
            >{vb.t("Cancelar")}</Button
          ><Button type="submit">{vb.t("Salvar")}</Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>
{/if}
