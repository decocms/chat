<script lang="ts">
  import type { SVGAttributes } from "svelte/elements";
  import type { IconName } from "./icons";
  // One static sprite for all icons (generated from icons.ts). `no-inline` keeps it a file:
  // a `<use>` cannot point into a data: URL, and the browser caches the file once.
  import sprite from "./icons.svg?no-inline";
  /** One Untitled UI icon, drawn exactly as the React package draws it. */
  let {
    icon,
    size = 24,
    class: className,
    ...rest
  }: Omit<SVGAttributes<SVGSVGElement>, "style" | "class" | "children"> & {
    icon: IconName;
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
  class={className}><use href="{sprite}#{icon}" /></svg
>
