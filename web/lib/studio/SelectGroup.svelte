<script lang="ts">
  import { Select as SelectPrimitive } from "bits-ui";

  let { ref = $bindable(null), ...rest }: SelectPrimitive.GroupProps = $props();
</script>

<SelectPrimitive.Group bind:ref data-slot="select-group" {...rest} />
