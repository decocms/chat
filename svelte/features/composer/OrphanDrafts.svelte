<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import type { Room } from "../../../shared/room";
  import type { ChatBridge } from "../../chatTypes";
  import type { ComposerDrafts, OrphanDraft } from "./drafts";
  import Dialog from "../../lib/studio/Dialog.svelte";
  import DialogContent from "../../lib/studio/DialogContent.svelte";
  import DialogDescription from "../../lib/studio/DialogDescription.svelte";
  import DialogHeader from "../../lib/studio/DialogHeader.svelte";
  import DialogTitle from "../../lib/studio/DialogTitle.svelte";
  import Button from "../../lib/studio/Button.svelte";
  import Textarea from "../../lib/studio/Textarea.svelte";
  let {
    room,
    drafts,
    vb,
  }: { room: Room; drafts: ComposerDrafts; vb: ChatBridge } = $props();
  const changes = untrack(() => drafts.changes);
  let selected = $state.raw<OrphanDraft | null>(null),
    open = $state(false),
    notice = $state("");
  let active = true,
    ticket = 0;
  const orphans = $derived.by(() => {
    $changes;
    return drafts.orphans(room);
  });
  const current = $derived(
    selected &&
      orphans.some(
        (item) =>
          item.scope === selected?.scope && item.state === selected?.state,
      ),
  );
  const reviewText = $derived(
    selected
      ? [
          `Thread: ${selected.scope.thread}`,
          selected.state.text,
          selected.state.replyId ? `Reply: ${selected.state.replyId}` : "",
          ...selected.state.attachments.map(
            (item) =>
              `${item.name} (${item.type}, ${item.size} bytes; ${item.phase})`,
          ),
          selected.state.poll.question
            ? `Poll: ${selected.state.poll.question}`
            : "",
          selected.state.poll.multi
            ? vb.t("cada pessoa pode escolher várias")
            : "",
          ...selected.state.poll.options.filter(Boolean),
        ]
          .filter(Boolean)
          .join("\n\n")
      : "",
  );
  $effect(() => {
    if (selected && !current) {
      open = false;
      selected = null;
      notice = "";
      ticket++;
    }
  });
  async function copy() {
    if (!active || !open || !current || !selected) return;
    const own = ++ticket,
      snapshot = selected;
    try {
      await navigator.clipboard.writeText(reviewText);
      if (active && own === ticket && selected === snapshot && open && current)
        notice = vb.t("Copiado");
    } catch {
      if (active && own === ticket && selected === snapshot && open && current)
        notice = vb.t(
          "Não foi possível copiar. Selecione o texto abaixo e copie manualmente.",
        );
    }
  }
  function discard() {
    if (!active || !open || !current || !selected) return;
    if (drafts.discardOrphan(selected, room)) {
      open = false;
      selected = null;
      ticket++;
    }
  }
  onDestroy(() => {
    active = false;
    ticket++;
  });
</script>

{#if orphans.length}
  <aside
    data-composer-orphans
    class="flex flex-wrap items-center gap-2 border-t border-border p-2 text-sm text-muted-foreground"
  >
    <span>{vb.t("Rascunhos de conversas removidas")}: {orphans.length}</span>
    {#each orphans as item (item.scope.thread)}
      <Button
        variant="outline"
        size="sm"
        onclick={() => {
          selected = item;
          notice = "";
          open = true;
          ticket++;
        }}>{vb.t("Revisar rascunho")}: {item.scope.thread}</Button
      >
    {/each}
  </aside>
{/if}
<Dialog bind:open>
  <DialogContent
    data-vb-native
    class="font-sans text-sm text-foreground"
    closeLabel={vb.t("Fechar")}
    preventScroll={false}
    preventBodyPointerEvents={false}
    preventOverflowTextSelection={false}
  >
    <DialogHeader>
      <DialogTitle class="pr-8 font-sans"
        >{vb.t("Revisar rascunho")}</DialogTitle
      >
      <DialogDescription
        >{vb.t(
          "A conversa original não está disponível. Copie ou descarte este rascunho local. Nada será enviado ou movido. Descartar não desfaz um upload ou uma mensagem já enviada.",
        )}</DialogDescription
      >
    </DialogHeader>
    <Textarea
      readonly
      value={reviewText}
      aria-label={vb.t("Rascunho original")}
      rows={8}
    />
    {#if notice}<p role="status" class="m-0 text-sm text-muted-foreground">
        {notice}
      </p>{/if}
    <div class="flex justify-end gap-2">
      <Button variant="outline" disabled={!current} onclick={copy}
        >{vb.t("Copiar")}</Button
      >
      <Button variant="destructive" disabled={!current} onclick={discard}
        >{vb.t("Descartar rascunho")}</Button
      >
    </div>
  </DialogContent>
</Dialog>
