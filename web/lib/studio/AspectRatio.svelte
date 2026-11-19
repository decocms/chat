<script lang="ts">
  import { AspectRatio as AspectRatioPrimitive } from "bits-ui";

  /** Ported from @decocms/ui `AspectRatio`: Bits UI sets the padding box the ratio needs. */
  let {
    ref = $bindable(null),
    ...rest
  }: Omit<AspectRatioPrimitive.RootProps, "style"> = $props();
</script>

<AspectRatioPrimitive.Root bind:ref data-slot="aspect-ratio" {...rest} />
