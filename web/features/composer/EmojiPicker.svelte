<script lang="ts">
  import { onDestroy } from "svelte";
  import Dialog from "../../lib/studio/Dialog.svelte";
  import DialogContent from "../../lib/studio/DialogContent.svelte";
  import DialogHeader from "../../lib/studio/DialogHeader.svelte";
  import DialogTitle from "../../lib/studio/DialogTitle.svelte";
  import EmojiGrid from "./EmojiGrid.svelte";
  let {
    t,
    open = $bindable(false),
    onpick,
  }: {
    t: (text: string) => string;
    open?: boolean;
    onpick: (value: string) => void;
  } = $props();
  let search = $state<HTMLInputElement | null>(null),
    grid = $state<HTMLDivElement | null>(null);
  let active = true;
  onDestroy(() => {
    active = false;
  });
  function choose(value: string) {
    if (!active || !open) return;
    onpick(value);
    open = false;
  }
</script>

<Dialog bind:open>
  <DialogContent
    class="font-sans text-sm text-foreground"
    closeLabel={t("Fechar")}
    preventScroll={false}
    preventBodyPointerEvents={false}
    preventOverflowTextSelection={false}
    onOpenAutoFocus={(event) => {
      const target = window.matchMedia("(pointer: coarse)").matches
        ? grid?.querySelector("button") || null
        : search;
      if (target) {
        event.preventDefault();
        target.focus();
      }
    }}
  >
    <DialogHeader>
      <DialogTitle class="pr-8 font-sans">{t("Emoji")}</DialogTitle>
    </DialogHeader>
    <EmojiGrid {t} bind:search bind:grid onpick={choose} />
  </DialogContent>
</Dialog>
