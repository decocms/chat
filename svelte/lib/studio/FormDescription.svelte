<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { useFormField } from "./form";
  import { cn } from "./utils";

  /** Help text under the control; the control is described by it. */
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
</script>

<p
  bind:this={ref}
  data-slot="form-description"
  id={field.formDescriptionId}
  {...rest}
  class={cn("text-muted-foreground text-sm text-pretty", className)}
>
  {@render children?.()}
</p>
