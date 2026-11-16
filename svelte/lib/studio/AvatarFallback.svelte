<script lang="ts">
  import { Avatar as AvatarPrimitive } from "bits-ui";
  import { cn } from "./utils";

  let {
    class: className,
    ref = $bindable(null),
    ...rest
  }: Omit<AvatarPrimitive.FallbackProps, "style" | "class"> & {
    class?: string;
  } = $props();
</script>

<AvatarPrimitive.Fallback
  bind:ref
  data-slot="avatar-fallback"
  {...rest}
  class={cn(
    "tw:bg-muted tw:flex tw:size-full tw:items-center tw:justify-center tw:rounded-full",
    className,
  )}
/>
