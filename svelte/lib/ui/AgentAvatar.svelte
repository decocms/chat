<script lang="ts">
  import Avatar from "./Avatar.svelte";
  import { agentMark, type AvatarPx } from "./avatar";
  let {
    via,
    mark,
    px = 32,
    class: className,
  }: {
    /** The agent's model or client name; picks its mark. */
    via?: string | null;
    /** An explicit glyph (e.g. ✦ for @vibe) instead of the one `via` picks. */
    mark?: string;
    /** Rendered edge (16, 24 or 32px): sets the size and the radius. */
    px?: AvatarPx;
    class?: string;
  } = $props();
</script>

<Avatar
  kind="agent"
  name={via || "agent"}
  mark={mark ?? agentMark(via)}
  {px}
  class={className}
/>
