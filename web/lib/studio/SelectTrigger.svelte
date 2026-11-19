<script lang="ts">
  import { Select as SelectPrimitive } from "bits-ui";
  import Icon from "./Icon.svelte";
  import { ChevronDown } from "./icons";
  import { cn } from "./utils";

  /** `outline` is a form field, cornered like an input; `filled` a grey pill for toolbars and filters; `pill` a picker beside outline buttons. */
  let {
    class: className,
    size = "default",
    variant = "outline",
    children,
    ref = $bindable(null),
    ...rest
  }: Omit<SelectPrimitive.TriggerProps, "child"> & {
    size?: "xs" | "sm" | "default";
    variant?: "outline" | "filled" | "pill";
  } = $props();
</script>

<SelectPrimitive.Trigger
  bind:ref
  data-slot="select-trigger"
  data-size={size}
  data-variant={variant}
  class={cn(
    "data-[placeholder]:text-subtle-foreground [&_svg:not([class*='text-'])]:text-muted-foreground focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring focus-visible:outline-offset-2 aria-invalid:bg-destructive/10 aria-invalid:shadow-[inset_0_0_0_1px_var(--vb-destructive)] flex w-fit cursor-pointer items-center justify-between gap-1.5 px-3 text-sm whitespace-nowrap transition-[color,background-color,box-shadow] outline-none disabled:text-subtle-foreground disabled:pointer-events-none disabled:cursor-not-allowed",
    "data-[variant=outline]:rounded-[var(--vb-studio-control-radius,0.625rem)] data-[variant=outline]:bg-[var(--vb-studio-input-background)] data-[variant=outline]:shadow-edge data-[variant=outline]:hover:bg-sidebar",
    "data-[variant=filled]:rounded-full data-[variant=filled]:bg-muted data-[variant=filled]:hover:bg-secondary-hover",
    "data-[variant=pill]:rounded-full data-[variant=pill]:bg-card data-[variant=pill]:shadow-edge data-[variant=pill]:hover:bg-[var(--vb-studio-outline-hover-background)]",
    "data-[size=default]:h-[var(--vb-studio-control-height,2.25rem)] data-[size=default]:pl-4 data-[size=sm]:h-8 data-[size=xs]:h-7 data-[size=xs]:px-2.5 data-[size=xs]:text-xs data-[size=xs]:font-medium",
    "*:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
    className,
  )}
  {...rest}
>
  {@render children?.()}
  <Icon icon={ChevronDown} class="size-3.5 stroke-[1.5]" />
</SelectPrimitive.Trigger>
