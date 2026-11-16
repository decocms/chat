import { tv, type VariantProps } from "tailwind-variants";

/** Ported 1:1 from @decocms/ui `avatar.tsx`. `solid` is for people and for marks that sit alone, like an org in the rail. */
export const AVATAR_COLORS = {
  tint: [
    "tw:bg-brand-lime-tint tw:text-brand-green-dark tw:dark:bg-brand/20 tw:dark:text-brand",
    "tw:bg-brand-purple-tint tw:text-brand-purple-dark tw:dark:bg-brand-purple/20 tw:dark:text-brand-purple",
    "tw:bg-brand-yellow-tint tw:text-brand-yellow-dark tw:dark:bg-brand-yellow/20 tw:dark:text-brand-yellow",
    "tw:bg-brand-blue-tint tw:text-brand-blue-dark tw:dark:bg-brand-blue/20 tw:dark:text-brand-blue",
  ],
  solid: [
    "tw:bg-brand tw:text-brand-green-dark",
    "tw:bg-brand-purple tw:text-brand-purple-dark",
    "tw:bg-brand-yellow tw:text-brand-yellow-dark",
    "tw:bg-brand-blue tw:text-brand-blue-dark",
  ],
} as const;

export type AvatarTone = keyof typeof AVATAR_COLORS;

export const MUTED_COLOR = "tw:bg-muted tw:text-muted-foreground";

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
    base: "tw:font-medium",
    variants: {
      shape: {
        circle: "tw:rounded-full",
        square: "",
      },
      size: {
        "3xs": "tw:size-3 tw:text-[0.4375rem]",
        "2xs": "tw:size-4 tw:text-[0.5625rem]",
        xs: "tw:size-6 tw:text-[0.625rem]",
        sm: "tw:size-8 tw:text-xs",
        md: "tw:size-9 tw:text-sm",
        base: "tw:size-10 tw:text-sm",
        lg: "tw:size-12 tw:text-lg",
        xl: "tw:size-16 tw:text-2xl",
        "2xl": "tw:size-20 tw:text-3xl",
        "3xl": "tw:size-32 tw:text-5xl",
      },
    },
    compoundVariants: [
      { shape: "square", size: "3xs", class: "tw:rounded-[0.1875rem]" },
      { shape: "square", size: "2xs", class: "tw:rounded-sm" },
      { shape: "square", size: "xs", class: "tw:rounded-lg" },
      { shape: "square", size: "sm", class: "tw:rounded-[0.625rem]" },
      { shape: "square", size: "md", class: "tw:rounded-[0.6875rem]" },
      { shape: "square", size: "base", class: "tw:rounded-xl" },
      { shape: "square", size: "lg", class: "tw:rounded-[0.875rem]" },
      { shape: "square", size: "xl", class: "tw:rounded-[1.125rem]" },
      { shape: "square", size: "2xl", class: "tw:rounded-[1.375rem]" },
      { shape: "square", size: "3xl", class: "tw:rounded-[2.25rem]" },
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
        contain: "tw:object-contain",
        cover: "tw:object-cover",
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
