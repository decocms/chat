<script lang="ts">
  import type { Snippet } from "svelte";
  import EmptyState from "../studio/EmptyState.svelte";
  import Icon from "../studio/Icon.svelte";
  import { Check, Inbox01, type IconNode } from "../studio/icons";
  let {
    title,
    description,
    icon: glyphName = Inbox01,
    children,
  }: {
    title: string;
    description?: string;
    /** A Studio icon; "inbox" and "check" are the names earlier callers pass. */
    icon?: IconNode | "inbox" | "check";
    children?: Snippet;
  } = $props();
  const glyph = $derived(
    glyphName === "check" ? Check : glyphName === "inbox" ? Inbox01 : glyphName,
  );
</script>

<EmptyState size="inline" {title} {description} {children}>
  {#snippet icon()}<Icon icon={glyph} />{/snippet}
</EmptyState>
