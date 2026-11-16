<script lang="ts" module>
  // Vanilla `color(email)` in public/app.html: same order and hash, so a person without a
  // picture gets the same hue in both UIs (tokens darkened for contrast, see tailwind.css).
  const AVATAR_CLASSES = [
    "tw:bg-avatar-0",
    "tw:bg-avatar-1",
    "tw:bg-avatar-2",
    "tw:bg-avatar-3",
    "tw:bg-avatar-4",
    "tw:bg-avatar-5",
    "tw:bg-avatar-6",
    "tw:bg-avatar-7",
  ] as const;
  export const avatarColorIndex = (seed: string) =>
    [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0) %
    AVATAR_CLASSES.length;
</script>

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
    seed,
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
    /** What picks the color, the person's email when known (as vanilla); else the name. */
    seed?: string;
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
  const picture = $derived(Boolean(src && !failed));
  // Only a person's initials are colored; pictures and agent marks keep the neutral frame.
  const colored = $derived(!picture && !mark && kind === "person");
  const colorIndex = $derived(avatarColorIndex(seed || name.trim() || "?"));
</script>

<span
  aria-hidden="true"
  data-avatar={kind}
  data-avatar-color={colored ? colorIndex : undefined}
  class={cn(
    "tw:inline-grid tw:shrink-0 tw:place-items-center tw:overflow-hidden tw:font-sans tw:text-xs tw:font-medium",
    !colored && "tw:border tw:border-border tw:bg-muted tw:text-foreground",
    colored && AVATAR_CLASSES[colorIndex],
    colored && "tw:text-avatar-foreground",
    avatarSize(px),
    avatarShape(kind, px),
    className,
  )}
>
  {#if picture}<img
      {src}
      alt=""
      class="tw:size-full tw:object-cover"
      onerror={() => {
        failed = true;
      }}
    />{:else}{mark || initials || "?"}{/if}
</span>
