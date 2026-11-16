<script lang="ts">
  import OrgAvatar from "../../lib/components/OrgAvatar.svelte";
  import Avatar from "../../lib/studio/Avatar.svelte";
  import { cn } from "../../lib/studio/utils";
  /** The room's icon when it has one, else the marbled tile its title draws. */
  let {
    title,
    src,
    class: className,
  }: { title: string; src?: string; class?: string } = $props();
</script>

{#if src}<Avatar
    size="xs"
    url={src}
    fallback={title}
    aria-hidden="true"
    data-room-mark="icon"
    class={cn("tw:shrink-0", className)}
  />{:else}<span data-room-mark="marble" class="tw:contents"
    ><OrgAvatar
      name={title}
      size="xs"
      class={cn("tw:shrink-0", className)}
    /></span
  >{/if}
