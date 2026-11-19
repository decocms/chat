<script lang="ts">
  import type { Snippet } from "svelte";
  import { useFormField } from "./form";

  type FormControlProps = {
    "data-slot": "form-control";
    id: string;
    "aria-describedby": string;
    "aria-invalid": "true" | "false";
  };

  /** Wires the control to its field. React's `Slot` became the `child` snippet: spread `props` on your own input. */
  let { child }: { child: Snippet<[{ props: FormControlProps }]> } = $props();

  const field = useFormField();
  const control = $derived<FormControlProps>({
    "data-slot": "form-control",
    id: field.formItemId,
    "aria-describedby": field.invalid
      ? `${field.formDescriptionId} ${field.formMessageId}`
      : field.formDescriptionId,
    "aria-invalid": field.invalid ? "true" : "false",
  });
</script>

{@render child({ props: control })}
