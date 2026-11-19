<script lang="ts">
  import type { SVGAttributes } from "svelte/elements";
  import type { IconNode } from "./icons";
  /** One Untitled UI icon, drawn exactly as the React package draws it. */
  let {
    icon,
    size = 24,
    class: className,
    ...rest
  }: Omit<SVGAttributes<SVGSVGElement>, "style" | "class" | "children"> & {
    icon: IconNode;
    size?: number;
    class?: string;
  } = $props();
</script>

<svg
  viewBox="0 0 24 24"
  width={size}
  height={size}
  stroke="currentColor"
  stroke-width="2"
  fill="none"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  {...rest}
  class={className}
>
  {#each icon as [tag, attributes]}
    <svelte:element this={tag} {...attributes} />
  {/each}
</svg>
