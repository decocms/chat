<script lang="ts">
  /** The thread's follow-up in the composer (Gimenes #4707): a task of yours in review shows here, above the
   *  field, with its answers. "Escrever livre" goes back to the normal composer for this task. */
  import type { Room, Task } from "../../../shared/room";
  import type { RequestRoomCommand } from "../../app/roomConnection";
  import type { ComposerEntry } from "./drafts";
  import type { ChatBridge } from "../../app/chatTypes";
  import Button from "../../lib/studio/Button.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import { reviewWaiting } from "./model";
  let {
    room,
    thread,
    entry,
    request,
    t,
  }: {
    room: Room;
    thread: string;
    entry: ComposerEntry;
    request: RequestRoomCommand;
    t: ChatBridge["t"];
  } = $props();
  /** Tasks that you chose to answer by writing: the card does not come back for them in this composer. */
  let free = $state<string[]>([]);
  let busy = $state(false);
  const task = $derived<Task | undefined>(
    reviewWaiting(room, thread).find((item) => !free.includes(item.id)),
  );
  async function approve(id: string) {
    busy = true;
    try {
      await request({ t: "task.status", id, status: "done", from: "composer" });
    } finally {
      busy = false;
    }
  }
  function write(id: string, text = "") {
    free = [...free, id];
    if (text) entry.edit(text);
    entry.focus();
  }
</script>

{#if task}<div
    data-composer-followup
    class="flex flex-col gap-1.5 border-b border-border py-2 pr-1.5 pl-3.5 transition-[opacity,translate] duration-150 ease-[var(--vb-ease-out-cubic)] starting:translate-y-1 starting:opacity-0"
  >
    <div class="flex items-center gap-2 text-xs">
      <Icon icon="clock" size={14} class="shrink-0 text-warning" />
      <span class="font-semibold text-warning"
        >{t("Esperando você · revisar")}</span
      >
      <button
        type="button"
        class="ml-auto cursor-pointer rounded-md px-1.5 py-0.5 text-muted-foreground hover:bg-secondary-hover hover:text-foreground"
        onclick={() => write(task.id)}>{t("Escrever livre")}</button
      >
    </div>
    <p class="m-0 truncate text-sm font-medium">{task.title}</p>
    <div class="flex flex-wrap gap-1.5">
      <Button
        size="sm"
        disabled={busy}
        data-followup="approve"
        onclick={() => approve(task.id)}
        ><Icon icon="check" size={14} />{t("Aprovar")}</Button
      >
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        data-followup="changes"
        onclick={() =>
          write(task.id, t("Ajuste em “{title}”: ", { title: task.title }))}
        >{t("Pedir ajuste")}</Button
      >
    </div>
  </div>{/if}
