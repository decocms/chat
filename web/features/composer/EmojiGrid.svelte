<script lang="ts">
  // The emoji search and grid, inside EmojiPicker: a popover next to the 🙂 that opened it, or a phone's sheet.
  import Input from "../../lib/studio/Input.svelte";
  import Button from "../../lib/studio/Button.svelte";
  import { emojiPicks } from "./model";
  let {
    t,
    onpick,
    search = $bindable(null),
    grid = $bindable(null),
  }: {
    t: (text: string) => string;
    onpick: (value: string) => void;
    search?: HTMLInputElement | null;
    grid?: HTMLDivElement | null;
  } = $props();
  let query = $state("");
  const picks = $derived(emojiPicks(query));
</script>

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
      onpick(picks[0].emoji);
    }
  }}
/>
<div
  bind:this={grid}
  data-emoji-grid
  class="grid max-h-60 grid-cols-[repeat(auto-fill,minmax(38px,1fr))] gap-1 overflow-y-auto"
>
  {#each picks as pick (pick.emoji)}<Button
      variant="ghost"
      class="text-xl"
      title={`:${pick.name}:`}
      aria-label={`:${pick.name}:`}
      onclick={() => onpick(pick.emoji)}>{pick.emoji}</Button
    >{/each}
</div>
