<script lang="ts">
  import Button from "./Button.svelte";
  import Icon from "./Icon.svelte";
  import Tip from "./Tip.svelte";
  import type { ButtonProps } from "./button";
  import type { IconName } from "./icons";
  let {
    label,
    icon,
    title,
    tip,
    variant = "ghost",
    ref = $bindable(null),
    ...rest
  }: Omit<ButtonProps, "children" | "size" | "aria-label"> & {
    label: string;
    icon: IconName;
    /** Show the label in the styled tooltip (side given) instead of the native `title`. */
    tip?: "top" | "right" | "bottom" | "left";
  } = $props();
</script>

{#snippet button(props: Record<string, unknown>)}
  <Button
    {...props}
    {...rest}
    {variant}
    bind:ref
    size="icon"
    aria-label={label}
    title={tip ? undefined : (title ?? label)}><Icon name={icon} /></Button
  >
{/snippet}
{#if tip}<Tip
    label={title ?? label}
    side={tip}
    trigger={button}
  />{:else}{@render button({})}{/if}
