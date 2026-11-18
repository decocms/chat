<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";
  import { avatarKey, avatarUrl } from "../../../shared/avatar";
  import Avatar from "../studio/Avatar.svelte";
  import type { AvatarSize } from "../studio/avatar";
  import { beam } from "./boring";

  /**
   * A person, the one way every surface draws them: their picture at `version`
   * when they have one, else the face their email draws (seeded by the email,
   * so the same person looks the same everywhere, whatever label sits beside it).
   * Presentational: the caller passes the version it knows (`me.avatar`, a
   * room's `avatars`, a friend's `avatar`). No email = nobody (an epic
   * without an owner): the generic person icon.
   */
  let {
    email,
    version,
    size = "xs",
    class: className,
    ...rest
  }: Omit<HTMLAttributes<HTMLDivElement>, "style" | "class" | "children"> & {
    email: string | null | undefined;
    /** The picture's version (`users.avatar`); none = the generated face. */
    version?: number | null;
    size?: AvatarSize;
    class?: string;
  } = $props();
  const face = $derived(beam(avatarKey(email ?? "")));
  const url = $derived(email ? avatarUrl(email, version) : "icon://user");
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
  muted={!email}
  fallback={generated}
  aria-hidden="true"
  class={className}
/>
