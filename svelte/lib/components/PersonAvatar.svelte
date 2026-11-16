<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";
  import Avatar from "../studio/Avatar.svelte";
  import type { AvatarSize } from "../studio/avatar";
  import { beam } from "./boring";

  /** A person: their picture when they have one, else the face their name draws. */
  let {
    name,
    url,
    size = "xs",
    class: className,
    ...rest
  }: Omit<HTMLAttributes<HTMLDivElement>, "style" | "class" | "children"> & {
    name: string;
    url?: string;
    size?: AvatarSize;
    class?: string;
  } = $props();
  const face = $derived(beam(name));
</script>

{#snippet generated()}
  <svg viewBox="0 0 36 36" fill="none" aria-hidden="true" class="tw:size-full">
    <rect width="36" height="36" fill={face.background} />
    <rect
      width="36"
      height="36"
      transform={face.wrapperTransform}
      fill={face.wrapper}
      rx={face.wrapperRadius}
    />
    <g transform={face.faceTransform}>
      {#if face.smile}
        <path d={face.mouth} stroke={face.face} stroke-linecap="round" />
      {:else}
        <path d={face.mouth} fill={face.face} />
      {/if}
      <rect
        x={face.leftEye}
        y="14"
        width="1.5"
        height="2"
        rx="1"
        fill={face.face}
      />
      <rect
        x={face.rightEye}
        y="14"
        width="1.5"
        height="2"
        rx="1"
        fill={face.face}
      />
    </g>
  </svg>
{/snippet}

<Avatar
  {...rest}
  shape="circle"
  {size}
  {url}
  fallback={generated}
  aria-hidden="true"
  class={className}
/>
