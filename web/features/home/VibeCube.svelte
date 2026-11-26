<script lang="ts">
  import { cn } from "../../lib/studio/utils";
  import { vibeCube } from "./cube";
  /**
   * @vibe's face: the rail's cube, at rest, at an avatar's size. One shared
   * picture per theme (see `vibeCube`), so a channel full of @vibe costs one
   * WebGL draw. The picture is a third larger than the tile, as on the rail:
   * the shader leaves room around the cube. Without WebGL it falls back to ✦.
   */
  type Size = "3xs" | "2xs" | "xs" | "sm" | "base" | "xl";
  let { size = "sm", class: className }: { size?: Size; class?: string } =
    $props();
  const box: Record<Size, string> = {
    "3xs": "size-3 text-[0.4375rem]",
    "2xs": "size-4 text-[0.5625rem]",
    xs: "size-6 text-[0.625rem]",
    sm: "size-8 text-xs",
    base: "size-10 text-sm",
    xl: "size-16 text-2xl",
  };
</script>

<span
  aria-hidden="true"
  data-avatar="vibe"
  class={cn(
    "relative inline-grid shrink-0 place-items-center leading-none select-none",
    box[size],
    className,
  )}
  >{#if $vibeCube}<img
      src={$vibeCube}
      alt=""
      draggable="false"
      class="pointer-events-none absolute -inset-1/6 size-4/3 max-w-none"
    />{:else}✦{/if}</span
>
