<script lang="ts">
  import type { Snippet } from "svelte";
  import { setFormFieldContext, type FormFieldError } from "./form";

  /** Names one field and carries its error to the parts inside. React's `FormField` is a react-hook-form `Controller`; here the caller owns the value and the validation. */
  let {
    name,
    error,
    children,
  }: {
    name: string;
    /** The validation message, or an object with a `message`; leave empty while the field is valid. */
    error?: FormFieldError;
    children?: Snippet;
  } = $props();

  setFormFieldContext(() => ({ name, error }));
</script>

{@render children?.()}
