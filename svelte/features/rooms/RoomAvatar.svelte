<script lang="ts">
  import OrgAvatar from "../../lib/components/OrgAvatar.svelte";
  import PersonAvatar from "../../lib/components/PersonAvatar.svelte";
  import Avatar from "../../lib/studio/Avatar.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import { Cloud01 } from "../../lib/studio/icons";
  import { cn } from "../../lib/studio/utils";
  import WaitBadge from "../waits/WaitBadge.svelte";
  import type { WaitReference } from "../waits/model";
  import { homeText, type HomeLanguage } from "../home/copy";
  /**
   * A room's avatar: its icon (or the marble its title draws) and the state
   * badges around it. Controlled: every state comes in as a prop, so the rail,
   * the phone strip and the home grid draw the same thing from the same data.
   * `surface` is the colour behind it, which the badges ring themselves with.
   */
  let {
    title,
    icon,
    lang,
    size = "md",
    surface = "sidebar",
    unread = null,
    count = 0,
    busy = false,
    cloud = false,
    waits = [],
    person = null,
    class: className,
  }: {
    title: string;
    /** The room's icon URL, if it has one. */
    icon?: string | null;
    lang: HomeLanguage;
    size?: "md" | "base";
    surface?: "sidebar" | "background";
    /** Who wrote since you last looked: a person or only agents. */
    unread?: "human" | "agent" | null;
    /** How many messages are new (with unread "human"): drawn in the red badge, like an unread DM's. */
    count?: number;
    /** A Claude is working in the room. */
    busy?: boolean;
    /** A cloud sandbox is running for the room. */
    cloud?: boolean;
    waits?: readonly WaitReference[];
    /** A DM: the other person (you in "Você") drawn as PersonAvatar, not a room's tile. */
    person?: { email: string; version?: number | null } | null;
    class?: string;
  } = $props();
  const text = (
    key: Parameters<typeof homeText>[1],
    vars?: Record<string, string | number>,
  ) => homeText(lang, key, vars);
  // Static class names, so Tailwind sees every one.
  const ring = $derived(
    surface === "sidebar" ? "ring-sidebar" : "ring-background",
  );
  const fill = $derived(surface === "sidebar" ? "bg-sidebar" : "bg-background");
</script>

<span
  data-room-avatar={size}
  class={cn("relative inline-flex shrink-0", className)}
>
  {#if person}<PersonAvatar
      email={person.email}
      version={person.version}
      {size}
      aria-hidden="true"
      data-room-cover="person"
    />{:else if icon}<Avatar
      {size}
      url={icon}
      fallback={title}
      aria-hidden="true"
      data-room-cover="icon"
    />{:else}<span data-room-cover="marble" class="contents"
      ><OrgAvatar name={title} {size} /></span
    >{/if}
  <!-- Something new: red, like an unread DM in the rail. People wrote: the count (when known). Only agents wrote: a
       small red dot, no number. Lime stays for what waits on you (the WaitBadge). -->
  {#if unread === "human"}<span
      role="img"
      aria-label={text("newHuman")}
      data-room-badge="unread-human"
      class={cn(
        "absolute -top-1.5 -right-1.5 flex items-center justify-center rounded-full bg-destructive font-semibold leading-none tabular-nums text-destructive-foreground ring-2",
        count > 0 ? "h-4 min-w-4 px-1 text-[10px]" : "size-2.5",
        ring,
      )}
      >{#if count > 0}{count > 99 ? "99+" : count}{/if}</span
    >{:else if unread === "agent"}<span
      role="img"
      aria-label={text("newAgent")}
      data-room-badge="unread-agent"
      class={cn(
        "absolute -top-1 -right-1 size-2.5 rounded-full bg-destructive ring-2",
        ring,
      )}
    ></span>{/if}
  {#if busy}<span
      role="img"
      aria-label={text("busy")}
      data-room-badge="busy"
      class={cn(
        "absolute -bottom-1.5 -left-1.5 flex size-4 items-center justify-center rounded-full text-xs leading-none text-agent-claude motion-safe:animate-spin",
        fill,
      )}>✻</span
    >{/if}
  {#if cloud}<span
      role="img"
      aria-label={text("cloud")}
      data-room-badge="cloud"
      class={cn(
        "absolute -top-1.5 -left-1.5 flex size-4 items-center justify-center rounded-full text-warning",
        fill,
      )}><Icon icon={Cloud01} size={10} /></span
    >{/if}
  <WaitBadge
    solid
    {surface}
    {waits}
    label={(n) => text("waiting", { n })}
    taskLabel={text("taskPending")}
    class="absolute -right-1.5 -bottom-1.5"
  />
</span>
