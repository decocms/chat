<script lang="ts">
  /**
   * The strip beside a rail tile, as in Discord: tall when the tile is the
   * current page, otherwise a small dot that grows into a short bar on hover.
   * Every room has it, whatever it contains. On the phone row (below 901px)
   * the same strip runs along the bottom of the tile.
   * The parent tile must be `relative` and a `group`.
   */
  let { state }: { state: "selected" | "idle" } = $props();
</script>

<span
  aria-hidden="true"
  data-rail-pill={state}
  class={[
    "tw:pointer-events-none tw:absolute tw:bg-foreground tw:transition-[height,width] tw:duration-150 tw:motion-reduce:transition-none",
    "tw:bottom-0 tw:left-1/2 tw:h-1 tw:-translate-x-1/2 tw:rounded-t-full",
    "tw:min-[901px]:bottom-auto tw:min-[901px]:-left-2 tw:min-[901px]:top-1/2 tw:min-[901px]:w-1 tw:min-[901px]:-translate-x-0 tw:min-[901px]:-translate-y-1/2 tw:min-[901px]:rounded-t-none tw:min-[901px]:rounded-r-full",
    state === "selected" && "tw:w-10 tw:min-[901px]:h-10 tw:min-[901px]:w-1",
    state === "idle" &&
      "tw:w-2 tw:min-[901px]:h-2 tw:min-[901px]:w-1 tw:group-hover:w-5 tw:min-[901px]:group-hover:h-5 tw:min-[901px]:group-hover:w-1",
  ]}
></span>
