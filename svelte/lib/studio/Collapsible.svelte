<script lang="ts">
  import { Collapsible as CollapsiblePrimitive } from "bits-ui";

  /** Radix's `defaultOpen` is the initial `open`. */
  let {
    ref = $bindable(null),
    open = $bindable(false),
    ...rest
  }: CollapsiblePrimitive.RootProps = $props();
</script>

<CollapsiblePrimitive.Root
  bind:ref
  bind:open
  data-slot="collapsible"
  {...rest}
/>
