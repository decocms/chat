<script lang="ts">
  import { avatarVariants, type AvatarSize } from "./avatar";
  import { cn } from "./utils";

  /** `Avatar.Skeleton` in React: Svelte components carry no static members. */
  let {
    shape = "square",
    size = "base",
    class: className,
  }: {
    shape?: "circle" | "square";
    size?: AvatarSize;
    class?: string;
  } = $props();
</script>

<div
  class={cn(
    avatarVariants({ shape, size }),
    "tw:bg-muted tw:animate-pulse tw:motion-reduce:[animation-duration:0.01ms] tw:motion-reduce:[animation-iteration-count:1]",
    className,
  )}
></div>
