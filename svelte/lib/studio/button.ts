import { tv, type VariantProps } from "tailwind-variants";

/** Ported 1:1 from @decocms/ui `button.tsx`. A grey fill that darkens a step on hover; variables keep it overridable per layout. */
const SECONDARY =
  "tw:bg-[var(--vb-studio-secondary-background)] tw:text-[color:var(--vb-studio-secondary-foreground)] tw:shadow-[var(--vb-studio-secondary-shadow)] tw:hover:bg-[var(--vb-studio-secondary-hover-background)] tw:hover:text-[color:var(--vb-studio-secondary-hover-foreground)]";

export const buttonVariants = tv(
  {
    base: "tw:relative tw:inline-flex tw:shrink-0 tw:items-center tw:justify-center tw:gap-2 tw:whitespace-nowrap tw:rounded-[var(--vb-studio-button-radius)] tw:text-sm tw:font-medium tw:transition-[background-color,box-shadow,color,opacity] tw:duration-150 tw:ease-[var(--vb-ease-out-cubic)] tw:active:translate-y-px tw:active:transition-none tw:motion-reduce:active:translate-y-0 tw:focus-visible:outline-2 tw:focus-visible:outline-solid tw:focus-visible:outline-ring tw:focus-visible:outline-offset-2 tw:disabled:pointer-events-none tw:disabled:opacity-40 tw:[&_svg]:pointer-events-none tw:[&_svg]:shrink-0 tw:[&_svg:not([class*='size-'])]:size-4 tw:aria-invalid:outline-destructive tw:cursor-pointer",
    variants: {
      variant: {
        default:
          "tw:bg-primary tw:text-primary-foreground tw:hover:bg-primary-hover",
        destructive:
          "tw:bg-destructive tw:text-destructive-foreground tw:hover:bg-destructive/85 tw:dark:bg-destructive/70",
        secondary: SECONDARY,
        outline:
          "tw:bg-card tw:text-[color:var(--vb-studio-outline-foreground)] tw:shadow-edge tw:hover:bg-[var(--vb-studio-outline-hover-background)] tw:hover:text-accent-foreground tw:aria-pressed:bg-accent tw:aria-pressed:text-accent-foreground tw:data-[state=open]:bg-accent",
        success:
          "tw:bg-success tw:text-success-foreground tw:hover:bg-success/90",
        warning:
          "tw:bg-warning tw:text-warning-foreground tw:hover:bg-warning/90",
        brand: "tw:bg-brand tw:text-brand-foreground tw:hover:bg-brand/85",
        special:
          "tw:bg-special tw:text-special-foreground tw:hover:bg-special/90",
        ghost: "tw:hover:bg-accent tw:hover:text-accent-foreground",
        "ghost-destructive":
          "tw:text-muted-foreground tw:hover:bg-accent tw:hover:text-destructive",
        agent:
          "tw:bg-card tw:text-card-foreground tw:shadow-edge tw:hover:bg-accent tw:has-[>[data-slot=agent-avatar]]:pl-[3px]",
        sidebar:
          "tw:text-sidebar-foreground tw:hover:bg-sidebar-accent tw:aria-pressed:bg-sidebar-accent tw:[&_svg:not([class*='text-'])]:text-muted-foreground tw:hover:[&_svg:not([class*='text-'])]:text-sidebar-foreground",
        link: "tw:text-foreground/80 tw:hover:text-foreground",
        tab: "tw:text-muted-foreground tw:hover:bg-accent tw:hover:text-foreground tw:aria-pressed:bg-card tw:aria-pressed:text-card-foreground tw:aria-pressed:shadow-edge tw:aria-[current=page]:bg-card tw:aria-[current=page]:text-card-foreground tw:aria-[current=page]:shadow-edge",
        menu: "tw:w-full tw:justify-start tw:font-normal tw:hover:bg-accent tw:hover:text-accent-foreground",
      },
      size: {
        default: "tw:h-8 tw:px-3.5 tw:has-[>svg]:px-3",
        sm: "tw:h-7 tw:gap-1.5 tw:px-3 tw:has-[>svg]:px-2.5",
        xs: "tw:h-6 tw:gap-1 tw:px-2.5 tw:text-xs tw:has-[>svg]:px-2",
        lg: "tw:h-10 tw:px-4.5 tw:has-[>svg]:px-4",
        xl: "tw:h-12 tw:px-6 tw:text-base tw:has-[>svg]:px-5",
        icon: "tw:size-8",
        "icon-sm": "tw:size-7",
        "icon-xs": "tw:size-6",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
  { twMerge: false },
);

export type ButtonVariants = VariantProps<typeof buttonVariants>;
