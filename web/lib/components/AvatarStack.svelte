<script lang="ts" generics="T">
  import type { Snippet } from "svelte";
  /**
   * Overlapping faces, then "+N" in a circle of the same size (Gimenes #4309,
   * the phone's room bar). Each item sits on top of the one to its left, with a
   * ring in the page's color so they separate cleanly; "+N" and anything after
   * it (the read check) sit on top of everything. The face itself, with any
   * badge, comes from `face`.
   */
  let {
    items,
    key,
    more = 0,
    size = "md",
    face,
    after,
    class: className,
  }: {
    items: readonly T[];
    key: (item: T) => string;
    /** How many are left out: "+N" when above zero. */
    more?: number;
    size?: "sm" | "md";
    face: Snippet<[T]>;
    /** On top at the end, tucked into the last item (the read check). */
    after?: Snippet;
    class?: string;
  } = $props();
  const overlap: Record<"sm" | "md", string> = {
    sm: "-ml-1.5",
    md: "-ml-2",
  };
  // The check overlaps less and sits lower, so it never covers the "+N".
  const tuck: Record<"sm" | "md", string> = {
    sm: "-mb-1.5 -ml-1",
    md: "-mb-2 -ml-1.5",
  };
  const circle: Record<"sm" | "md", string> = {
    sm: "size-5 text-[0.5625rem]",
    md: "size-7 text-xs",
  };
</script>

<span class={["flex items-end", className]}
  >{#each items as item, i (key(item))}<span
      data-avatar-stack-item
      class={["relative flex", i > 0 && overlap[size]]}
      >{@render face(item)}</span
    >{/each}{#if more}<span
      data-avatar-stack-more
      class={[
        "relative z-10 flex shrink-0 items-center justify-center rounded-full bg-muted font-semibold tabular-nums leading-none text-muted-foreground ring-2 ring-background",
        circle[size],
        items.length > 0 && overlap[size],
      ]}>+{more}</span
    >{/if}{#if after}<span class={["relative z-20 flex", tuck[size]]}
      >{@render after()}</span
    >{/if}</span
>
