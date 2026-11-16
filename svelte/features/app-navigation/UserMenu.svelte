<script lang="ts">
  import { onDestroy } from "svelte";
  import { readable } from "svelte/store";
  import { MediaQuery } from "svelte/reactivity";
  import { DropdownMenu, mergeProps } from "bits-ui";
  import Avatar from "../../lib/ui/Avatar.svelte";
  import Icon from "../../lib/ui/Icon.svelte";
  import Tip from "../../lib/ui/Tip.svelte";
  import { cn } from "../../lib/ui/utils";
  import { homeText, type HomeLanguage } from "../home/copy";
  import NotificationHelpDialog from "../notifications/NotificationHelpDialog.svelte";
  import type { AccountSection } from "../account/session";
  import ThemeIcon from "./ThemeIcon.svelte";
  import type { UserMenuActions, UserMenuTheme } from "./menuBridge";
  /**
   * The person's avatar at the end of the rail. It opens the account menu:
   * who is signed in (edit profile), friends, agents, this device's
   * notifications, settings, theme, language and sign out. A real menu: arrow
   * keys move, Esc closes and focus returns to the avatar.
   */
  let {
    name,
    email,
    avatar,
    lang,
    theme,
    friends = 0,
    onsettheme,
    onlanguage,
    onaccount,
    pwa,
    onlogout,
  }: UserMenuActions & {
    name: string;
    email: string;
    avatar?: string;
    lang: HomeLanguage;
    theme: UserMenuTheme;
    /** How many friends the person has (the row hides its count at 0). */
    friends?: number;
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
    help = $state(false),
    active = true;
  let trigger = $state<HTMLButtonElement | null>(null);
  onDestroy(() => {
    active = false;
  });
  const label = $derived(name || email);
  const view = $derived(pwa?.state ?? readable(null)),
    push = $derived(pwa?.push ?? readable(null));
  // The device-wide switch: on when the browser allows it and vb.mute is off.
  const notificationsOn = $derived(
    $view?.permission === "granted" && !$view.muted,
  );
  // A server without a push key is only found out after turning the switch
  // on; read once per opening so the focused row never vanishes mid-menu.
  let pushUnavailable = $state(false);
  // Hidden where push cannot work at all; iPhone/iPad Safari keeps the row so
  // its tap can explain that the app must be installed first.
  const notificationsShown = $derived(
    !!$view &&
      ($view.iosWeb || $view.permission !== "unsupported") &&
      !pushUnavailable,
  );
  // Setup failed or is unconfirmed: the row says so and opens the help
  // dialog (retry, test, mute) instead of toggling.
  const notificationsProblem = $derived(
    $push?.status === "failed" || $push?.status === "unconfirmed",
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
    const owner = pwa;
    if (!active || !owner) return;
    if (notificationsProblem) {
      void owner.refresh();
      return whenClosed(() => {
        if (active) help = true;
      });
    }
    void owner.bell().then((success) => {
      // Denied, unsupported or iPhone Safari: explain instead of toggling.
      if (active && !success)
        whenClosed(() => {
          if (active) help = true;
        });
    });
  }
  const itemClass =
    "tw:flex tw:min-h-9 tw:cursor-pointer tw:select-none tw:items-center tw:gap-2 tw:rounded-control-md tw:px-2 tw:py-1.5 tw:text-sm tw:outline-none tw:data-highlighted:bg-accent tw:data-highlighted:text-accent-foreground tw:data-disabled:pointer-events-none tw:data-disabled:opacity-50";
  const segmentClass =
    "tw:inline-flex tw:h-7 tw:min-w-8 tw:cursor-pointer tw:select-none tw:items-center tw:justify-center tw:rounded-control-md tw:px-2 tw:text-xs tw:font-medium tw:text-muted-foreground tw:outline-none tw:data-highlighted:bg-accent tw:data-highlighted:text-accent-foreground tw:data-[state=checked]:bg-secondary tw:data-[state=checked]:text-secondary-foreground";
  const separatorClass = "tw:-mx-1 tw:my-1 tw:h-px tw:bg-border";
</script>

{#snippet who()}
  <Avatar
    name={label}
    src={avatar}
    seed={email}
    kind="person"
    class="tw:size-10 tw:text-sm"
  />
  <span class="tw:grid tw:min-w-0 tw:flex-1 tw:text-left">
    <span class="tw:truncate tw:font-semibold">{label}</span>
    {#if name && name !== email}<span
        class="tw:truncate tw:text-xs tw:text-muted-foreground">{email}</span
      >{/if}
  </span>
{/snippet}

{#snippet avatarButton(tip: Record<string, unknown>)}
  <DropdownMenu.Trigger>
    {#snippet child({ props })}
      <button
        {...mergeProps(tip, props)}
        bind:this={trigger}
        type="button"
        aria-label={label}
        data-native-user-menu-trigger
        class="tw:group tw:relative tw:flex tw:size-12 tw:shrink-0 tw:cursor-pointer tw:items-center tw:justify-center tw:rounded-full tw:outline-none tw:focus-visible:ring-2 tw:focus-visible:ring-ring tw:aria-expanded:ring-2 tw:aria-expanded:ring-primary"
      >
        <Avatar
          name={label}
          src={avatar}
          seed={email}
          kind="person"
          class="tw:size-10 tw:text-sm tw:transition-opacity tw:group-hover:opacity-80 tw:motion-reduce:transition-none"
        />
      </button>
    {/snippet}
  </DropdownMenu.Trigger>
{/snippet}

<div class="tw:relative tw:shrink-0">
  <DropdownMenu.Root
    bind:open
    onOpenChange={(next) => {
      if (next) pushUnavailable = $push?.status === "unavailable";
    }}
  >
    <Tip
      {label}
      side={wide.current ? "right" : "bottom"}
      trigger={avatarButton}
    />
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
        side={wide.current ? "right" : "bottom"}
        align="end"
        sideOffset={8}
        collisionPadding={8}
        class="tw:z-50 tw:m-0 tw:box-border tw:grid tw:w-72 tw:max-w-[calc(100vw-16px)] tw:gap-0 tw:rounded-surface tw:border tw:border-solid tw:border-border tw:bg-popover tw:p-1 tw:font-sans tw:text-sm tw:text-popover-foreground tw:shadow-lg tw:outline-none"
      >
        {#if onaccount}<DropdownMenu.Item
            data-user-menu-item="profile"
            textValue={text("editProfile")}
            class={cn(itemClass, "tw:gap-3 tw:py-2")}
            onSelect={() => account("profile")}
            >{@render who()}<Icon
              name="pencil"
              class="tw:text-muted-foreground"
            /><span class="tw:sr-only">{text("editProfile")}</span
            ></DropdownMenu.Item
          >{:else}<div
            class="tw:flex tw:min-w-0 tw:items-center tw:gap-3 tw:p-2"
          >
            {@render who()}
          </div>{/if}
        {#if onaccount || notificationsShown}<DropdownMenu.Separator
            class={separatorClass}
          />{/if}
        {#if onaccount}<DropdownMenu.Item
            data-user-menu-item="friends"
            class={itemClass}
            onSelect={() => account("friends")}
            ><Icon name="users" /><span class="tw:flex-1"
              >{text("friends")}</span
            >{#if friends > 0}<span
                class="tw:text-xs tw:tabular-nums tw:text-muted-foreground"
                >{friends}</span
              >{/if}<Icon
              name="chevronRight"
              class="tw:text-muted-foreground"
            /></DropdownMenu.Item
          ><DropdownMenu.Item
            data-user-menu-item="agents"
            class={itemClass}
            onSelect={() => account("agents")}
            ><Icon name="bot" /><span class="tw:flex-1">{text("myAgents")}</span
            ><Icon
              name="chevronRight"
              class="tw:text-muted-foreground"
            /></DropdownMenu.Item
          >{/if}
        {#if pwa && notificationsShown}<DropdownMenu.CheckboxItem
            data-user-menu-item="notifications"
            class={itemClass}
            closeOnSelect={false}
            bind:checked={() => notificationsOn, () => {}}
            onSelect={toggleNotifications}
            ><Icon name={notificationsOn ? "bell" : "bellOff"} /><span
              class="tw:grid tw:min-w-0 tw:flex-1"
              ><span>{text("notifications")}</span
              >{#if notificationsProblem}<span
                  data-user-menu-notifications-problem
                  class="tw:text-xs tw:text-destructive"
                  >{text("notificationsProblem")}</span
                >{/if}</span
            >{#if notificationsProblem}<Icon
                name="warning"
                class="tw:text-destructive"
              />{/if}<span
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
        {#if onaccount}<DropdownMenu.Item
            data-user-menu-item="settings"
            class={itemClass}
            onSelect={() => account("all")}
            ><Icon name="settings" /><span class="tw:flex-1"
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
            ><Icon name="logout" /><span class="tw:flex-1"
              >{text("signOut")}</span
            ></DropdownMenu.Item
          >{/if}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu.Root>
</div>
{#if pwa}<NotificationHelpDialog
    bind:open={help}
    owner={pwa}
    {lang}
    returnFocus={() => trigger}
  />{/if}
