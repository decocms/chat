<script lang="ts">
  import Skeleton from "../../lib/studio/Skeleton.svelte";
  // The home's one loading state: the headline and the ask box as bars. The
  // shell draws it with `page` while the home's own module loads (an empty
  // square where the cube goes), and the home keeps the same bars until your
  // account answers, so nothing moves between the two.
  let { label, page = false }: { label: string; page?: boolean } = $props();
</script>

{#snippet bars()}<div role="status" aria-label={label}>
    <Skeleton class="tw:mt-3 tw:h-9 tw:w-80 tw:max-w-[70vw]" />
    <Skeleton
      class="tw:mx-auto tw:mt-7 tw:h-12 tw:w-[576px] tw:max-w-[85vw] tw:rounded-full"
    />
  </div>{/snippet}

{#if page}<main
    aria-busy="true"
    class="tw:relative tw:min-h-full tw:bg-background tw:font-sans tw:text-sm tw:leading-6 tw:text-foreground"
  >
    <div class="tw:flex tw:flex-col tw:items-center tw:px-4 tw:pt-4 tw:sm:px-8">
      <section
        class="tw:mt-[10vh] tw:flex tw:flex-col tw:items-center tw:max-sm:mt-4"
      >
        <div
          aria-hidden="true"
          class="tw:size-[200px] tw:max-sm:size-[112px]"
        ></div>
        {@render bars()}
      </section>
    </div>
  </main>{:else}{@render bars()}{/if}
