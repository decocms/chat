<script lang="ts">
  import { onDestroy } from "svelte";
  import Dialog from "../../lib/studio/Dialog.svelte";
  import DialogContent from "../../lib/studio/DialogContent.svelte";
  import DialogHeader from "../../lib/studio/DialogHeader.svelte";
  import DialogTitle from "../../lib/studio/DialogTitle.svelte";
  import Input from "../../lib/studio/Input.svelte";
  import Button from "../../lib/studio/Button.svelte";
  import { emojiPicks } from "./model";
  let {
    t,
    open = $bindable(false),
    onpick,
  }: {
    t: (text: string) => string;
    open?: boolean;
    onpick: (value: string) => void;
  } = $props();
  let query = $state(""),
    search = $state<HTMLInputElement | null>(null),
    grid = $state<HTMLDivElement | null>(null);
  const picks = $derived(emojiPicks(query));
  $effect(() => {
    if (open) query = "";
  });
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
    <Input
      type="text"
      inputmode="search"
      bind:ref={search}
      aria-label={t("Buscar emoji…")}
      placeholder={t("Buscar emoji…")}
      value={query}
      oninput={(event) => (query = event.currentTarget.value)}
      onkeydown={(event) => {
        if (event.key === "Enter" && picks.length) {
          event.preventDefault();
          choose(picks[0].emoji);
        }
      }}
    />
    <div
      bind:this={grid}
      class="grid max-h-60 grid-cols-[repeat(auto-fill,minmax(38px,1fr))] gap-1 overflow-y-auto"
    >
      {#each picks as pick (pick.emoji)}<Button
          variant="ghost"
          class="text-xl"
          title={`:${pick.name}:`}
          aria-label={`:${pick.name}:`}
          onclick={() => choose(pick.emoji)}>{pick.emoji}</Button
        >{/each}
    </div>
  </DialogContent>
</Dialog>
