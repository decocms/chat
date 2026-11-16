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
    "tw:data-[placeholder]:text-subtle-foreground tw:[&_svg:not([class*='text-'])]:text-muted-foreground tw:focus-visible:outline-2 tw:focus-visible:outline-solid tw:focus-visible:outline-ring tw:focus-visible:outline-offset-2 tw:aria-invalid:bg-destructive/10 tw:aria-invalid:shadow-[inset_0_0_0_1px_var(--vb-destructive)] tw:flex tw:w-fit tw:cursor-pointer tw:items-center tw:justify-between tw:gap-1.5 tw:px-3 tw:text-sm tw:whitespace-nowrap tw:transition-[color,background-color,box-shadow] tw:outline-none tw:disabled:text-subtle-foreground tw:disabled:pointer-events-none tw:disabled:cursor-not-allowed",
    "tw:data-[variant=outline]:rounded-[var(--vb-studio-control-radius,0.625rem)] tw:data-[variant=outline]:bg-[var(--vb-studio-input-background)] tw:data-[variant=outline]:shadow-edge tw:data-[variant=outline]:hover:bg-sidebar",
    "tw:data-[variant=filled]:rounded-full tw:data-[variant=filled]:bg-muted tw:data-[variant=filled]:hover:bg-secondary-hover",
    "tw:data-[variant=pill]:rounded-full tw:data-[variant=pill]:bg-card tw:data-[variant=pill]:shadow-edge tw:data-[variant=pill]:hover:bg-[var(--vb-studio-outline-hover-background)]",
    "tw:data-[size=default]:h-[var(--vb-studio-control-height,2.25rem)] tw:data-[size=default]:pl-4 tw:data-[size=sm]:h-8 tw:data-[size=xs]:h-7 tw:data-[size=xs]:px-2.5 tw:data-[size=xs]:text-xs tw:data-[size=xs]:font-medium",
    "tw:*:data-[slot=select-value]:line-clamp-1 tw:*:data-[slot=select-value]:flex tw:*:data-[slot=select-value]:items-center tw:*:data-[slot=select-value]:gap-2 tw:[&_svg]:pointer-events-none tw:[&_svg]:shrink-0 tw:[&_svg:not([class*='size-'])]:size-3.5",
    className,
  )}
  {...rest}
>
  {@render children?.()}
  <Icon icon={ChevronDown} class="tw:size-3.5 tw:stroke-[1.5]" />
</SelectPrimitive.Trigger>
