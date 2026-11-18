<script lang="ts" module>
  /** Inline styles are not allowed here, so each diameter the design system uses is a class. */
  const SIZES = {
    16: "size-4",
    20: "size-5",
    24: "size-6",
    26: "size-[26px]",
    28: "size-7",
    32: "size-8",
    40: "size-10",
    48: "size-12",
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
    "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-green-dark",
    SIZES[size],
    className,
  )}
>
  <img
    {src}
    {alt}
    class="size-2/3 object-contain [image-rendering:pixelated]"
  />
</span>
