<script lang="ts">
  import OrgAvatar from "../../lib/components/OrgAvatar.svelte";
  import PersonAvatar from "../../lib/components/PersonAvatar.svelte";
  import PresenceDot from "../../lib/components/PresenceDot.svelte";
  import Avatar from "../../lib/studio/Avatar.svelte";
  import type { AvatarSize } from "../../lib/studio/avatar";
  import { cn } from "../../lib/studio/utils";
  import WaitBadge from "../waits/WaitBadge.svelte";
  import type { WaitReference } from "../waits/model";
  import { homeText, type HomeLanguage } from "../home/copy";
  /**
   * A room's avatar: its icon (or the marble its title draws) and three signals
   * around it, each with one meaning and one place. Top right, the only number:
   * what waits on you (WaitBadge). Left edge, a dot without a number: new
   * messages (strong when a person wrote, muted when only agents did). Bottom
   * left, the ✻: an agent works here. Controlled: every state comes in as a
   * prop, so the rail, the phone list and the home grid draw the same thing
   * from the same data. `surface` is the colour behind it, which the badges
   * ring themselves with.
   */
  let {
    title,
    icon,
    lang,
    size = "md",
    surface = "sidebar",
    unread = null,
    busy = false,
    waits = [],
    person = null,
    presence = null,
    class: className,
  }: {
    title: string;
    /** The room's icon URL, if it has one. */
    icon?: string | null;
    lang: HomeLanguage;
    size?: AvatarSize;
    surface?: "sidebar" | "background";
    /** Who wrote since you last looked: a person or only agents. The rail passes null: its RailPill draws it. */
    unread?: "human" | "agent" | null;
    /** An agent is working in the room. */
    busy?: boolean;
    waits?: readonly WaitReference[];
    /** A DM: the other person (you in "Você") drawn as PersonAvatar, not a room's tile. */
    person?: { email: string; version?: number | null } | null;
    /** A DM's person: their online dot, and what it says ("Name · Online"). */
    presence?: { online: boolean; label: string } | null;
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
  <!-- New messages: a dot without a number on the left edge, where the rail draws its RailPill. -->
  {#if unread}<span
      role="img"
      aria-label={text(unread === "human" ? "newHuman" : "newAgent")}
      data-room-badge={`unread-${unread}`}
      class={cn(
        "absolute top-1/2 -left-1.5 size-2 -translate-y-1/2 rounded-full ring-2",
        unread === "human" ? "bg-foreground" : "bg-muted-foreground",
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
  {#if presence}<PresenceDot
      online={presence.online}
      label={presence.label}
      class={ring}
    />{/if}
  <WaitBadge
    solid
    {surface}
    {waits}
    label={(n) => text("waiting", { n })}
    class="absolute -top-1.5 -right-1.5"
  />
</span>
