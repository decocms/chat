<script lang="ts">
  /**
   * The current page's mark beside a rail tile: a 3×24px foreground bar on the
   * rail's left edge (along the bottom on the phone row, below 901px). An idle
   * tile shows nothing. The parent tile must be `relative`.
   */
  let { state }: { state: "selected" | "idle" } = $props();
</script>

{#if state === "selected"}<span
    aria-hidden="true"
    data-rail-pill={state}
    class="tw:pointer-events-none tw:absolute tw:-bottom-2 tw:left-1/2 tw:h-[3px] tw:w-6 tw:-translate-x-1/2 tw:rounded-t-full tw:bg-foreground tw:min-[901px]:top-1/2 tw:min-[901px]:bottom-auto tw:min-[901px]:-left-4 tw:min-[901px]:h-6 tw:min-[901px]:w-[3px] tw:min-[901px]:translate-x-0 tw:min-[901px]:-translate-y-1/2 tw:min-[901px]:rounded-t-none tw:min-[901px]:rounded-r-full"
  ></span>{/if}
