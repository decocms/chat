<script lang="ts">
  import { cn } from "./utils";
  import {
    avatarShape,
    avatarSize,
    type AvatarKind,
    type AvatarPx,
  } from "./avatar";
  let {
    name,
    src,
    kind = "person",
    mark,
    px = 32,
    class: className,
  }: {
    name: string;
    src?: string;
    /** person: a circle; agent: a rounded square with the room tile radius. */
    kind?: AvatarKind;
    /** A glyph shown instead of initials when there is no image (agent marks). */
    mark?: string;
    /** Rendered edge (16, 24 or 32px): sets the size and the agent radius. */
    px?: AvatarPx;
    class?: string;
  } = $props();
  let failed = $state(false);
  $effect(() => {
    void src;
    failed = false;
  });
  const initials = $derived(
    name
      .trim()
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => Array.from(part)[0])
      .join("")
      .toLocaleUpperCase(),
  );
</script>

<span
  aria-hidden="true"
  data-avatar={kind}
  class={cn(
    "tw:inline-grid tw:shrink-0 tw:place-items-center tw:overflow-hidden tw:border tw:border-border tw:bg-muted tw:font-sans tw:text-xs tw:font-medium tw:text-foreground",
    avatarSize(px),
    avatarShape(kind, px),
    className,
  )}
>
  {#if src && !failed}<img
      {src}
      alt=""
      class="tw:size-full tw:object-cover"
      onerror={() => {
        failed = true;
      }}
    />{:else}{mark || initials || "?"}{/if}
</span>
