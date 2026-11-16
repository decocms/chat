<script lang="ts" module>
  /** Inline styles are not allowed here, so each diameter the design system uses is a class. */
  const SIZES = {
    16: "tw:size-4",
    20: "tw:size-5",
    24: "tw:size-6",
    26: "tw:size-[26px]",
    28: "tw:size-7",
    32: "tw:size-8",
    40: "tw:size-10",
    48: "tw:size-12",
  } as const;
  export type AgentAvatarSize = keyof typeof SIZES;
</script>

<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";
  import { cn } from "./utils";

  /** The agent's face on a dark-green circle: 20 in a small button, 26 in "Ask", 32 in a chat header. */
  let {
    src,
    size = 24,
    alt = "",
    class: className,
    ...rest
  }: Omit<HTMLAttributes<HTMLSpanElement>, "style" | "class" | "children"> & {
    src: string;
    size?: AgentAvatarSize;
    alt?: string;
    class?: string;
  } = $props();
</script>

<span
  data-slot="agent-avatar"
  {...rest}
  class={cn(
    "tw:inline-flex tw:shrink-0 tw:items-center tw:justify-center tw:overflow-hidden tw:rounded-full tw:bg-brand-green-dark",
    SIZES[size],
    className,
  )}
>
  <img
    {src}
    {alt}
    class="tw:size-2/3 tw:object-contain tw:[image-rendering:pixelated]"
  />
</span>
