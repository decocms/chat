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
  import DmNav from "../app-navigation/DmNav.svelte";
  import SettingsNav from "../app-navigation/SettingsNav.svelte";
  import AccountRow from "../app-navigation/AccountRow.svelte";
  import SidebarFoot from "../app-navigation/SidebarFoot.svelte";
  import DeviceLockScreen from "../account/DeviceLockScreen.svelte";
  import NewUiWelcome from "../onboarding/NewUiWelcome.svelte";
  import Snapshot from "../../lib/components/Snapshot.svelte";
  import Dialog from "../../lib/studio/Dialog.svelte";
  import DialogContent from "../../lib/studio/DialogContent.svelte";
  import DialogHeader from "../../lib/studio/DialogHeader.svelte";
  import DialogTitle from "../../lib/studio/DialogTitle.svelte";
  import { createDeferredModule } from "../deferred-view/module";
  import DeferredViewStatus from "../deferred-view/DeferredViewStatus.svelte";
  import DeferredRouteStatus from "../deferred-view/DeferredRouteStatus.svelte";
  import HomeSkeleton from "../home/HomeSkeleton.svelte";
  import type { HomeBridge } from "../home/types";
  import { roomAvatarVersion } from "../room-scope/model";
  import { roomLabel } from "../home/model";
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
      if ($application.route.kind === "settings") void accountModule.ensure();
      if ($inboxView.binding && !$inboxView.binding.roomScope)
        void inboxModule.ensure();
    }
  });
  // The settings page owns the account session while it's open (a page now, not a sheet).
  $effect(() => {
    const onSettings =
      !$application.sessionDenied && $application.route.kind === "settings";
    if (onSettings && $personal.me && !$accountView.open)
      untrack(() => services.account.open());
    else if (!onSettings && $accountView.open)
      untrack(() => services.account.close());
  });
  // Home and settings share one frame: the rail, a sidebar (your DMs, or the settings' sections) and the page.
  const settings = $derived($application.route.kind === "settings"),
    paged = $derived($application.route.kind === "home" || settings);
  const settingsRoom = $derived(
    $application.route.kind === "settings"
      ? new URL($application.href).searchParams.get("room")
      : null,
  );
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
  function chooseTheme(next: ApplicationTheme) {
    if (!current() || next === theme) return;
    theme = next;
    effects.setTheme(theme);
  }
  const language = (value: "pt" | "en") => {
    if (current() && value !== services.language) effects.setLanguage(value);
  };
  const displayName = (email: string) =>
    $room.room?.names?.[email] ||
    ($personal.me?.email === email
      ? $personal.me.name
      : $personal.me?.friends.find((friend) => friend.email === email)?.name) ||
    email.split("@")[0]!;
  const avatar = (email: string) =>
    roomAvatarVersion($room.room, $personal.me, email);
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
      : // Desktop: the same frame as a room, the rail outside it and the page scrolling inside; the home has your DM list beside it.
        [
          "tw:grid tw:min-h-dvh tw:grid-cols-[minmax(0,1fr)] tw:grid-rows-[auto_1fr_auto] tw:min-[901px]:h-dvh tw:min-[901px]:grid-rows-[minmax(0,1fr)] tw:min-[901px]:overflow-hidden tw:min-[901px]:bg-sidebar",
          paged
            ? "tw:min-[901px]:grid-cols-[68px_273px_minmax(0,1fr)]"
            : "tw:min-[901px]:grid-cols-[68px_minmax(0,1fr)]",
        ],
    "tw:bg-background tw:font-sans tw:text-sm tw:leading-6 tw:text-foreground",
    // Scrollbars stay invisible until you point at (or focus into) what scrolls, like the classic app: with a
    // mouse attached, macOS otherwise draws a full track on every scroller (Gui #2893).
    "tw:[&_*]:[scrollbar-color:transparent_transparent] tw:[&_*:hover]:[scrollbar-color:color-mix(in_oklab,var(--vb-muted-foreground)_45%,transparent)_transparent] tw:[&_*:focus-within]:[scrollbar-color:color-mix(in_oklab,var(--vb-muted-foreground)_45%,transparent)_transparent]",
  ]}
>
  {#if !$application.sessionDenied}
    {#if $personal.me}<AppNavigation
        controller={services.navigation}
        inRoom={$application.route.kind === "room"}
        accountInSidebar={paged}
        lang={services.language}
        onreload={() => {
          if (current()) services.actions.reload();
        }}
      />{/if}
    {#if $personal.me && paged}<!-- Desktop: one framed surface under the DM list and the page,
      the same as a room's (RoomLayoutFrame), so the list doesn't jump when you go from a DM back home. -->
      <div
        aria-hidden="true"
        data-home-surface
        class="tw:hidden tw:min-[901px]:col-start-2 tw:min-[901px]:col-end-4 tw:min-[901px]:row-start-1 tw:min-[901px]:my-2 tw:min-[901px]:mr-2 tw:min-[901px]:ml-px tw:min-[901px]:block tw:min-[901px]:rounded-surface tw:min-[901px]:bg-background tw:min-[901px]:shadow-edge"
      ></div>
      <!-- Your DMs (or the settings' sections): beside the page on desktop (the sidebar of that surface); the DMs
        go under the home on a phone, where the settings need no list. -->
      <aside
        data-native-home-dms
        class="{settings
          ? 'tw:hidden tw:min-[901px]:flex'
          : ''} tw:col-start-1 tw:row-start-3 tw:min-w-0 tw:px-4 tw:pt-2 tw:pb-8 tw:min-[901px]:relative tw:min-[901px]:z-10 tw:min-[901px]:col-start-2 tw:min-[901px]:row-start-1 tw:min-[901px]:my-2 tw:min-[901px]:ml-px tw:min-[901px]:flex tw:min-[901px]:min-h-0 tw:min-[901px]:flex-col tw:min-[901px]:rounded-l-surface tw:min-[901px]:border-r tw:min-[901px]:border-border tw:min-[901px]:bg-sidebar tw:min-[901px]:px-2 tw:min-[901px]:py-2"
      >
        {#if settings}<SettingsNav
            lang={services.language}
            onhome={() => {
              if (current()) services.actions.home();
            }}
          />{:else}<DmNav
            controller={services.navigation}
            lang={services.language}
          />{/if}
        <SidebarFoot
          ><AccountRow me={$personal.me} current={settings} /></SidebarFoot
        >
      </aside>{/if}
    <div
      data-native-application-route
      class={$application.route.kind === "room"
        ? "tw:col-start-1 tw:row-start-1 tw:h-full tw:min-h-0 tw:min-w-0 tw:overflow-hidden tw:min-[901px]:col-start-2"
        : [
            "tw:col-start-1 tw:row-start-2 tw:min-w-0 tw:min-[901px]:row-start-1 tw:min-[901px]:my-2 tw:min-[901px]:mr-2 tw:min-[901px]:min-h-0 tw:min-[901px]:overflow-y-auto tw:min-[901px]:overscroll-contain",
            paged
              ? // Inside the home's surface, right of the DM list: that surface draws the frame.
                "tw:relative tw:min-[901px]:col-start-3 tw:min-[901px]:rounded-r-surface"
              : "tw:min-[901px]:col-start-2 tw:min-[901px]:ml-px tw:min-[901px]:rounded-surface tw:min-[901px]:bg-background tw:min-[901px]:shadow-edge",
          ]}
    >
      {#if $application.route.kind === "home"}{#if Home}<Home
            {...home}
          />{:else if $homeModuleView.phase !== "error"}<HomeSkeleton
            page
            label={services.language === "en" ? "Loading…" : "Carregando…"}
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
      {:else if settings}{#if AccountSettings}<AccountSettings
            owner={services.account}
            device={services.device}
            pwa={services.pwa}
            agents={services.agents}
            origin={effects.origin}
            lang={services.language}
            vb={{ t: services.t, ago }}
            room={settingsRoom}
            {theme}
            onTheme={chooseTheme}
            onLanguage={language}
            onArchive={() => {
              if (current()) services.actions.archived();
            }}
            onLogout={(all) => {
              if (current() && services.account.current())
                void services.actions.logout(all);
            }}
          />{:else}<DeferredRouteStatus
            phase={$accountModuleView.phase}
            lang={services.language}
            label={services.language === "en" ? "Settings" : "Configurações"}
            retry={() => {
              void accountModule.retry();
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
                avatarVersion={avatar}
                roomLabel={(roomId, title) =>
                  roomLabel($personal.me, roomId, title, services.language)}
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
  {#if $personal.me}<NewUiWelcome
      returning={!!$personal.me.name}
      lang={services.language}
    />{/if}
  <DeviceLockScreen owner={services.device} lang={services.language} />
</div>
