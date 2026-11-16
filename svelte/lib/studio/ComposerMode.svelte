<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";
  import { composerModeVariants, type ComposerModeVariants } from "./composer";
  import Icon from "./Icon.svelte";
  import { X } from "./icons";
  import { cn } from "./utils";

  /** An active mode, e.g. Plan or Web search. Its icon turns into an × on hover. */
  let {
    icon,
    tone,
    dismissLabel,
    type = "button",
    class: className,
    ref = $bindable(null),
    children,
    ...rest
  }: ComposerModeVariants &
    Omit<HTMLButtonAttributes, "style" | "class" | "children"> & {
      icon: Snippet;
      /** Accessible name of the dismiss action, translated by the caller. */
      dismissLabel: string;
      class?: string;
      ref?: HTMLButtonElement | null;
      children?: Snippet;
    } = $props();
</script>

<button
  bind:this={ref}
  {type}
  data-slot="composer-mode"
  aria-label={dismissLabel}
  {...rest}
  class={cn(composerModeVariants({ tone }), className)}
>
  <span class="tw:group-hover/mode:hidden tw:[&_svg]:text-current!"
    >{@render icon()}</span
  >
  <Icon icon={X} class="tw:hidden tw:text-current! tw:group-hover/mode:block" />
  {@render children?.()}
</button>
