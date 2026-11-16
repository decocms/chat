<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { useFormField } from "./form";
  import { cn } from "./utils";

  /** The field's error message, or its children while the field is valid; renders nothing when there is neither. */
  let {
    class: className,
    ref = $bindable(null),
    children,
    ...rest
  }: Omit<
    HTMLAttributes<HTMLParagraphElement>,
    "style" | "class" | "children"
  > & {
    class?: string;
    ref?: HTMLParagraphElement | null;
    children?: Snippet;
  } = $props();

  const field = useFormField();
  const message = $derived(
    field.error ? String(field.error.message ?? "") : undefined,
  );
</script>

{#if message !== undefined ? message !== "" : children}
  <p
    bind:this={ref}
    data-slot="form-message"
    id={field.formMessageId}
    {...rest}
    class={cn("tw:text-destructive tw:text-sm tw:text-pretty", className)}
  >
    {#if message !== undefined}{message}{:else}{@render children?.()}{/if}
  </p>
{/if}
