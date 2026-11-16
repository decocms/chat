<script lang="ts">
  import Avatar from "../studio/Avatar.svelte";
  import { cn } from "../studio/utils";
  import { AGENT_TILES, agentMark, agentProvider } from "./agent";
  let {
    via,
    mark,
    size = "sm",
    tint = false,
    class: className,
  }: {
    /** The agent's model or client name; picks its mark. */
    via?: string | null;
    /** An explicit glyph (✦ for @vibe) instead of the one `via` picks. */
    mark?: string;
    size?: "2xs" | "xs" | "sm";
    /** Color the tile by provider (Claude orange, Codex black, Gemini blue…). */
    tint?: boolean;
    class?: string;
  } = $props();
  const glyph = $derived(mark ?? agentMark(via));
</script>

<Avatar
  aria-hidden="true"
  data-avatar="agent"
  shape="square"
  {size}
  muted
  class={cn("tw:shrink-0 tw:font-normal", className)}
>
  {#snippet fallback()}{#if tint}<span
        data-agent-tile={agentProvider(via)}
        class={cn(
          "tw:grid tw:size-full tw:place-items-center",
          AGENT_TILES[agentProvider(via)],
        )}>{glyph}</span
      >{:else}{glyph}{/if}{/snippet}
</Avatar>
