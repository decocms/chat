import { getContext, setContext } from "svelte";
import { tv, type VariantProps } from "tailwind-variants";

export type SidebarContext = {
  readonly state: "expanded" | "collapsed";
  readonly open: boolean;
  setOpen: (open: boolean) => void;
  readonly openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  readonly isMobile: boolean;
  toggleSidebar: () => void;
};

const KEY = Symbol("studio-sidebar");

export function setSidebarContext(context: SidebarContext): void {
  setContext(KEY, context);
}

/** The sidebar's state and its setters. Read the properties where they are used: they are live getters. */
export function useSidebar(): SidebarContext {
  const context = getContext<SidebarContext | undefined>(KEY);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.");
  }
  return context;
}

/** Below this viewport width the sidebar is a sheet. */
export const SIDEBAR_MOBILE_QUERY = "(max-width: 767px)";

export const sidebarMenuButtonVariants = tv(
  {
    base: "tw:peer/menu-button tw:flex tw:w-full tw:cursor-pointer tw:items-center tw:gap-2 tw:overflow-hidden tw:rounded-lg tw:py-0 tw:pr-0.5 tw:pl-1.5 tw:text-left tw:text-sm tw:focus-visible:outline-2 tw:focus-visible:outline-solid tw:focus-visible:outline-ring tw:focus-visible:outline-offset-2 tw:transition-[width,height,padding] tw:duration-150 tw:ease-out tw:motion-reduce:transition-none tw:active:bg-sidebar-accent tw:active:text-sidebar-accent-foreground tw:disabled:pointer-events-none tw:disabled:cursor-not-allowed tw:disabled:opacity-50 tw:group-has-data-[sidebar=menu-action]/menu-item:pr-8 tw:aria-disabled:pointer-events-none tw:aria-disabled:opacity-50 tw:data-[active=true]:bg-sidebar-accent tw:data-[active=true]:text-sidebar-accent-foreground tw:data-[state=open]:hover:bg-sidebar-accent tw:data-[state=open]:hover:text-sidebar-accent-foreground tw:[&>span:last-child]:truncate tw:group-data-[state=collapsed]/sidebar:[&>span:last-child]:hidden tw:[&>svg]:size-4 tw:[&>svg]:shrink-0 tw:[&_svg:not([class*='text-'])]:text-muted-foreground tw:hover:[&_svg:not([class*='text-'])]:text-sidebar-foreground",
    variants: {
      variant: {
        default:
          "tw:hover:bg-sidebar-accent tw:hover:text-sidebar-accent-foreground",
        outline:
          "tw:bg-background tw:ring-1 tw:ring-sidebar-border tw:hover:bg-sidebar-accent tw:hover:text-sidebar-accent-foreground tw:hover:ring-sidebar-accent",
      },
      size: {
        default:
          "tw:group-data-[state=expanded]/sidebar:h-8 tw:group-data-[state=expanded]/sidebar:px-2 tw:group-data-[state=collapsed]/sidebar:p-0! tw:group-data-[state=collapsed]/sidebar:mx-auto tw:group-data-[state=collapsed]/sidebar:justify-center tw:text-sm tw:group-data-[state=collapsed]/sidebar:size-8! tw:group-data-[state=collapsed]/sidebar:rounded-full",
        sm: "tw:h-7 tw:text-xs",
        lg: "tw:h-12 tw:text-sm tw:p-0!",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
  { twMerge: false },
);

export type SidebarMenuButtonVariants = VariantProps<
  typeof sidebarMenuButtonVariants
>;

/** Inline styles are not allowed here, so each width a menu skeleton can take (50% to 89%) is a class. */
export const SIDEBAR_SKELETON_WIDTHS = [
  "tw:max-w-[50%]",
  "tw:max-w-[51%]",
  "tw:max-w-[52%]",
  "tw:max-w-[53%]",
  "tw:max-w-[54%]",
  "tw:max-w-[55%]",
  "tw:max-w-[56%]",
  "tw:max-w-[57%]",
  "tw:max-w-[58%]",
  "tw:max-w-[59%]",
  "tw:max-w-[60%]",
  "tw:max-w-[61%]",
  "tw:max-w-[62%]",
  "tw:max-w-[63%]",
  "tw:max-w-[64%]",
  "tw:max-w-[65%]",
  "tw:max-w-[66%]",
  "tw:max-w-[67%]",
  "tw:max-w-[68%]",
  "tw:max-w-[69%]",
  "tw:max-w-[70%]",
  "tw:max-w-[71%]",
  "tw:max-w-[72%]",
  "tw:max-w-[73%]",
  "tw:max-w-[74%]",
  "tw:max-w-[75%]",
  "tw:max-w-[76%]",
  "tw:max-w-[77%]",
  "tw:max-w-[78%]",
  "tw:max-w-[79%]",
  "tw:max-w-[80%]",
  "tw:max-w-[81%]",
  "tw:max-w-[82%]",
  "tw:max-w-[83%]",
  "tw:max-w-[84%]",
  "tw:max-w-[85%]",
  "tw:max-w-[86%]",
  "tw:max-w-[87%]",
  "tw:max-w-[88%]",
  "tw:max-w-[89%]",
] as const;
