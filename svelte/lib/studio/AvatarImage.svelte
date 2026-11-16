<script lang="ts">
  import { Avatar as AvatarPrimitive } from "bits-ui";
  import { cn } from "./utils";

  let {
    class: className,
    ref = $bindable(null),
    ...rest
  }: Omit<AvatarPrimitive.ImageProps, "style" | "class"> & {
    class?: string;
  } = $props();
</script>

<AvatarPrimitive.Image
  bind:ref
  data-slot="avatar-image"
  {...rest}
  class={cn("tw:aspect-square tw:size-full", className)}
/>
