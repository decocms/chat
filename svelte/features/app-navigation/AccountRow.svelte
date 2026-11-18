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
      ? "tw:flex tw:h-11 tw:w-full tw:min-w-0 tw:items-center tw:gap-2.5 tw:rounded-lg tw:px-2.5 tw:text-left tw:font-sans tw:text-sm tw:text-sidebar-foreground tw:no-underline tw:transition-colors tw:hover:bg-sidebar-accent tw:aria-[current=page]:bg-sidebar-accent tw:focus-visible:outline-2 tw:focus-visible:outline-solid tw:focus-visible:outline-ring"
      : "tw:relative tw:flex tw:size-8 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-full tw:transition-colors tw:duration-150 tw:hover:bg-sidebar-accent tw:aria-[current=page]:bg-sidebar-accent tw:motion-reduce:transition-none tw:outline-offset-2 tw:focus-visible:outline-2 tw:focus-visible:outline-solid tw:focus-visible:outline-ring"}
  >
    {#if row}<span class="tw:relative tw:flex tw:shrink-0"
        ><PersonAvatar
          email={me.email}
          version={me.avatar}
          class="tw:size-7"
        /><span
          data-status-dot="online"
          class="tw:absolute tw:-right-0.5 tw:-bottom-0.5 tw:size-2.5 tw:rounded-full tw:bg-brand tw:ring-2 tw:ring-sidebar"
        ></span></span
      ><span class="tw:flex tw:min-w-0 tw:flex-col"
        ><span class="tw:truncate tw:font-medium">{label}</span><span
          class="tw:truncate tw:text-xs tw:text-muted-foreground">Online</span
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
