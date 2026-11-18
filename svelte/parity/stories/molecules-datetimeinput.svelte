<script lang="ts">
  import { untrack } from "svelte";
  import DateTimeInput from "../../lib/studio/DateTimeInput.svelte";

  let { story }: { story: string } = $props();

  const INITIAL: Record<string, string> = {
    "absolute-date": "2026-08-01T09:30:00.000Z",
  };
  let value = $state(untrack(() => INITIAL[story] ?? "now-24h"));
</script>

<!-- React renders each interpolation as its own text node, and glyph positions restart at each one. -->
{#snippet text(content: string)}{content}{/snippet}

<!-- Studio's root line height, which the parity page does not inherit. -->
<div class="leading-[1.5]">
  {#if story === "default" || story === "absolute-date"}
    <div class="w-80 space-y-2">
      <DateTimeInput bind:value />
      <p class="text-muted-foreground text-xs text-pretty">
        Value: {@render text(value)}
      </p>
    </div>
  {:else if story === "with-error"}
    <div class="w-80">
      <DateTimeInput value="now-24h" error="'From' must be before 'To'" />
    </div>
  {:else if story === "disabled"}
    <div class="w-80">
      <DateTimeInput value="now-24h" disabled />
    </div>
  {/if}
</div>
