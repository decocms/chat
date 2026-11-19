<script lang="ts">
  import type { Snippet } from "svelte";
  import Label from "../studio/Label.svelte";
  let {
    id,
    label,
    hint,
    error,
    children,
  }: {
    id: string;
    label: string;
    hint?: string;
    error?: string;
    children: Snippet<
      [{ id: string; "aria-describedby"?: string; "aria-invalid": boolean }]
    >;
  } = $props();
  const descriptionId = $derived(
    error || hint ? `${id}-description` : undefined,
  );
</script>

<div class="grid grid-cols-1 gap-1.5 font-sans text-sm text-foreground">
  <Label for={id}>{label}</Label>
  {@render children({
    id,
    "aria-describedby": descriptionId,
    "aria-invalid": !!error,
  })}
  {#if error || hint}<p
      id={descriptionId}
      role={error ? "alert" : undefined}
      class={error
        ? "m-0 text-xs font-medium leading-4 text-foreground"
        : "m-0 text-xs leading-4 text-muted-foreground"}
    >
      {error || hint}
    </p>{/if}
</div>
