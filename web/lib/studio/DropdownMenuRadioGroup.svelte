<script lang="ts">
  import { DropdownMenu as DropdownMenuPrimitive } from "bits-ui";

  let {
    value = $bindable(""),
    ref = $bindable(null),
    ...rest
  }: DropdownMenuPrimitive.RadioGroupProps = $props();
</script>

<DropdownMenuPrimitive.RadioGroup
  bind:ref
  bind:value
  data-slot="dropdown-menu-radio-group"
  {...rest}
/>
