import { tv, type VariantProps } from "tailwind-variants";

/** Ported 1:1 from @decocms/ui `avatar.tsx`. `solid` is for people and for marks that sit alone, like an org in the rail. */
export const AVATAR_COLORS = {
  tint: [
    "bg-brand-lime-tint text-brand-green-dark dark:bg-brand/20 dark:text-brand",
    "bg-brand-purple-tint text-brand-purple-dark dark:bg-brand-purple/20 dark:text-brand-purple",
    "bg-brand-yellow-tint text-brand-yellow-dark dark:bg-brand-yellow/20 dark:text-brand-yellow",
    "bg-brand-blue-tint text-brand-blue-dark dark:bg-brand-blue/20 dark:text-brand-blue",
  ],
  solid: [
    "bg-brand text-brand-green-dark",
    "bg-brand-purple text-brand-purple-dark",
    "bg-brand-yellow text-brand-yellow-dark",
    "bg-brand-blue text-brand-blue-dark",
  ],
} as const;

export type AvatarTone = keyof typeof AVATAR_COLORS;

export const MUTED_COLOR = "bg-muted text-muted-foreground";

export function getColorFromString(input: string, tone: AvatarTone): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = input.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = AVATAR_COLORS[tone];
  return colors[Math.abs(hash) % colors.length] ?? colors[0];
}

/** "Ana Souza" → "AS", "Acme" → "A", "" → "?". */
export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.charAt(0) ?? "";
  const last = words.length > 1 ? (words.at(-1)?.charAt(0) ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

/** Initials at ~40% of the tile; a square's radius is ~30% of its side, as the org rail's. */
export const avatarVariants = tv(
  {
    base: "font-medium",
    variants: {
      shape: {
        circle: "rounded-full",
        square: "",
      },
      size: {
        "3xs": "size-3 text-[0.4375rem]",
        "2xs": "size-4 text-[0.5625rem]",
        xs: "size-6 text-[0.625rem]",
        sm: "size-8 text-xs",
        md: "size-9 text-sm",
        base: "size-10 text-sm",
        lg: "size-12 text-lg",
        xl: "size-16 text-2xl",
        "2xl": "size-20 text-3xl",
        "3xl": "size-32 text-5xl",
      },
    },
    compoundVariants: [
      { shape: "square", size: "3xs", class: "rounded-[0.1875rem]" },
      { shape: "square", size: "2xs", class: "rounded-sm" },
      { shape: "square", size: "xs", class: "rounded-lg" },
      { shape: "square", size: "sm", class: "rounded-[0.625rem]" },
      { shape: "square", size: "md", class: "rounded-[0.6875rem]" },
      { shape: "square", size: "base", class: "rounded-xl" },
      { shape: "square", size: "lg", class: "rounded-[0.875rem]" },
      { shape: "square", size: "xl", class: "rounded-[1.125rem]" },
      { shape: "square", size: "2xl", class: "rounded-[1.375rem]" },
      { shape: "square", size: "3xl", class: "rounded-[2.25rem]" },
    ],
    defaultVariants: { shape: "square", size: "base" },
  },
  { twMerge: false },
);

export type AvatarVariants = VariantProps<typeof avatarVariants>;

export const avatarImageVariants = tv(
  {
    variants: {
      objectFit: {
        contain: "object-contain",
        cover: "object-cover",
      },
    },
    defaultVariants: { objectFit: "cover" },
  },
  { twMerge: false },
);

export const ICON_SIZES = {
  "3xs": 8,
  "2xs": 8,
  xs: 12,
  sm: 16,
  md: 18,
  base: 20,
  lg: 24,
  xl: 32,
  "2xl": 40,
  "3xl": 64,
} as const;

export type AvatarSize = keyof typeof ICON_SIZES;

/** How long the fallback waits for the image before it shows. */
export const FALLBACK_DELAY_MS = 600;
