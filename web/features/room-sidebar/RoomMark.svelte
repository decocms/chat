<script lang="ts">
  import OrgAvatar from "../../lib/components/OrgAvatar.svelte";
  import Avatar from "../../lib/studio/Avatar.svelte";
  import type { AvatarSize } from "../../lib/studio/avatar";
  import { cn } from "../../lib/studio/utils";
  /** The room's icon when it has one, else the marbled tile its title draws. */
  let {
    title,
    src,
    size = "xs",
    class: className,
  }: {
    title: string;
    src?: string;
    size?: AvatarSize;
    class?: string;
  } = $props();
</script>

{#if src}<Avatar
    {size}
    url={src}
    fallback={title}
    aria-hidden="true"
    data-room-mark="icon"
    class={cn("shrink-0", className)}
  />{:else}<span data-room-mark="marble" class="contents"
    ><OrgAvatar name={title} {size} class={cn("shrink-0", className)} /></span
  >{/if}
