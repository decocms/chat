<script lang="ts">
  import { MOBILE_QUERY } from "../../lib/breakpoints";
  import { onDestroy, untrack } from "svelte";
  import type { ThreadHeaderProps } from "./types";
  import { epicIdentity, suggestionAt } from "./model";
  import RoomMark from "./RoomMark.svelte";
  import { dmPeer } from "../room-scope/model";
  import ConfirmDialog from "../../lib/components/ConfirmDialog.svelte";
  import PersonAvatar from "../../lib/components/PersonAvatar.svelte";
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
    ChevronDown,
    DotsHorizontal,
    Pencil01,
    ReverseLeft,
    Trash01,
  } from "../../lib/studio/icons";
  import { cn } from "../../lib/studio/utils";
  import MutationStatus from "./MutationStatus.svelte";
  let {
    room,
    thread,
    owner,
    vb,
    onopenside,
    onrenameroom,
    roomIcon,
    titleId,
    compact = false,
    onhome,
  }: ThreadHeaderProps = $props();
  const status = untrack(() => owner.state);
  // Secondary text beside the title gives way first; on the phone bar it is dropped (the sheet header shows it).
  const aside = "min-w-0 shrink-[2] truncate text-xs text-muted-foreground";
  const epic = $derived(room.epics.find((item) => item.id === thread));
  const suggestion = $derived(suggestionAt(room, thread));
  // A DM's main thread: the other person's face, the same as in your DM list.
  const peer = $derived(dmPeer(room));
  const title = $derived(suggestion?.title ?? epic?.title ?? room.book.title);
  const busy = $derived(
    $status.phase === "pending" || $status.phase === "unconfirmed",
  );
  let rename = $state(false),
    remove = $state(false),
    value = $state(""),
    snapshot = $state(""),
    target = $state("");
  let active = true;
  $effect(() => {
    if (
      target &&
      (!epic ||
        epic.id !== target ||
        (rename
          ? JSON.stringify([epic.id, epic.title])
          : epicIdentity(epic)) !== snapshot)
    ) {
      rename = false;
      remove = false;
      target = "";
    }
  });
  function begin(mode: "rename" | "delete") {
    if (!active || busy || !epic) return;
    target = epic.id;
    snapshot =
      mode === "rename"
        ? JSON.stringify([epic.id, epic.title])
        : epicIdentity(epic);
    value = epic.title;
    rename = mode === "rename";
    remove = mode === "delete";
  }
  function current() {
    return (
      active &&
      !!epic &&
      epic.id === target &&
      (rename ? JSON.stringify([epic.id, epic.title]) : epicIdentity(epic)) ===
        snapshot &&
      room.members.includes(room.me)
    );
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

<div
  data-vb-native
  data-native-thread-header
  class="flex min-w-0 flex-1 flex-nowrap items-center gap-1 font-sans text-sm tracking-normal text-foreground"
>
  <span class={["hidden md:contents", onhome && "cursor-pointer"]}
    >{#if !epic && !suggestion && peer}<PersonAvatar
        email={peer}
        version={vb.avatarVersion(peer)}
        class="size-6"
      />{:else if !epic && !suggestion}<RoomMark
        {title}
        src={roomIcon}
        class="size-6"
      />{:else}<PersonAvatar
        email={epic?.owner}
        version={epic?.owner ? vb.avatarVersion(epic.owner) : undefined}
        class="size-6"
      />{/if}</span
  >
  <h2 class="m-0 min-w-0 overflow-hidden text-sm font-medium">
    <Button
      id={titleId}
      variant="ghost"
      size="sm"
      class={cn(
        "max-w-full min-w-0 justify-start px-2 text-sm font-medium",
        // Desktop top bar: plain text with a pointer, no button background.
        onhome &&
          "md:cursor-pointer md:hover:bg-transparent md:hover:text-foreground md:aria-expanded:bg-transparent",
      )}
      title={room.book.summary || title}
      onclick={(event) => {
        if (!event.currentTarget.isConnected) return;
        if (matchMedia(MOBILE_QUERY).matches) onopenside();
        else if (onhome) onhome();
        else if (!suggestion) epic ? begin("rename") : onrenameroom();
      }}><span class="truncate">{title}</span></Button
    >
  </h2>
  <IconButton
    label={vb.t("Trocar de conversa")}
    class="md:hidden"
    onclick={(event) => {
      if (event.currentTarget.isConnected) onopenside();
    }}><Icon icon={ChevronDown} /></IconButton
  >
  {#if suggestion}<span class={[aside, compact && "max-md:hidden"]}
      >✦ {vb.t("sugestão do @vibe")}</span
    >{:else if room.book.folder && !epic && !compact}<span class={aside}
      >{room.book.folder}</span
    >{/if}
  {#if epic}<span class={compact ? "hidden md:contents" : "contents"}>
      <DropdownMenu>
        <DropdownMenuTrigger
          data-thread-actions={epic.id}
          disabled={busy}
          aria-label={`${vb.t("Ações do épico")}: ${epic.title}`}
          class={buttonVariants({ variant: "ghost", size: "icon-sm" })}
          ><Icon icon={DotsHorizontal} /></DropdownMenuTrigger
        >
        <DropdownMenuContent
          data-vb-native
          align="end"
          class={cn(studioType, "w-52")}
        >
          <DropdownMenuItem disabled={busy} onSelect={() => begin("rename")}
            ><Icon icon={Pencil01} />{vb.t("Renomear")}</DropdownMenuItem
          >
          <DropdownMenuItem
            disabled={busy}
            onSelect={() => {
              if (active && epic)
                void owner.run({
                  t: "epic.archive",
                  id: epic.id,
                  archived: !epic.archived,
                });
            }}
            ><Icon icon={epic.archived ? ReverseLeft : Check} />{vb.t(
              epic.archived ? "Desarquivar épico" : "Arquivar épico",
            )}</DropdownMenuItem
          >
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            disabled={busy}
            onSelect={() => begin("delete")}
            ><Icon icon={Trash01} />{vb.t("Apagar épico")}</DropdownMenuItem
          >
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  {/if}
  <MutationStatus {owner} t={vb.t} />
</div>
<TitledDialog
  bind:open={rename}
  title={vb.t("Nome do épico:")}
  closeLabel={vb.t("Cancelar")}
  ><form onsubmit={save} class="space-y-3">
    <Label class="flex-col items-stretch gap-1.5"
      >{vb.t("Nome do épico:")}<Input
        bind:value
        maxlength={200}
        disabled={busy}
        required
      /></Label
    >
    <div class="flex justify-end">
      <Button type="submit" disabled={busy || !value.trim()}
        >{vb.t("Salvar")}</Button
      >
    </div>
  </form></TitledDialog
>
<ConfirmDialog
  bind:open={remove}
  title={vb.t("Apagar épico")}
  description={vb.t(
    'Apagar o épico "{title}", as tasks e a discussão dele? Não dá pra desfazer.',
    { title: epic?.title ?? "" },
  )}
  confirmLabel={vb.t("Apagar")}
  cancelLabel={vb.t("Cancelar")}
  busy={$status.phase === "pending"}
  confirmDisabled={busy || !current()}
  onconfirm={erase}
/>
