<script lang="ts">
  import { Select as SelectPrimitive } from "bits-ui";

  let { ref = $bindable(null), ...rest }: SelectPrimitive.ValueProps = $props();
</script>

<SelectPrimitive.Value bind:ref data-slot="select-value" {...rest} />
