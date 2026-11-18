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
    busy = false,
    cloud = false,
    waits = [],
    person = false,
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
    /** A Claude is working in the room. */
    busy?: boolean;
    /** A cloud sandbox is running for the room. */
    cloud?: boolean;
    waits?: readonly WaitReference[];
    /** A DM: the other person's face (their picture, else the face their name draws), not a room's tile. */
    person?: boolean;
    class?: string;
  } = $props();
  const text = (
    key: Parameters<typeof homeText>[1],
    vars?: Record<string, string | number>,
  ) => homeText(lang, key, vars);
  // Static class names, so Tailwind sees every one.
  const ring = $derived(
    surface === "sidebar" ? "tw:ring-sidebar" : "tw:ring-background",
  );
  const fill = $derived(
    surface === "sidebar" ? "tw:bg-sidebar" : "tw:bg-background",
  );
</script>

<span
  data-room-avatar={size}
  class={cn("tw:relative tw:inline-flex tw:shrink-0", className)}
>
  {#if person}<PersonAvatar
      name={title}
      url={icon ?? undefined}
      {size}
      aria-hidden="true"
      data-room-cover="person"
    />{:else if icon}<Avatar
      {size}
      url={icon}
      fallback={title}
      aria-hidden="true"
      data-room-cover="icon"
    />{:else}<span data-room-cover="marble" class="tw:contents"
      ><OrgAvatar name={title} {size} /></span
    >{/if}
  {#if unread}<span
      role="img"
      aria-label={text(unread === "human" ? "newHuman" : "newAgent")}
      data-room-badge={unread === "human" ? "unread-human" : "unread-agent"}
      class={cn(
        "tw:absolute tw:-top-1 tw:-right-1 tw:size-2.5 tw:rounded-full tw:ring-2",
        ring,
        unread === "human" ? "tw:bg-brand" : "tw:bg-warning",
      )}
    ></span>{/if}
  {#if busy}<span
      role="img"
      aria-label={text("busy")}
      data-room-badge="busy"
      class={cn(
        "tw:absolute tw:-bottom-1.5 tw:-left-1.5 tw:flex tw:size-4 tw:items-center tw:justify-center tw:rounded-full tw:text-xs tw:leading-none tw:text-agent-claude tw:motion-safe:animate-spin",
        fill,
      )}>✻</span
    >{/if}
  {#if cloud}<span
      role="img"
      aria-label={text("cloud")}
      data-room-badge="cloud"
      class={cn(
        "tw:absolute tw:-top-1.5 tw:-left-1.5 tw:flex tw:size-4 tw:items-center tw:justify-center tw:rounded-full tw:text-warning",
        fill,
      )}><Icon icon={Cloud01} size={10} /></span
    >{/if}
  <WaitBadge
    solid
    {surface}
    {waits}
    label={(n) => text("waiting", { n })}
    taskLabel={text("taskPending")}
    class="tw:absolute tw:-right-1.5 tw:-bottom-1.5"
  />
</span>
