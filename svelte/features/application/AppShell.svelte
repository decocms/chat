<script lang="ts">
  import { onMount, onDestroy, untrack } from "svelte";
  import { get } from "svelte/store";
  import type { Snippet } from "svelte";
  import type { BrowserApplicationServices } from "./browser";
  import type {
    ApplicationRoomPresentation,
    ApplicationShellEffects,
    ApplicationTheme,
  } from "./shellTypes";
  import { createApplicationShellEffects } from "./shellBrowser";
  import { createApplicationInbox } from "./inbox";
  import AppNavigation from "../app-navigation/AppNavigation.svelte";
  import DeviceLockScreen from "../account/DeviceLockScreen.svelte";
  import Snapshot from "../../lib/components/Snapshot.svelte";
  import Dialog from "../../lib/studio/Dialog.svelte";
  import DialogContent from "../../lib/studio/DialogContent.svelte";
  import DialogHeader from "../../lib/studio/DialogHeader.svelte";
  import DialogTitle from "../../lib/studio/DialogTitle.svelte";
  import { createDeferredModule } from "../deferred-view/module";
  import DeferredViewStatus from "../deferred-view/DeferredViewStatus.svelte";
  import DeferredRouteStatus from "../deferred-view/DeferredRouteStatus.svelte";
  import type { HomeBridge } from "../home/types";
  import { personAvatar } from "../home/model";
  import {
    provideUserMenu,
    type UserMenuActions,
  } from "../app-navigation/menuBridge";
  let {
    services,
    roomSnippet,
    effects = createApplicationShellEffects(window, document),
  }: {
    services: BrowserApplicationServices;
    roomSnippet: Snippet<[ApplicationRoomPresentation]>;
    effects?: ApplicationShellEffects;
  } = $props();
  const application = untrack(() => services.state),
    personal = untrack(() => services.personal.state),
    room = untrack(() => services.rootRoom.state);
  const inbox = untrack(() => createApplicationInbox(services)),
    inboxView = inbox.state;
  const openInbox = (trigger?: HTMLElement) =>
    inbox.open(
      trigger ??
        (document.activeElement instanceof HTMLElement
          ? document.activeElement
          : undefined),
    );
  let active = true,
    theme = $state<ApplicationTheme>(untrack(() => effects.theme()));
  const current = () => active && services.active();
  const homeModule = untrack(() =>
      createDeferredModule(
        () =>
          import("../home/HomePanel.svelte").then((module) => module.default),
        { current },
      ),
    ),
    homeModuleView = homeModule.state;
  const archivedModule = untrack(() =>
      createDeferredModule(
        () =>
          import("../home/ArchivedPanel.svelte").then(
            (module) => module.default,
          ),
        { current },
      ),
    ),
    archivedModuleView = archivedModule.state;
  const accountModule = untrack(() =>
      createDeferredModule(
        () =>
          import("../account/AccountSettings.svelte").then(
            (module) => module.default,
          ),
        { current },
      ),
    ),
    accountModuleView = accountModule.state;
  const inboxModule = untrack(() =>
      createDeferredModule(
        () => import("../../Inbox.svelte").then((module) => module.default),
        { current },
      ),
    ),
    inboxModuleView = inboxModule.state;
  const Home = $derived($homeModuleView.component),
    Archived = $derived($archivedModuleView.component),
    AccountSettings = $derived($accountModuleView.component),
    Inbox = $derived($inboxModuleView.component);
  const accountView = untrack(() => services.account.state);
  $effect(() => {
    $application.lifecycle;
    if (!$application.sessionDenied) {
      if ($application.route.kind === "home") void homeModule.ensure();
      if ($application.route.kind === "archived") void archivedModule.ensure();
      if ($accountView.open) void accountModule.ensure();
      if ($inboxView.binding && !$inboxView.binding.roomScope)
        void inboxModule.ensure();
    }
  });
  const ago = (ts: number) => {
    const minutes = Math.round((Date.now() - ts) / 60000);
    return minutes < 1
      ? services.t("agora")
      : minutes < 60
        ? `${minutes} min`
        : minutes < 1440
          ? `${Math.round(minutes / 60)} h`
          : `${Math.round(minutes / 1440)} d`;
  };
  function nextTheme() {
    if (!current()) return;
    theme = theme === "auto" ? "light" : theme === "light" ? "dark" : "auto";
    effects.setTheme(theme);
  }
  function chooseTheme(next: ApplicationTheme) {
    if (!current() || next === theme) return;
    theme = next;
    effects.setTheme(theme);
  }
  const language = (value: "pt" | "en") => {
    if (current() && value !== services.language) effects.setLanguage(value);
  };
  // The avatar menu's actions, the same in the rail and in a phone room's sheet.
  const menuActions: UserMenuActions = {
    onaccount: (section, trigger) => {
      if (current()) services.actions.openAccount(section, trigger);
    },
    pwa: untrack(() => services.pwa),
    onlogout: () => {
      if (current()) void services.actions.logout(false);
    },
  };
  provideUserMenu({
    ...menuActions,
    lang: untrack(() => services.language),
    theme: () => theme,
    onsettheme: chooseTheme,
    onlanguage: language,
  });
  const displayName = (email: string) =>
    $room.room?.names?.[email] ||
    ($personal.me?.email === email
      ? $personal.me.name
      : $personal.me?.friends.find((friend) => friend.email === email)?.name) ||
    email.split("@")[0]!;
  const avatar = (email: string) => {
    const version = $room.room?.avatars?.[email];
    return version
      ? `/api/avatar/${encodeURIComponent(email)}?v=${version}`
      : personAvatar($personal.me, email);
  };
  const home = $derived<HomeBridge>({
    pwa: services.pwa,
    personal: services.personal,
    rooms: services.rooms,
    profile: services.account,
    creator: services.navigation.creator,
    lang: services.language,
    ago,
    onnavigate: (target) => {
      if (current()) services.actions.navigate(target);
    },
    onhome: () => {
      if (current()) services.actions.home();
    },
    onarchived: () => {
      if (current()) services.actions.archived();
    },
    onnew: (trigger) => {
      if (current()) services.navigation.openCreate(trigger);
    },
    onsettings: (section) => {
      if (current()) services.actions.openAccount(section);
    },
    onroomsettings: (id, trigger) => {
      if (current()) services.navigation.openSettings(id, trigger);
    },
    oninbox: (trigger) => {
      if (current()) openInbox(trigger);
    },
    onsearch: () => {
      if (current()) services.navigation.openSearch();
    },
    onlanguage: language,
  });
  onMount(() => {
    effects.documentLanguage(services.language);
    const stopTheme = effects.listenTheme(() => {
      if (active) theme = effects.theme();
    });
    const stopNavigation = effects.listenNavigation((event, anchor) => {
      if (
        !current() ||
        !anchor.isConnected ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey ||
        (anchor.target && anchor.target !== "_self") ||
        anchor.hasAttribute("download")
      )
        return;
      event.preventDefault();
      services.actions.navigate(anchor.href);
    });
    services.start();
    return () => {
      stopTheme();
      stopNavigation();
    };
  });
  onDestroy(() => {
    active = false;
    homeModule.dispose();
    archivedModule.dispose();
    accountModule.dispose();
    inboxModule.dispose();
    inbox.dispose();
    services.dispose();
  });
</script>

<div
  data-vb-native
  data-native-app-shell
  class={[
    $application.route.kind === "room"
      ? "tw:grid tw:h-dvh tw:min-h-0 tw:grid-cols-[minmax(0,1fr)] tw:grid-rows-[minmax(0,1fr)] tw:overflow-hidden tw:min-[901px]:grid-cols-[68px_minmax(0,1fr)] tw:min-[901px]:bg-sidebar"
      : "tw:grid tw:min-h-dvh tw:grid-cols-[minmax(0,1fr)] tw:grid-rows-[auto_1fr] tw:min-[901px]:grid-cols-[68px_minmax(0,1fr)] tw:min-[901px]:grid-rows-[auto]",
    "tw:bg-background tw:font-sans tw:text-sm tw:leading-6 tw:text-foreground",
  ]}
>
  {#if !$application.sessionDenied}
    {#if $personal.me}<AppNavigation
        controller={services.navigation}
        inRoom={$application.route.kind === "room"}
        lang={services.language}
        {theme}
        ontheme={nextTheme}
        onsettheme={chooseTheme}
        onlanguage={language}
        {...menuActions}
        onreload={() => {
          if (current()) services.actions.reload();
        }}
      />{/if}
    <div
      data-native-application-route
      class={$application.route.kind === "room"
        ? "tw:col-start-1 tw:row-start-1 tw:h-full tw:min-h-0 tw:min-w-0 tw:overflow-hidden tw:min-[901px]:col-start-2"
        : "tw:col-start-1 tw:row-start-2 tw:min-w-0 tw:min-[901px]:col-start-2 tw:min-[901px]:row-start-1"}
    >
      {#if $application.route.kind === "home"}{#if Home}<Home
            {...home}
          />{:else}<DeferredRouteStatus
            phase={$homeModuleView.phase}
            lang={services.language}
            label={services.language === "en"
              ? "Your vibebooks"
              : "Seus vibebooks"}
            retry={() => {
              void homeModule.retry();
            }}
            {current}
          />{/if}
      {:else if $application.route.kind === "archived"}{#if Archived}<Archived
            {...home}
          />{:else}<DeferredRouteStatus
            phase={$archivedModuleView.phase}
            lang={services.language}
            label={services.language === "en"
              ? "Archived rooms"
              : "Salas arquivadas"}
            retry={() => {
              void archivedModule.retry();
            }}
            {current}
          />{/if}
      {:else if $application.route.kind === "room"}<div
          data-native-room-root
          class="tw:h-full tw:min-h-0 tw:min-w-0 tw:overflow-hidden"
        >
          {@render roomSnippet({ services, openInbox, inbox })}
        </div>{/if}
    </div>
    {#if AccountSettings}
      <AccountSettings
        owner={services.account}
        device={services.device}
        pwa={services.pwa}
        agents={services.agents}
        origin={effects.origin}
        lang={services.language}
        vb={{ t: services.t, ago }}
        {theme}
        onTheme={nextTheme}
        onLanguage={language}
        onArchive={() => {
          if (current()) {
            services.account.close();
            services.actions.archived();
          }
        }}
        onLogout={(all) => {
          if (current() && services.account.current())
            void services.actions.logout(all);
        }}
      />
    {:else if $accountView.open && $accountView.binding}{#key $accountView.binding}<Snapshot
          value={$accountView.binding}
          >{#snippet children(binding)}<Dialog
              open
              onOpenChange={(open) => {
                if (
                  !open &&
                  !AccountSettings &&
                  current() &&
                  services.account.owns(binding)
                )
                  services.account.close(binding);
              }}
            >
              <DialogContent
                data-vb-native
                class="tw:top-auto tw:bottom-0 tw:left-0 tw:max-w-none tw:translate-x-0 tw:translate-y-0 tw:rounded-b-none tw:max-h-[90dvh] tw:overflow-auto tw:sm:top-0 tw:sm:right-0 tw:sm:left-auto tw:sm:h-full tw:sm:max-h-none tw:sm:w-96 tw:sm:max-w-96 tw:sm:rounded-none tw:font-sans tw:text-sm tw:text-foreground"
                closeLabel={services.t("Fechar")}
                preventScroll={false}
                preventBodyPointerEvents={false}
                preventOverflowTextSelection={false}
                onCloseAutoFocus={(event) => {
                  // Still open: the loaded settings replace this placeholder
                  // and take focus themselves, so leave it off the trigger.
                  if (get(accountView).open) {
                    event.preventDefault();
                    return;
                  }
                  const target = services.account.returnFocus();
                  if (target?.isConnected) {
                    event.preventDefault();
                    target.focus();
                  }
                }}
              >
                <DialogHeader>
                  <DialogTitle class="tw:pr-8 tw:font-sans"
                    >{services.language === "en"
                      ? "Your account"
                      : "Sua conta"}</DialogTitle
                  >
                </DialogHeader><DeferredViewStatus
                  phase={$accountModuleView.phase}
                  lang={services.language}
                  label={services.language === "en"
                    ? "Your account"
                    : "Sua conta"}
                  retry={() => {
                    void accountModule.retry();
                  }}
                  current={() => current() && services.account.owns(binding)}
                />
              </DialogContent>
            </Dialog>{/snippet}</Snapshot
        >{/key}{/if}
    {#if $inboxView.binding && !$inboxView.binding.roomScope}{#key $inboxView.binding}<Snapshot
          value={$inboxView.binding}
        >
          {#snippet children(binding)}
            {#if Inbox}<Inbox
                waits={$inboxView.data.waits}
                mentions={$inboxView.data.mentions}
                tasks={$inboxView.data.tasks}
                loading={$inboxView.phase === "loading"}
                readError={$inboxView.error !== null}
                current={() => inbox.owns(binding)}
                onretry={() => inbox.refresh(binding)}
                onmention={(mention) => inbox.openMention(binding, mention)}
                ontask={(task) => inbox.openTask(binding, task)}
                roomId={binding.roomId}
                all={$inboxView.all}
                vb={{ t: services.t, ago }}
                {displayName}
                avatarUrl={avatar}
                ontab={(all) => inbox.tab(binding, all)}
                onclose={() => inbox.close(binding)}
                onresolve={(wait) => inbox.resolve(binding, wait)}
                onopen={(wait, event) => {
                  if (
                    event.button !== 0 ||
                    event.ctrlKey ||
                    event.metaKey ||
                    event.shiftKey ||
                    event.altKey
                  )
                    return;
                  event.preventDefault();
                  if (
                    event.currentTarget instanceof Element &&
                    event.currentTarget.isConnected
                  )
                    inbox.openWait(binding, wait);
                }}
              />{:else}<Dialog
                open
                onOpenChange={(open) => {
                  if (!open && !Inbox && current()) inbox.close(binding);
                }}
              >
                <DialogContent
                  data-vb-native
                  class="tw:font-sans tw:text-sm tw:text-foreground"
                  closeLabel={services.t("Fechar")}
                  preventScroll={false}
                  preventBodyPointerEvents={false}
                  preventOverflowTextSelection={false}
                >
                  <DialogHeader>
                    <DialogTitle class="tw:pr-8 tw:font-sans"
                      >{services.t("Caixa de entrada")}</DialogTitle
                    >
                  </DialogHeader><DeferredViewStatus
                    phase={$inboxModuleView.phase}
                    lang={services.language}
                    label={services.language === "en"
                      ? "Inbox"
                      : "Caixa de entrada"}
                    retry={() => {
                      void inboxModule.retry();
                    }}
                    current={() => current() && inbox.owns(binding)}
                  />
                </DialogContent>
              </Dialog>{/if}
          {/snippet}
        </Snapshot>{/key}{/if}
  {/if}
  <DeviceLockScreen owner={services.device} lang={services.language} />
</div>
