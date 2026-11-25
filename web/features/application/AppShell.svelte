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
  import UpdateRow from "../app-navigation/UpdateRow.svelte";
  import AccountRow from "../app-navigation/AccountRow.svelte";
  import SidebarFoot from "../app-navigation/SidebarFoot.svelte";
  import DeviceLockScreen from "../account/DeviceLockScreen.svelte";
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
  import { MediaQuery } from "svelte/reactivity";
  import { MOBILE_QUERY } from "../../lib/breakpoints";
  import IncomingCall from "../call/IncomingCall.svelte";
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
        () => import("./Inbox.svelte").then((module) => module.default),
        { current },
      ),
    ),
    inboxModuleView = inboxModule.state;
  const homeInboxModule = untrack(() =>
      createDeferredModule(
        () => import("./HomeInbox.svelte").then((module) => module.default),
        { current },
      ),
    ),
    homeInboxModuleView = homeInboxModule.state;
  const Home = $derived($homeModuleView.component),
    Archived = $derived($archivedModuleView.component),
    AccountSettings = $derived($accountModuleView.component),
    Inbox = $derived($inboxModuleView.component),
    HomeInbox = $derived($homeInboxModuleView.component);
  // `/?inbox`, and `/` on a desktop: the home shows your Inbox for all rooms
  // (HomeInbox; Gimenes #3967). On a desktop, only someone with no rooms yet
  // keeps the Home, for its first-room and connect-agent steps. A phone keeps
  // its list of conversations at `/`.
  const phone = new MediaQuery(MOBILE_QUERY);
  const homeInbox = $derived(
    $application.route.kind === "home" &&
      (!!$application.route.inbox ||
        (!phone.current && ($personal.me?.books.length ?? 1) > 0)),
  );
  const accountView = untrack(() => services.account.state);
  // The page owns the Inbox while it's open: a route change closes it (inbox.ts), this opens it again.
  $effect(() => {
    if (
      homeInbox &&
      !$application.sessionDenied &&
      $personal.me &&
      !$inboxView.binding
    )
      untrack(() => inbox.open());
  });
  $effect(() => {
    $application.lifecycle;
    if (!$application.sessionDenied) {
      if (homeInbox) void homeInboxModule.ensure();
      else if ($application.route.kind === "home") void homeModule.ensure();
      if ($application.route.kind === "archived") void archivedModule.ensure();
      if ($application.route.kind === "settings") void accountModule.ensure();
      if ($inboxView.binding && !$inboxView.binding.roomScope && !homeInbox)
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
  // Phones: Settings has only a back in its bar (Gimenes #4068). It returns to the page you came
  // from in this app; a Settings page that was the first page loaded goes to Home instead.
  let landing: string | undefined,
    moved = $state(false);
  $effect(() => {
    const href = $application.href;
    untrack(() => {
      if (landing === undefined) landing = href;
      else if (href !== landing) moved = true;
    });
  });
  function settingsBack() {
    if (!current()) return;
    if (moved) effects.back();
    else services.actions.home();
  }
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
    onroommenu: (id, trigger, point) => {
      if (current()) services.navigation.openMenu(id, trigger, point);
    },
    oninbox: (trigger) => {
      if (current()) openInbox(trigger);
    },
    onsearch: () => {
      if (current()) services.navigation.openSearch();
    },
    onjoin: services.navigation.callbacks.answerInvite,
    onanswer: services.navigation.callbacks.answerRequest,
    onconnect: services.navigation.callbacks.connect,
    ondismiss: services.navigation.callbacks.dismiss,
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
    homeInboxModule.dispose();
    inbox.dispose();
    services.dispose();
  });
</script>

<div
  data-app-shell
  class={[
    $application.route.kind === "room"
      ? "grid h-dvh min-h-0 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] overflow-hidden md:grid-cols-[68px_minmax(0,1fr)] md:bg-sidebar"
      : // Desktop: the same frame as a room, the rail outside it and the page scrolling inside; the home has your DM list beside it.
        [
          "grid min-h-dvh grid-cols-[minmax(0,1fr)] grid-rows-[auto_1fr_auto] md:h-dvh md:grid-rows-[minmax(0,1fr)] md:overflow-hidden md:bg-sidebar",
          paged
            ? "md:grid-cols-[68px_273px_minmax(0,1fr)]"
            : "md:grid-cols-[68px_minmax(0,1fr)]",
        ],
    "group/shell bg-background font-sans text-sm leading-6 text-foreground",
    // Scrollbars stay invisible until you point at (or focus into) what scrolls, like the classic app: with a
    // mouse attached, macOS otherwise draws a full track on every scroller (Gui #2893).
    "[&_*]:[scrollbar-color:transparent_transparent] [&_*:hover]:[scrollbar-color:color-mix(in_oklab,var(--vb-muted-foreground)_45%,transparent)_transparent] [&_*:focus-within]:[scrollbar-color:color-mix(in_oklab,var(--vb-muted-foreground)_45%,transparent)_transparent]",
  ]}
>
  {#if !$application.sessionDenied}
    {#if $personal.me}<AppNavigation
        controller={services.navigation}
        inRoom={$application.route.kind === "room"}
        accountInSidebar={paged}
        onback={settings ? settingsBack : undefined}
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
        class="hidden md:col-start-2 md:col-end-4 md:row-start-1 md:my-2 md:mr-2 md:ml-px md:block md:rounded-surface md:bg-background md:shadow-edge"
      ></div>
      <!-- Your DMs (or the settings' sections): beside the page on desktop (the sidebar of that surface); the DMs
        go under the home on a phone, where the settings need no list. A phone's list of conversations
        (data-home-layout="chats") already holds the DMs, so the list is not drawn under it. -->
      <aside
        data-home-dms
        class="{settings
          ? 'hidden md:flex'
          : ''} max-md:group-has-[[data-home-layout=chats]]/shell:hidden col-start-1 row-start-3 min-w-0 px-4 pt-2 pb-8 md:relative md:z-10 md:col-start-2 md:row-start-1 md:my-2 md:ml-px md:flex md:min-h-0 md:flex-col md:rounded-l-surface md:border-r md:border-border md:bg-sidebar md:px-2 md:py-2"
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
          >{#if $personal.updateAvailable}<UpdateRow
              lang={services.language === "en" ? "en" : "pt"}
            />{/if}<AccountRow
            me={$personal.me}
            current={settings}
          /></SidebarFoot
        >
      </aside>{/if}
    <div
      data-application-route
      class={$application.route.kind === "room"
        ? "col-start-1 row-start-1 h-full min-h-0 min-w-0 overflow-hidden md:col-start-2"
        : [
            "col-start-1 row-start-2 min-w-0 md:row-start-1 md:my-2 md:mr-2 md:min-h-0 md:overflow-y-auto md:overscroll-contain",
            paged
              ? // Inside the home's surface, right of the DM list: that surface draws the frame.
                "relative md:col-start-3 md:rounded-r-surface"
              : "md:col-start-2 md:ml-px md:rounded-surface md:bg-background md:shadow-edge",
          ]}
    >
      {#if homeInbox}{#if HomeInbox}<HomeInbox
            owner={inbox}
            {services}
          />{:else}<DeferredRouteStatus
            phase={$homeInboxModuleView.phase}
            lang={services.language}
            label={services.language === "en" ? "Inbox" : "Caixa de entrada"}
            retry={() => {
              void homeInboxModule.retry();
            }}
            {current}
          />{/if}
      {:else if $application.route.kind === "home"}{#if Home}<Home
            {...home}
          />{:else if $homeModuleView.phase !== "error"}<HomeSkeleton
            page
            label={services.language === "en" ? "Loading…" : "Carregando…"}
            title={services.language === "en" ? "Chats" : "Conversas"}
          />{:else}<DeferredRouteStatus
            phase={$homeModuleView.phase}
            lang={services.language}
            label={services.language === "en" ? "Your rooms" : "Suas salas"}
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
          data-room-root
          class="h-full min-h-0 min-w-0 overflow-hidden"
        >
          {@render roomSnippet({ services })}
        </div>{/if}
    </div>
    {#if $inboxView.binding && !$inboxView.binding.roomScope && !homeInbox}{#key $inboxView.binding}<Snapshot
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
                vb={{ t: services.t, ago }}
                {displayName}
                avatarVersion={avatar}
                roomLabel={(roomId, title) =>
                  roomLabel($personal.me, roomId, title, services.language)}
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
                  class="font-sans text-sm text-foreground"
                  closeLabel={services.t("Fechar")}
                  preventScroll={false}
                  preventBodyPointerEvents={false}
                  preventOverflowTextSelection={false}
                >
                  <DialogHeader>
                    <DialogTitle class="pr-8 font-sans"
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
  <IncomingCall
    current={$room.roomId ?? null}
    navigate={(path) => services.actions.navigate(path)}
    chime={() => services.pwa.alert()}
    t={services.t}
  />
  <DeviceLockScreen owner={services.device} lang={services.language} />
</div>
