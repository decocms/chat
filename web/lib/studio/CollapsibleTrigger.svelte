<script lang="ts">
  import { Collapsible as CollapsiblePrimitive } from "bits-ui";

  /** `child` stands in for React's `asChild`. */
  let { ref = $bindable(null), ...rest }: CollapsiblePrimitive.TriggerProps =
    $props();
</script>

<CollapsiblePrimitive.Trigger
  bind:ref
  data-slot="collapsible-trigger"
  {...rest}
/>
