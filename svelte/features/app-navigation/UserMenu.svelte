<script lang="ts">
  import { onDestroy } from "svelte";
  import { readable } from "svelte/store";
  import { MediaQuery } from "svelte/reactivity";
  import { DropdownMenu, mergeProps } from "bits-ui";
  import PersonAvatar from "../../lib/components/PersonAvatar.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import Tooltip from "../../lib/studio/Tooltip.svelte";
  import TooltipContent from "../../lib/studio/TooltipContent.svelte";
  import TooltipTrigger from "../../lib/studio/TooltipTrigger.svelte";
  import {
    Bell01,
    BellOff01,
    ChevronRight,
    LayoutAlt01,
    LogOut01,
    Pencil01,
    Settings01,
    Stars01,
  } from "../../lib/studio/icons";
  import { cn } from "../../lib/studio/utils";
  import { uiSwitchUrl } from "../../../shared/uiVariant";
  import { homeText, type HomeLanguage } from "../home/copy";
  import type { AccountSection } from "../account/session";
  import ThemeIcon from "./ThemeIcon.svelte";
  import type { UserMenuActions, UserMenuTheme } from "./menuBridge";
  /**
   * The person's avatar at the end of the rail. It opens the account menu:
   * who is signed in (edit profile), agents, this device's
   * notifications, settings, theme, language and sign out. A real menu: arrow
   * keys move, Esc closes and focus returns to the avatar.
   */
  let {
    name,
    email,
    version,
    lang,
    theme,
    onsettheme,
    onlanguage,
    onaccount,
    pwa,
    onlogout,
    row = false,
  }: UserMenuActions & {
    /** The room sidebar's foot (desktop): you as a full-width row, the menu opening above it. */
    row?: boolean;
    name: string;
    email: string;
    /** Your picture's version (`me.avatar`). */
    version?: number | null;
    lang: HomeLanguage;
    theme: UserMenuTheme;
    onsettheme: (theme: UserMenuTheme) => void;
    onlanguage: (lang: HomeLanguage) => void;
  } = $props();
  const text = (key: Parameters<typeof homeText>[1]) => homeText(lang, key);
  const uid = $props.id();
  const themes: {
    value: UserMenuTheme;
    label: "themeAuto" | "themeLight" | "themeDark";
  }[] = [
    { value: "light", label: "themeLight" },
    { value: "dark", label: "themeDark" },
    { value: "auto", label: "themeAuto" },
  ];
  const languages = [
    { value: "pt", label: "PT" },
    { value: "en", label: "EN" },
  ] as const;
  // Same breakpoint as the rail: a column at 901px+, a top row below it.
  const wide = new MediaQuery("min-width: 901px");
  let open = $state(false),
    active = true;
  let trigger = $state<HTMLButtonElement | null>(null);
  onDestroy(() => {
    active = false;
  });
  const label = $derived(name || email);
  const view = $derived(pwa?.state ?? readable(null)),
    push = $derived(pwa?.push ?? readable(null));
  // One switch for this device's sound and notifications (vb.mute). Off until the browser was asked once, so the
  // first tap asks; a browser that refused (or can't) still gets the sound.
  const notificationsOn = $derived(
    !!$view && !$view.muted && ($view.permission !== "default" || $view.iosWeb),
  );
  // What a chosen item opens (a dialog) waits for the menu to close: run on
  // close, it keeps the menu from handing focus back to the avatar after the
  // dialog has taken it.
  let afterClose: (() => void) | null = null;
  function whenClosed(run: () => void) {
    if (!open) return run();
    afterClose = run;
    open = false;
  }
  function account(section: AccountSection) {
    whenClosed(() => {
      if (active && trigger?.isConnected) onaccount?.(section, trigger);
    });
  }
  function toggleNotifications() {
    if (active) void pwa?.bell();
  }
  const itemClass =
    "tw:flex tw:min-h-9 tw:cursor-pointer tw:select-none tw:items-center tw:gap-2 tw:rounded-lg tw:px-2 tw:py-1.5 tw:text-sm tw:outline-none tw:data-highlighted:bg-accent tw:data-highlighted:text-accent-foreground tw:data-disabled:pointer-events-none tw:data-disabled:opacity-50";
  const segmentClass =
    "tw:inline-flex tw:h-7 tw:min-w-8 tw:cursor-pointer tw:select-none tw:items-center tw:justify-center tw:rounded-md tw:px-2 tw:text-xs tw:font-medium tw:text-muted-foreground tw:outline-none tw:data-highlighted:bg-accent tw:data-highlighted:text-accent-foreground tw:data-[state=checked]:bg-secondary tw:data-[state=checked]:text-secondary-foreground";
  const separatorClass = "tw:-mx-1 tw:my-1 tw:h-px tw:bg-border";
</script>

{#snippet who()}
  <PersonAvatar {email} {version} size="base" />
  <span class="tw:grid tw:min-w-0 tw:flex-1 tw:text-left">
    <span class="tw:truncate tw:font-medium">{label}</span>
    {#if name && name !== email}<span
        class="tw:truncate tw:text-xs tw:text-muted-foreground">{email}</span
      >{/if}
  </span>
{/snippet}

<div
  class={row ? "tw:relative tw:w-full tw:min-w-0" : "tw:relative tw:shrink-0"}
>
  <DropdownMenu.Root bind:open onOpenChange={(next) => {}}>
    <Tooltip>
      <TooltipTrigger>
        {#snippet child({ props: tip })}
          <DropdownMenu.Trigger>
            {#snippet child({ props })}
              <button
                {...mergeProps(tip, props)}
                bind:this={trigger}
                type="button"
                aria-label={label}
                data-native-user-menu-trigger
                class={row
                  ? "tw:flex tw:h-11 tw:w-full tw:min-w-0 tw:cursor-pointer tw:items-center tw:gap-2.5 tw:rounded-lg tw:border-0 tw:bg-transparent tw:px-2.5 tw:text-left tw:font-sans tw:text-sm tw:text-sidebar-foreground tw:transition-colors tw:hover:bg-sidebar-accent tw:aria-expanded:bg-sidebar-accent tw:focus-visible:outline-2 tw:focus-visible:outline-solid tw:focus-visible:outline-ring"
                  : "tw:relative tw:flex tw:size-8 tw:shrink-0 tw:cursor-pointer tw:items-center tw:justify-center tw:rounded-full tw:border-0 tw:bg-transparent tw:p-0 tw:transition-colors tw:duration-150 tw:hover:bg-sidebar-accent tw:aria-expanded:bg-sidebar-accent tw:motion-reduce:transition-none tw:outline-offset-2 tw:focus-visible:outline-2 tw:focus-visible:outline-solid tw:focus-visible:outline-ring"}
              >
                {#if row}<span class="tw:relative tw:flex tw:shrink-0"
                    ><PersonAvatar {email} {version} class="tw:size-7" /><span
                      data-status-dot="online"
                      class="tw:absolute tw:-right-0.5 tw:-bottom-0.5 tw:size-2.5 tw:rounded-full tw:bg-brand tw:ring-2 tw:ring-sidebar"
                    ></span></span
                  ><span class="tw:flex tw:min-w-0 tw:flex-col"
                    ><span class="tw:truncate tw:font-medium">{label}</span
                    ><span
                      class="tw:truncate tw:text-xs tw:text-muted-foreground"
                      >Online</span
                    ></span
                  >{:else}
                  <!-- 16px, the same as the search and + glyphs beside it. -->
                  <PersonAvatar {email} {version} size="2xs" />{/if}
              </button>
            {/snippet}
          </DropdownMenu.Trigger>
        {/snippet}
      </TooltipTrigger>
      <TooltipContent
        side={row ? "top" : wide.current ? "right" : "bottom"}
        sideOffset={8}>{label}</TooltipContent
      >
    </Tooltip>
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        onCloseAutoFocus={(event) => {
          const run = afterClose;
          afterClose = null;
          if (run) {
            event.preventDefault();
            // After the menu's own teardown, which still moves focus.
            setTimeout(run);
          }
        }}
        data-vb-native
        data-native-user-menu
        aria-label={text("userMenu")}
        side={row ? "top" : wide.current ? "right" : "bottom"}
        align={row ? "start" : "end"}
        sideOffset={8}
        collisionPadding={8}
        class="tw:z-50 tw:m-0 tw:box-border tw:grid tw:w-72 tw:max-w-[calc(100vw-16px)] tw:gap-0 tw:rounded-2xl tw:border tw:border-solid tw:border-border tw:bg-popover tw:p-1 tw:font-sans tw:text-sm tw:text-popover-foreground tw:shadow-lg tw:outline-none"
      >
        {#if onaccount}<DropdownMenu.Item
            data-user-menu-item="profile"
            textValue={text("editProfile")}
            class={cn(itemClass, "tw:gap-3 tw:py-2")}
            onSelect={() => account("profile")}
            >{@render who()}<Icon
              icon={Pencil01}
              class="tw:size-4 tw:text-muted-foreground"
            /><span class="tw:sr-only">{text("editProfile")}</span
            ></DropdownMenu.Item
          >{:else}<div
            class="tw:flex tw:min-w-0 tw:items-center tw:gap-3 tw:p-2"
          >
            {@render who()}
          </div>{/if}
        {#if onaccount || pwa}<DropdownMenu.Separator
            class={separatorClass}
          />{/if}
        {#if onaccount}<DropdownMenu.Item
            data-user-menu-item="agents"
            class={itemClass}
            onSelect={() => account("agents")}
            ><Icon icon={Stars01} class="tw:size-4" /><span class="tw:flex-1"
              >{text("myAgents")}</span
            ><Icon
              icon={ChevronRight}
              class="tw:size-4 tw:text-muted-foreground"
            /></DropdownMenu.Item
          >{/if}
        {#if pwa}<DropdownMenu.CheckboxItem
            data-user-menu-item="notifications"
            class={itemClass}
            closeOnSelect={false}
            bind:checked={() => notificationsOn, () => {}}
            onSelect={toggleNotifications}
            ><Icon
              icon={notificationsOn ? Bell01 : BellOff01}
              class="tw:size-4"
            /><span class="tw:min-w-0 tw:flex-1">{text("notifications")}</span
            ><span
              aria-hidden="true"
              class={cn(
                "tw:relative tw:inline-flex tw:h-5 tw:w-9 tw:shrink-0 tw:rounded-full tw:transition-colors tw:motion-reduce:transition-none",
                notificationsOn ? "tw:bg-primary" : "tw:bg-input",
                $push?.status === "working" && "tw:opacity-60",
              )}
              ><span
                class={cn(
                  "tw:absolute tw:left-0.5 tw:top-0.5 tw:size-4 tw:rounded-full tw:bg-card tw:shadow-xs tw:transition-transform tw:motion-reduce:transition-none",
                  notificationsOn ? "tw:translate-x-4" : "tw:translate-x-0",
                )}
              ></span></span
            ></DropdownMenu.CheckboxItem
          >{/if}
        <DropdownMenu.CheckboxItem
          data-user-menu-item="new-ui"
          class={itemClass}
          bind:checked={() => true, () => {}}
          onSelect={() => {
            // Off = the classic app on this device (/ui/vanilla), at the same address.
            if (!active) return;
            window.location.assign(
              uiSwitchUrl("vanilla", window.location.href),
            );
          }}
          ><Icon icon={LayoutAlt01} class="tw:size-4" /><span class="tw:flex-1"
            >{text("newUi")}</span
          ><span
            aria-hidden="true"
            class="tw:relative tw:inline-flex tw:h-5 tw:w-9 tw:shrink-0 tw:rounded-full tw:bg-primary"
            ><span
              class="tw:absolute tw:top-0.5 tw:left-0.5 tw:size-4 tw:translate-x-4 tw:rounded-full tw:bg-card tw:shadow-xs"
            ></span></span
          ></DropdownMenu.CheckboxItem
        >
        {#if onaccount}<DropdownMenu.Item
            data-user-menu-item="settings"
            class={itemClass}
            onSelect={() => account("all")}
            ><Icon icon={Settings01} class="tw:size-4" /><span class="tw:flex-1"
              >{text("settingsMenu")}</span
            ></DropdownMenu.Item
          >{/if}
        <DropdownMenu.Separator class={separatorClass} />
        <div
          class="tw:flex tw:min-h-9 tw:items-center tw:justify-between tw:gap-2 tw:px-2 tw:py-1"
        >
          <span id="{uid}-theme" class="tw:text-muted-foreground"
            >{text("theme")}</span
          >
          <DropdownMenu.RadioGroup
            aria-labelledby="{uid}-theme"
            class="tw:flex tw:items-center tw:gap-1"
            bind:value={
              () => theme,
              (next) => {
                if (next !== theme) onsettheme(next as UserMenuTheme);
              }
            }
          >
            {#each themes as option (option.value)}<DropdownMenu.RadioItem
                value={option.value}
                closeOnSelect={false}
                aria-label={text(option.label)}
                textValue={text(option.label)}
                class={segmentClass}
                ><ThemeIcon theme={option.value} /></DropdownMenu.RadioItem
              >{/each}
          </DropdownMenu.RadioGroup>
        </div>
        <div
          class="tw:flex tw:min-h-9 tw:items-center tw:justify-between tw:gap-2 tw:px-2 tw:py-1"
        >
          <span id="{uid}-language" class="tw:text-muted-foreground"
            >{text("language")}</span
          >
          <DropdownMenu.RadioGroup
            aria-labelledby="{uid}-language"
            class="tw:flex tw:items-center tw:gap-1"
            bind:value={
              () => lang,
              (next) => {
                if (next !== lang) onlanguage(next as HomeLanguage);
              }
            }
          >
            {#each languages as option (option.value)}<DropdownMenu.RadioItem
                value={option.value}
                closeOnSelect={false}
                textValue={option.label}
                class={segmentClass}>{option.label}</DropdownMenu.RadioItem
              >{/each}
          </DropdownMenu.RadioGroup>
        </div>
        {#if onlogout}<DropdownMenu.Separator
            class={separatorClass}
          /><DropdownMenu.Item
            data-user-menu-item="logout"
            class={itemClass}
            onSelect={() => {
              if (active) onlogout?.();
            }}
            ><Icon icon={LogOut01} class="tw:size-4" /><span class="tw:flex-1"
              >{text("signOut")}</span
            ></DropdownMenu.Item
          >{/if}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu.Root>
</div>
