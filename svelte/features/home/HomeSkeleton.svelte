<script lang="ts">
  import Skeleton from "../../lib/studio/Skeleton.svelte";
  // The home's one loading state: the headline and the ask box as bars. The
  // shell draws it with `page` while the home's own module loads (an empty
  // square where the cube goes), and the home keeps the same bars until your
  // account answers, so nothing moves between the two.
  let { label, page = false }: { label: string; page?: boolean } = $props();
</script>

{#snippet bars()}<div role="status" aria-label={label}>
    <Skeleton class="mt-3 h-9 w-80 max-w-[70vw]" />
    <Skeleton class="mx-auto mt-7 h-12 w-[576px] max-w-[85vw] rounded-full" />
  </div>{/snippet}

{#if page}<main
    aria-busy="true"
    class="relative min-h-full bg-background font-sans text-sm leading-6 text-foreground"
  >
    <div class="flex flex-col items-center px-4 pt-4 md:px-8">
      <section class="mt-[10vh] flex flex-col items-center max-md:mt-4">
        <div aria-hidden="true" class="size-[200px] max-md:size-[112px]"></div>
        {@render bars()}
      </section>
    </div>
  </main>{:else}{@render bars()}{/if}
