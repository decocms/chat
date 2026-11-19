<script lang="ts">
  import type { Snippet } from "svelte";
  import EmptyState from "../studio/EmptyState.svelte";
  import Icon from "../studio/Icon.svelte";
  import type { IconName } from "../studio/icons";
  let {
    title,
    description,
    icon: glyphName = "inbox-01",
    children,
  }: {
    title: string;
    description?: string;
    /** A Studio icon; "inbox" is the name earlier callers pass. */
    icon?: IconName | "inbox";
    children?: Snippet;
  } = $props();
  const glyph = $derived(glyphName === "inbox" ? "inbox-01" : glyphName);
</script>

<EmptyState size="inline" {title} {description} {children}>
  {#snippet icon()}<Icon icon={glyph} />{/snippet}
</EmptyState>
