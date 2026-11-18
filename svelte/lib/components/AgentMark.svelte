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
    size?: "3xs" | "2xs" | "xs" | "sm" | "base";
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
  class={cn("shrink-0 font-normal", className)}
>
  {#snippet fallback()}{#if tint}<span
        data-agent-tile={agentProvider(via)}
        class={cn(
          // leading-none: the inherited line height pushed the glyph below the tile's center (most visible in the tiny badges).
          "grid size-full place-items-center leading-none",
          AGENT_TILES[agentProvider(via)],
        )}>{glyph}</span
      >{:else}{glyph}{/if}{/snippet}
</Avatar>
