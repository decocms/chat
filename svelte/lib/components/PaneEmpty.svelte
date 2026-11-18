<script lang="ts">
  import type { Snippet } from "svelte";
  import EmptyState from "../studio/EmptyState.svelte";
  import Icon from "../studio/Icon.svelte";
  import type { IconNode } from "../studio/icons";

  /** A side-panel tab with nothing in it yet. Same anatomy on every tab: the tab's own icon,
   * what will be here, why it helps, then the two ways in: do it yourself (`action`),
   * or hand it to your Claude (`ask`: a prompt; a click puts it in the composer, never sends). */
  let {
    icon: glyph,
    title,
    description,
    action,
    ask,
    askLabel,
    onask,
  }: {
    icon: IconNode;
    title: string;
    description: string;
    action?: Snippet;
    /** The prompt for your Claude, in the person's language. */
    ask?: string;
    /** "Ask your Claude", translated by the caller. */
    askLabel?: string;
    onask?: (prompt: string) => void;
  } = $props();
</script>

<EmptyState size="inline" {title} {description} buttonComponent={action}>
  {#snippet icon()}<Icon icon={glyph} />{/snippet}
  {#if ask && onask}<button
      type="button"
      data-pane-ask
      class="flex max-w-xs cursor-pointer items-start gap-2 rounded-xl border-0 bg-agent-claude/10 px-3 py-2 text-left font-sans text-[0.8125rem] leading-snug text-foreground transition-colors hover:bg-agent-claude/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      onclick={() => onask(ask)}
      ><span aria-hidden="true" class="font-semibold text-agent-claude-text"
        >✻</span
      ><span
        ><small class="block text-xs text-muted-foreground">{askLabel}</small
        >“{ask}”</span
      ></button
    >{/if}
</EmptyState>
