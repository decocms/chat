import { getContext, setContext } from "svelte";
import { tv, type VariantProps } from "tailwind-variants";
import { MOBILE_QUERY } from "../breakpoints";

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
export const SIDEBAR_MOBILE_QUERY = MOBILE_QUERY;

export const sidebarMenuButtonVariants = tv(
  {
    base: "peer/menu-button flex w-full cursor-pointer items-center gap-2 overflow-hidden rounded-lg py-0 pr-0.5 pl-1.5 text-left text-sm focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring focus-visible:outline-offset-2 transition-[width,height,padding] duration-150 ease-out motion-reduce:transition-none active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 group-has-data-[sidebar=menu-action]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground data-[state=open]:hover:bg-sidebar-accent data-[state=open]:hover:text-sidebar-accent-foreground [&>span:last-child]:truncate group-data-[state=collapsed]/sidebar:[&>span:last-child]:hidden [&>svg]:size-4 [&>svg]:shrink-0 [&_svg:not([class*='text-'])]:text-muted-foreground hover:[&_svg:not([class*='text-'])]:text-sidebar-foreground",
    variants: {
      variant: {
        default: "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        outline:
          "bg-background ring-1 ring-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:ring-sidebar-accent",
      },
      size: {
        default:
          "group-data-[state=expanded]/sidebar:h-8 group-data-[state=expanded]/sidebar:px-2 group-data-[state=collapsed]/sidebar:p-0! group-data-[state=collapsed]/sidebar:mx-auto group-data-[state=collapsed]/sidebar:justify-center text-sm group-data-[state=collapsed]/sidebar:size-8! group-data-[state=collapsed]/sidebar:rounded-full",
        sm: "h-7 text-xs",
        lg: "h-12 text-sm p-0!",
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
  "max-w-[50%]",
  "max-w-[51%]",
  "max-w-[52%]",
  "max-w-[53%]",
  "max-w-[54%]",
  "max-w-[55%]",
  "max-w-[56%]",
  "max-w-[57%]",
  "max-w-[58%]",
  "max-w-[59%]",
  "max-w-[60%]",
  "max-w-[61%]",
  "max-w-[62%]",
  "max-w-[63%]",
  "max-w-[64%]",
  "max-w-[65%]",
  "max-w-[66%]",
  "max-w-[67%]",
  "max-w-[68%]",
  "max-w-[69%]",
  "max-w-[70%]",
  "max-w-[71%]",
  "max-w-[72%]",
  "max-w-[73%]",
  "max-w-[74%]",
  "max-w-[75%]",
  "max-w-[76%]",
  "max-w-[77%]",
  "max-w-[78%]",
  "max-w-[79%]",
  "max-w-[80%]",
  "max-w-[81%]",
  "max-w-[82%]",
  "max-w-[83%]",
  "max-w-[84%]",
  "max-w-[85%]",
  "max-w-[86%]",
  "max-w-[87%]",
  "max-w-[88%]",
  "max-w-[89%]",
] as const;
