import { tv, type VariantProps } from "tailwind-variants";

/** Ported 1:1 from @decocms/ui `button.tsx`. A grey fill that darkens a step on hover; variables keep it overridable per layout. */
const SECONDARY =
  "bg-[var(--vb-studio-secondary-background)] text-[color:var(--vb-studio-secondary-foreground)] shadow-[var(--vb-studio-secondary-shadow)] hover:bg-[var(--vb-studio-secondary-hover-background)] hover:text-[color:var(--vb-studio-secondary-hover-foreground)]";

export const buttonVariants = tv(
  {
    base: "relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[var(--vb-studio-button-radius)] text-sm font-medium transition-[background-color,box-shadow,color,opacity] duration-150 ease-[var(--vb-ease-out-cubic)] active:translate-y-px active:transition-none motion-reduce:active:translate-y-0 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 aria-invalid:outline-destructive cursor-pointer",
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-hover",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/85 dark:bg-destructive/70",
        secondary: SECONDARY,
        outline:
          "bg-card text-[color:var(--vb-studio-outline-foreground)] shadow-edge hover:bg-[var(--vb-studio-outline-hover-background)] hover:text-accent-foreground aria-pressed:bg-accent aria-pressed:text-accent-foreground data-[state=open]:bg-accent",
        success: "bg-success text-success-foreground hover:bg-success/90",
        warning: "bg-warning text-warning-foreground hover:bg-warning/90",
        brand: "bg-brand text-brand-foreground hover:bg-brand/85",
        special: "bg-special text-special-foreground hover:bg-special/90",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        "ghost-destructive":
          "text-muted-foreground hover:bg-accent hover:text-destructive",
        agent:
          "bg-card text-card-foreground shadow-edge hover:bg-accent has-[>[data-slot=agent-avatar]]:pl-[3px]",
        sidebar:
          "text-sidebar-foreground hover:bg-sidebar-accent aria-pressed:bg-sidebar-accent [&_svg:not([class*='text-'])]:text-muted-foreground hover:[&_svg:not([class*='text-'])]:text-sidebar-foreground",
        link: "text-foreground/80 hover:text-foreground",
        tab: "text-muted-foreground hover:bg-accent hover:text-foreground aria-pressed:bg-card aria-pressed:text-card-foreground aria-pressed:shadow-edge aria-[current=page]:bg-card aria-[current=page]:text-card-foreground aria-[current=page]:shadow-edge",
        menu: "w-full justify-start font-normal hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        default: "h-8 px-3.5 has-[>svg]:px-3",
        sm: "h-7 gap-1.5 px-3 has-[>svg]:px-2.5",
        xs: "h-6 gap-1 px-2.5 text-xs has-[>svg]:px-2",
        lg: "h-10 px-4.5 has-[>svg]:px-4",
        xl: "h-12 px-6 text-base has-[>svg]:px-5",
        icon: "size-8",
        "icon-sm": "size-7",
        "icon-xs": "size-6",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
  { twMerge: false },
);

export type ButtonVariants = VariantProps<typeof buttonVariants>;
