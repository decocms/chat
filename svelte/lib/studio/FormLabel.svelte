<script lang="ts">
  import type { ComponentProps } from "svelte";
  import { useFormField } from "./form";
  import Label from "./Label.svelte";
  import { cn } from "./utils";

  /** The field's label: points at the control and turns red while the field is invalid. */
  let {
    class: className,
    ref = $bindable(null),
    ...rest
  }: ComponentProps<typeof Label> = $props();

  const field = useFormField();
</script>

<Label
  bind:ref
  data-slot="form-label"
  data-error={field.invalid ? "true" : "false"}
  class={cn("text-foreground data-[error=true]:text-destructive", className)}
  for={field.formItemId}
  {...rest}
/>
