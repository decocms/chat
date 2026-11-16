<script lang="ts">
  import Avatar from "../studio/Avatar.svelte";
  import type { AvatarSize } from "../studio/avatar";
  import { marble } from "./boring";

  /** An organization or a room: the marbled tile its name draws. */
  let {
    name,
    size = "md",
    class: className,
  }: {
    name: string;
    size?: AvatarSize;
    class?: string;
  } = $props();
  const uid = $props.id();
  const mark = $derived(marble(name));
</script>

{#snippet generated()}
  <svg
    viewBox="0 0 80 80"
    preserveAspectRatio="xMidYMid slice"
    fill="none"
    aria-hidden="true"
    class="tw:size-full"
  >
    <defs>
      <filter
        id={uid}
        filterUnits="userSpaceOnUse"
        color-interpolation-filters="sRGB"
      >
        <feFlood flood-opacity="0" result="BackgroundImageFix" />
        <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
        <feGaussianBlur stdDeviation="7" result="effect1_foregroundBlur" />
      </filter>
    </defs>
    <rect width="80" height="80" fill={mark.background} />
    <path
      filter={`url(#${uid})`}
      d="M32.414 59.35L50.376 70.5H72.5v-71H33.728L26.5 13.381l19.057 27.08L32.414 59.35z"
      fill={mark.first}
      transform={mark.firstTransform}
    />
    <path
      filter={`url(#${uid})`}
      class="tw:mix-blend-overlay"
      d="M22.216 24L0 46.75l14.108 38.129L78 86l-3.081-59.276-22.378 4.005 12.972 20.186-23.35 27.395L22.215 24z"
      fill={mark.second}
      transform={mark.secondTransform}
    />
  </svg>
{/snippet}

<Avatar
  shape="square"
  {size}
  fallback={generated}
  aria-hidden="true"
  class={className}
/>
