<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import type { Epic, Room } from "../../../shared/room";
  import { epicIdentity } from "./model";
  import type { RoomMutations } from "./session";
  import ConfirmDialog from "../../lib/components/ConfirmDialog.svelte";
  import TitledDialog from "../../lib/components/TitledDialog.svelte";
  import { studioType } from "../../lib/components/type";
  import Button from "../../lib/studio/Button.svelte";
  import DropdownMenu from "../../lib/studio/DropdownMenu.svelte";
  import DropdownMenuContent from "../../lib/studio/DropdownMenuContent.svelte";
  import DropdownMenuItem from "../../lib/studio/DropdownMenuItem.svelte";
  import DropdownMenuSeparator from "../../lib/studio/DropdownMenuSeparator.svelte";
  import DropdownMenuTrigger from "../../lib/studio/DropdownMenuTrigger.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import { buttonVariants } from "../../lib/studio/button";
  import Input from "../../lib/studio/Input.svelte";
  import Label from "../../lib/studio/Label.svelte";
  import {
    Check,
    DotsHorizontal,
    Pencil01,
    ReverseLeft,
    Trash01,
  } from "../../lib/studio/icons";
  import { cn } from "../../lib/studio/utils";
  /**
   * An epic's rename, archive and delete, with their dialogs. `menu`: behind
   * a "⋯" (the phone's thread sheet). `bar`: buttons in the desktop top bar,
   * ✎ beside the title and Archive, 🗑 pushed to the end of the row.
   */
  let {
    epic,
    room,
    owner,
    t,
    variant,
  }: {
    epic: Epic;
    room: Room;
    owner: RoomMutations;
    t: (text: string, vars?: Record<string, string | number>) => string;
    variant: "menu" | "bar";
  } = $props();
  const status = untrack(() => owner.state);
  const busy = $derived(
    $status.phase === "pending" || $status.phase === "unconfirmed",
  );
  let rename = $state(false),
    remove = $state(false),
    value = $state(""),
    snapshot = $state(""),
    target = $state("");
  let active = true;
  // The dialog acts on the epic it opened for: a rename, a delete or a new
  // version of that epic from the server closes it.
  const identity = (mode: "rename" | "delete", item: Epic) =>
    mode === "rename"
      ? JSON.stringify([item.id, item.title])
      : epicIdentity(item);
  $effect(() => {
    if (
      target &&
      (epic.id !== target ||
        identity(rename ? "rename" : "delete", epic) !== snapshot)
    ) {
      rename = false;
      remove = false;
      target = "";
    }
  });
  function begin(mode: "rename" | "delete") {
    if (!active || busy) return;
    target = epic.id;
    snapshot = identity(mode, epic);
    value = epic.title;
    rename = mode === "rename";
    remove = mode === "delete";
  }
  function current() {
    return (
      active &&
      epic.id === target &&
      identity(rename ? "rename" : "delete", epic) === snapshot &&
      room.members.includes(room.me)
    );
  }
  function archive() {
    if (active && !busy)
      void owner.run({
        t: "epic.archive",
        id: epic.id,
        archived: !epic.archived,
      });
  }
  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (!rename || !current() || busy || !value.trim()) return;
    const expected = target;
    if (await owner.run({ t: "epic.rename", id: target, title: value }))
      if (active && target === expected) rename = false;
  }
  async function erase() {
    if (!remove || !current() || busy) return;
    const expected = target;
    if (await owner.run({ t: "epic.del", id: target }))
      if (active && target === expected) remove = false;
  }
  onDestroy(() => {
    active = false;
  });
</script>

{#if variant === "bar"}<IconButton
    data-epic-rename={epic.id}
    label={t("Renomear")}
    tooltipSide="bottom"
    size="icon-sm"
    disabled={busy}
    class="shrink-0 text-muted-foreground hover:text-foreground"
    onclick={() => begin("rename")}><Icon icon={Pencil01} /></IconButton
  >
  <span class="ml-auto flex shrink-0 items-center gap-1">
    <Button
      data-epic-archive={epic.id}
      variant="outline"
      size="sm"
      disabled={busy}
      onclick={archive}
      ><Icon icon={epic.archived ? ReverseLeft : Check} />{t(
        epic.archived ? "Desarquivar" : "Arquivar",
      )}</Button
    >
    <IconButton
      data-epic-delete={epic.id}
      label={t("Apagar épico")}
      tooltipSide="bottom"
      size="icon-sm"
      disabled={busy}
      class="text-muted-foreground hover:text-destructive"
      onclick={() => begin("delete")}><Icon icon={Trash01} /></IconButton
    >
  </span>{:else}<DropdownMenu>
    <DropdownMenuTrigger
      data-thread-actions={epic.id}
      disabled={busy}
      aria-label={`${t("Ações do épico")}: ${epic.title}`}
      class={buttonVariants({ variant: "ghost", size: "icon-sm" })}
      ><Icon icon={DotsHorizontal} /></DropdownMenuTrigger
    >
    <DropdownMenuContent
      data-vb-native
      align="end"
      class={cn(studioType, "w-52")}
    >
      <DropdownMenuItem disabled={busy} onSelect={() => begin("rename")}
        ><Icon icon={Pencil01} />{t("Renomear")}</DropdownMenuItem
      >
      <DropdownMenuItem disabled={busy} onSelect={archive}
        ><Icon icon={epic.archived ? ReverseLeft : Check} />{t(
          epic.archived ? "Desarquivar épico" : "Arquivar épico",
        )}</DropdownMenuItem
      >
      <DropdownMenuSeparator />
      <DropdownMenuItem
        variant="destructive"
        disabled={busy}
        onSelect={() => begin("delete")}
        ><Icon icon={Trash01} />{t("Apagar épico")}</DropdownMenuItem
      >
    </DropdownMenuContent>
  </DropdownMenu>{/if}
<TitledDialog
  bind:open={rename}
  title={t("Nome do épico:")}
  closeLabel={t("Cancelar")}
  ><form onsubmit={save} class="space-y-3">
    <Label class="flex-col items-stretch gap-1.5"
      >{t("Nome do épico:")}<Input
        bind:value
        maxlength={200}
        disabled={busy}
        required
      /></Label
    >
    <div class="flex justify-end">
      <Button type="submit" disabled={busy || !value.trim()}
        >{t("Salvar")}</Button
      >
    </div>
  </form></TitledDialog
>
<ConfirmDialog
  bind:open={remove}
  title={t("Apagar épico")}
  description={t(
    'Apagar o épico "{title}", as tasks e a discussão dele? Não dá pra desfazer.',
    { title: epic.title },
  )}
  confirmLabel={t("Apagar")}
  cancelLabel={t("Cancelar")}
  busy={$status.phase === "pending"}
  confirmDisabled={busy || !current()}
  onconfirm={erase}
/>
