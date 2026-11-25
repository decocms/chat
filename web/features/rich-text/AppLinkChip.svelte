<script lang="ts">
  import type { Snippet } from "svelte";
  import type { Room } from "../../../shared/room";
  import { CALL_THREAD } from "../../../shared/call";
  import type { LinkResolution } from "../../../shared/schemas";
  import Icon from "../../lib/studio/Icon.svelte";
  import PersonAvatar from "../../lib/components/PersonAvatar.svelte";
  import RoomMark from "../room-sidebar/RoomMark.svelte";
  import type { AppLink } from "./appLinks";
  import { linkResolver } from "./linkResolver";
  /**
   * A link to this app drawn as one line in the text: where it goes (a message, a thread, a room, a DM), or
   * "Sala privada" when you can't see it, with no name, person or text of it. While the answer comes, or when it
   * can't come, the plain link (`plain`) shows instead.
   */
  let {
    link,
    href,
    room,
    t,
    onopen,
    plain,
  }: {
    link: AppLink;
    href: string;
    room: Room | null;
    t: (text: string) => string;
    onopen: (event: MouseEvent) => void;
    plain: Snippet;
  } = $props();
  const state = $derived(linkResolver.read(link, room));
  $effect(() => {
    linkResolver.request(link, room);
  });
  /** A new kind of answer fails the type check here until the chip draws it. */
  const unreachable = (value: never): string => {
    void value;
    return "";
  };
  const firstName = (name: string) => name.split(/\s+/)[0] || name;
  const where = (value: Extract<LinkResolution, { kind: "message" }>) =>
    value.threadTitle ??
    (value.thread === CALL_THREAD
      ? t("Chat da call")
      : value.roomTitle || t("Você"));
  const chip =
    "inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-lg px-1.5 align-middle font-sans text-sm leading-6 no-underline";
</script>

{#snippet label(value: Exclude<LinkResolution, { kind: "private" }>)}
  {#if value.kind === "message"}<PersonAvatar
      email={value.author}
      version={value.avatar}
      size="2xs"
      class="shrink-0"
    /><span class="shrink-0 font-medium">{value.name}</span><span
      class="shrink-0 text-muted-foreground">{t("em")}</span
    ><span class="min-w-0 truncate">{where(value)}</span>
  {:else if value.kind === "thread"}<Icon
      icon="message-circle-01"
      size={16}
      class="shrink-0 text-muted-foreground"
    /><span class="min-w-0 truncate"
      >{value.thread === CALL_THREAD ? t("Chat da call") : value.title}</span
    >{#if value.ownerName}<span class="shrink-0 text-muted-foreground"
        >· {firstName(value.ownerName)}</span
      >{/if}
  {:else if value.kind === "room"}<RoomMark
      title={value.title}
      src={value.icon
        ? `/api/books/${encodeURIComponent(value.room)}/icon?v=${value.icon}`
        : undefined}
      size="2xs"
    /><span class="min-w-0 truncate">{value.title}</span>
  {:else if value.kind === "dm"}<PersonAvatar
      email={value.email}
      version={value.avatar}
      size="2xs"
      class="shrink-0"
    /><span class="min-w-0 truncate">{value.name || t("Você")}</span>
  {:else}{unreachable(value)}{/if}
{/snippet}

{#if state.status === "loading"}{@render plain()}
{:else if state.value.kind === "private"}<span
    data-app-link="private"
    title={href}
    class="{chip} bg-secondary text-muted-foreground"
    ><Icon icon="lock-01" size={14} class="shrink-0" /><span class="truncate"
      >{t("Sala privada")}</span
    ></span
  >
{:else}<a
    {href}
    title={href}
    data-rich-link="app"
    data-app-link={state.value.kind}
    onclick={onopen}
    class="{chip} bg-secondary text-foreground hover:bg-secondary-hover focus-visible:outline-2 focus-visible:outline-ring"
    >{@render label(state.value)}</a
  >{/if}
