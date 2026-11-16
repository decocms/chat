<script lang="ts">
  import Avatar from "./Avatar.svelte";
  import {
    AGENT_TILES,
    agentMark,
    agentProvider,
    type AvatarPx,
  } from "./avatar";
  let {
    via,
    mark,
    px = 32,
    tint = false,
    class: className,
  }: {
    /** The agent's model or client name; picks its mark. */
    via?: string | null;
    /** An explicit glyph (e.g. ✦ for @vibe) instead of the one `via` picks. */
    mark?: string;
    /** Rendered edge (16, 24 or 32px): sets the size and the radius. */
    px?: AvatarPx;
    /** Color the tile by provider (Claude orange, Codex black, Gemini blue…). */
    tint?: boolean;
    class?: string;
  } = $props();
</script>

<Avatar
  kind="agent"
  name={via || "agent"}
  mark={mark ?? agentMark(via)}
  {px}
  tone={tint ? AGENT_TILES[agentProvider(via)] : undefined}
  class={className}
/>
