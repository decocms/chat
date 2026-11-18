<script lang="ts">
  import type { MeResult } from "../../../shared/schemas";
  import PersonAvatar from "../../lib/components/PersonAvatar.svelte";
  import Tooltip from "../../lib/studio/Tooltip.svelte";
  import TooltipContent from "../../lib/studio/TooltipContent.svelte";
  import TooltipTrigger from "../../lib/studio/TooltipTrigger.svelte";
  import { settingsHref } from "../account/settings";
  /**
   * You: a row at a sidebar's foot (a room's, the home's), or just your face
   * (`row={false}`, a phone's top bar, with your name as a tooltip). It opens
   * your settings page; the shell follows `data-nav` links in place.
   */
  let {
    me,
    row = true,
    current = false,
  }: { me: MeResult; row?: boolean; current?: boolean } = $props();
  const label = $derived(me.name || me.email);
</script>

{#snippet link(props: Record<string, unknown>)}
  <a
    {...props}
    href={settingsHref()}
    data-nav
    data-native-account-row
    aria-label={label}
    aria-current={current ? "page" : undefined}
    class={row
      ? "flex h-11 w-full min-w-0 items-center gap-2.5 rounded-lg px-2.5 text-left font-sans text-sm text-sidebar-foreground no-underline transition-colors hover:bg-sidebar-accent aria-[current=page]:bg-sidebar-accent focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring"
      : "relative flex size-8 shrink-0 items-center justify-center rounded-full transition-colors duration-150 hover:bg-sidebar-accent aria-[current=page]:bg-sidebar-accent motion-reduce:transition-none outline-offset-2 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring"}
  >
    {#if row}<span class="relative flex shrink-0"
        ><PersonAvatar
          email={me.email}
          version={me.avatar}
          class="size-7"
        /><span
          data-status-dot="online"
          class="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full bg-brand ring-2 ring-sidebar"
        ></span></span
      ><span class="flex min-w-0 flex-col"
        ><span class="truncate font-medium">{label}</span><span
          class="truncate text-xs text-muted-foreground">Online</span
        ></span
      >{:else}
      <!-- 16px, the same as the search and + glyphs beside it. -->
      <PersonAvatar email={me.email} version={me.avatar} size="2xs" />{/if}
  </a>
{/snippet}

{#if row}{@render link({})}{:else}<Tooltip>
    <TooltipTrigger>
      {#snippet child({ props })}{@render link(props)}{/snippet}
    </TooltipTrigger>
    <TooltipContent side="bottom" sideOffset={8}>{label}</TooltipContent>
  </Tooltip>{/if}
