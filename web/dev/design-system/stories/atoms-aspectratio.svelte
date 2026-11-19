<script lang="ts">
  import AspectRatio from "../../../lib/studio/AspectRatio.svelte";
  import Icon from "../../../lib/studio/Icon.svelte";
  import { Image01 } from "../../../lib/studio/icons";

  let { story }: { story: string } = $props();
</script>

{#snippet placeholder(label: string)}
  <div
    class="flex h-full w-full flex-col items-center justify-center gap-2 rounded-md bg-muted text-muted-foreground"
  >
    <Icon icon={Image01} class="size-6" />
    <span class="text-sm">{label}</span>
  </div>
{/snippet}

<!-- Studio's root line height, which the parity page does not inherit. -->
<div class="leading-[1.5]">
  {#if story === "default"}
    <div class="w-96">
      <AspectRatio ratio={16 / 9}>
        {@render placeholder("Project cover (16:9)")}
      </AspectRatio>
    </div>
  {:else if story === "square"}
    <div class="w-48">
      <AspectRatio ratio={1}>
        {@render placeholder("Logo (1:1)")}
      </AspectRatio>
    </div>
  {:else if story === "portrait"}
    <div class="w-48">
      <AspectRatio ratio={3 / 4}>
        {@render placeholder("Poster (3:4)")}
      </AspectRatio>
    </div>
  {/if}
</div>
