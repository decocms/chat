<script lang="ts">
  import { MOBILE_QUERY } from "../../lib/breakpoints";
  import { onMount, onDestroy, untrack, tick } from "svelte";
  import { MediaQuery } from "svelte/reactivity";
  import Button from "../../lib/studio/Button.svelte";
  import { tabTitle } from "../notifications/title";
  import { setFaviconBadge } from "../notifications/favicon";
  import InstallCard from "../pwa/InstallCard.svelte";
  import NotifyOffer from "../notifications/NotifyOffer.svelte";
  import Heading from "../../lib/ui/Heading.svelte";
  import Spinner from "../../lib/studio/Spinner.svelte";
  import OrgAvatar from "../../lib/components/OrgAvatar.svelte";
  import type { HomeBridge } from "./types";
  import { homeText, homeIssue } from "./copy";
  import {
    roomIcon,
    targetHref,
    waitTarget,
    homeWaitText,
    claudeWait,
    personVersion,
    dmEntry,
    roomLabel,
    waitKind,
    orderedRooms,
    roomsOnly,
    chatList,
    type RoomTarget,
    type WaitKind,
  } from "./model";
  import RoomTile from "./RoomTile.svelte";
  import HomeAsk from "./HomeAsk.svelte";
  import ChatList from "./ChatList.svelte";
  import AccountRow from "../app-navigation/AccountRow.svelte";
  import UpdateRow from "../user-center/UpdateRow.svelte";
  import UserCenter from "../user-center/UserCenter.svelte";
  import Requests from "../app-navigation/Requests.svelte";
  import AskRow from "../user-center/AskRow.svelte";
  import CompanyRooms from "../app-navigation/CompanyRooms.svelte";
  import { corporateDomain } from "../../../shared/dm";
  import { userCenterCount } from "../user-center/count";
  import Icon from "../../lib/studio/Icon.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import HomeSkeleton from "./HomeSkeleton.svelte";
  import AgentMark from "../../lib/components/AgentMark.svelte";
  import VibeCube from "./VibeCube.svelte";
  import PersonAvatar from "../../lib/components/PersonAvatar.svelte";
  import { mountCube } from "./cube";
  import { byImportance, fanClasses, inFan } from "./deskHand";
  import Onboarding from "../onboarding/Onboarding.svelte";
  import NewMessage from "../app-navigation/NewMessage.svelte";
  import { createOnboardingSession } from "../onboarding/session";
  import RoomRow from "../app-navigation/RoomRow.svelte";
  import RoomAvatar from "../rooms/RoomAvatar.svelte";
  import { createApplicationCopy } from "../application/copy";
  import {
    HOME_INBOX_TABS,
    homeInboxLeave,
    homeInboxLists,
    homeInboxSaid,
    homeInboxWho,
    type HomeInboxCard,
    type HomeInboxTab,
  } from "../application/homeInboxLists";
  import { inboxPreview } from "../application/roomInboxModel";
  import { keyboardInset } from "./keyboardInset";
  import ChatRowEnd from "./ChatRowEnd.svelte";
  import AskStarters from "./AskStarters.svelte";
  import InboxClear from "./InboxClear.svelte";
  let {
    pwa,
    personal,
    rooms,
    profile,
    creator,
    lang,
    ago,
    onnavigate,
    onhome,
    onarchived,
    onnew,
    onroommenu,
    onsearch,
    onjoin,
    onanswer,
    onconnect,
    ondismiss,
    company,
    oncompany,
    oncompanyopen,
    oncompanyclose,
    inbox,
  }: HomeBridge = $props();
  const account = $derived(personal.state);
  const pwaView = $derived(pwa.state);
  // The phone's user center: how many rows it has (the bar's avatar shows the number).
  const centerCount = $derived(
    userCenterCount({
      update: $account.updateAvailable,
      pwa: $pwaView,
      me: $account.me,
    }),
  );
  const mobile = new MediaQuery(MOBILE_QUERY);
  const onboarding = untrack(() => {
      let storage: Storage | null = null;
      try {
        storage = localStorage;
      } catch {
        /* Browser storage may be disabled. */
      }
      return createOnboardingSession(personal, profile, creator, { storage });
    }),
    onboardingView = onboarding.state;
  const text = (
    key: Parameters<typeof homeText>[1],
    vars?: Record<string, string | number>,
  ) => homeText(lang, key, vars);
  // A phone's list of conversations: the Inbox's tabs as chips over it ("Todas" is the list itself), the
  // same lists the desktop Home's tabs show (homeInboxLists). The page holds the Inbox open for them (AppShell).
  const appText = $derived(createApplicationCopy(lang === "en" ? "en" : "pt"));
  const inboxView = untrack(() => inbox?.state);
  // The chip you picked stays while you go into a room and back (this tab only).
  const CHIP_KEY = "vb:home-chip";
  let chip = $state<"all" | HomeInboxTab>(
    untrack(() => {
      try {
        const saved = sessionStorage.getItem(CHIP_KEY);
        return saved === "foryou" || saved === "mentions" || saved === "tasks"
          ? saved
          : "all";
      } catch {
        return "all";
      }
    }),
  );
  const inboxLists = $derived(
    $inboxView && $account.me
      ? homeInboxLists({
          data: $inboxView.data,
          hidden: $inboxView.hidden,
          me: $account.me,
          lang: lang === "en" ? "en" : "pt",
          t: appText,
        })
      : null,
  );
  const chips = $derived([
    { id: "all" as const, label: appText("Todas"), count: 0 },
    ...(inbox
      ? HOME_INBOX_TABS.map((tab) => ({
          id: tab.id,
          label: appText(tab.label),
          count: inboxLists?.[tab.id].length ?? 0,
        }))
      : []),
  ]);
  // The @s of you, from the Inbox's Menções: their rooms get the "@" badge in Todas, their rows in the chips.
  const mentionKeys = $derived(
    new Set((inboxLists?.mentions ?? []).map((card) => card.key)),
  );
  const mentionRooms = $derived(
    new Set((inboxLists?.mentions ?? []).map((card) => card.book)),
  );
  /** A starter of the Inbox at zero: its words go into the docked ask box, the caret at their end. */
  function start(value: string) {
    personal.editAsk(value);
    void tick().then(() => {
      const field = document.getElementById("home-ask");
      if (!(field instanceof HTMLTextAreaElement)) return;
      field.focus();
      field.setSelectionRange(value.length, value.length);
    });
  }
  const chipItems = $derived(chip === "all" ? [] : (inboxLists?.[chip] ?? []));
  function chipEmpty(tab: HomeInboxTab) {
    switch (tab) {
      case "foryou":
        return appText("Nada esperando você.");
      case "mentions":
        return appText("Nenhuma menção.");
      case "tasks":
        return appText("Nenhuma tarefa aberta.");
      default: {
        const never: never = tab;
        return never;
      }
    }
  }
  const cardTarget = (card: HomeInboxCard): RoomTarget => ({
    roomId: card.book,
    thread: card.thread || "main",
    messageId: card.message?.messageId ?? card.message?.mention?.msg_id,
  });
  /** The row's name: the room and its thread (a task: its thread). */
  const cardLabel = (card: HomeInboxCard) =>
    card.kind === "thread" || !card.where
      ? card.room
      : `${card.room} › ${card.where}`;
  /** Under it: who wrote and what; a task or a thread says itself. */
  const cardMeta = (card: HomeInboxCard) =>
    card.kind === "task"
      ? card.text
      : card.kind === "thread"
        ? [card.text, card.where].filter(Boolean).join(" · ")
        : `${homeInboxWho(card, $account.me, appText)}: ${inboxPreview(homeInboxSaid(card))}`;
  function openCard(card: HomeInboxCard) {
    const binding = $inboxView?.binding;
    if (inbox && binding && inbox.owns(binding))
      homeInboxLeave(inbox, binding, card, onnavigate);
    else onnavigate(cardTarget(card));
  }
  // The desk home: what waits on you as a hand of cards, most important in the middle.
  const waits = $derived(byImportance($account.me?.waits ?? []));
  // The tab's icon carries a red dot while the title shows "(n)".
  $effect(() => setFaviconBadge(waits.length > 0));
  onDestroy(() => setFaviconBadge(false));
  // Triage filters over the cards; a filter with nothing in it hides. Picking
  // one scrolls down to the cards, so they deal out already filtered.
  let filter = $state<"all" | WaitKind>("all");
  let filterBar = $state<HTMLElement | null>(null);
  const filters = $derived.by(() => {
    const count = (kind: WaitKind) =>
      waits.filter((wait) => waitKind(wait) === kind).length;
    return [
      { kind: "all" as const, label: text("filterAll"), count: waits.length },
      {
        kind: "claude" as const,
        label: text("filterClaude"),
        count: count("claude"),
      },
      {
        kind: "asks" as const,
        label: text("filterAsks"),
        count: count("asks"),
      },
      {
        kind: "reviews" as const,
        label: text("filterReviews"),
        count: count("reviews"),
      },
    ].filter((option) => option.kind === "all" || option.count);
  });
  const shown = $derived(
    filter === "all"
      ? waits
      : waits.filter((wait) => waitKind(wait) === filter),
  );
  $effect(() => {
    // A filter that emptied (its last wait was answered) falls back to all.
    if (filter !== "all" && !shown.length) filter = "all";
  });
  async function pick(kind: "all" | WaitKind) {
    filter = kind;
    await tick();
    if (!filterBar?.isConnected) return;
    const box = scroller(),
      behavior: ScrollBehavior = reducedMotion.current ? "auto" : "smooth";
    const offset =
      filterBar.getBoundingClientRect().top -
      (box ? box.getBoundingClientRect().top : 0) -
      16;
    if (box)
      box.scrollTo({ top: Math.max(box.scrollTop + offset, 8), behavior });
    else scrollTo({ top: Math.max(scrollY + offset, 8), behavior });
  }
  // On a phone, your rooms as a home screen of icons under the ask box: one tap
  // to any of them, in the rail's order so they stay where your thumb expects.
  // Two rows at most; past that the last icon opens search, which lists all.
  const GRID = 8;
  const gridRooms = $derived(orderedRooms(roomsOnly($account.me?.books ?? [])));
  const gridShown = $derived(
    gridRooms.length > GRID ? gridRooms.slice(0, GRID - 1) : gridRooms,
  );
  const headline = $derived(
    waits.length === 0
      ? text("deskNone")
      : waits.length === 1
        ? text("deskOne")
        : text("deskMany", { n: waits.length }),
  );
  let home = $state<HTMLElement | null>(null),
    hand = $state<HTMLElement | null>(null),
    cube = $state<HTMLCanvasElement | null>(null),
    dealt = $state(false);
  const reducedMotion = new MediaQuery("(prefers-reduced-motion: reduce)");
  const phone = new MediaQuery(MOBILE_QUERY);
  // Scrolling down deals the hand into a grid; back at the top it fans again.
  // What scrolls depends on the width: the app frame on a desktop (#92), the
  // window on a phone. Both are read through the nearest scrolling ancestor.
  function scroller() {
    for (let el = home?.parentElement; el; el = el.parentElement) {
      const overflow = getComputedStyle(el).overflowY;
      if (overflow === "auto" || overflow === "scroll") return el;
    }
    return null;
  }
  const scrolled = () => {
    const box = scroller();
    return box ? box.scrollTop : scrollY;
  };
  function onscroll() {
    const y = scrolled();
    const next = y > 4 ? true : y <= 0 ? false : dealt;
    if (next !== dealt) void deal(next);
  }
  // The deal moves each card from where it stood to where it lands (FLIP):
  // measured before and after the classes change, played with the Web
  // Animations API so nothing but the motion lives in script.
  async function deal(next: boolean) {
    const cards = hand
      ? [...hand.querySelectorAll<HTMLElement>("[data-home-card]")]
      : [];
    const before = cards.map((card) => card.getBoundingClientRect());
    dealt = next;
    if (reducedMotion.current || !cards.length) return;
    await tick();
    cards.forEach((card, i) => {
      const from = before[i];
      if (!from || !card.isConnected) return;
      card.getAnimations().forEach((animation) => animation.cancel());
      const to = card.getBoundingClientRect();
      if (!to.width || !to.height) return;
      const final = getComputedStyle(card).transform;
      const dx = from.left + from.width / 2 - (to.left + to.width / 2),
        dy = from.top + from.height / 2 - (to.top + to.height / 2);
      card.animate(
        [
          {
            transform: `translate(${dx}px, ${dy}px) scale(${from.width / to.width}, ${from.height / to.height}) ${final === "none" ? "" : final}`,
          },
          { transform: final },
        ],
        {
          duration: 280,
          delay: Math.min(i, 6) * 8,
          easing: "cubic-bezier(0.23, 1, 0.32, 1)",
          fill: "backwards",
        },
      );
    });
  }
  $effect(() => {
    // Capture: scroll events from the frame do not bubble to the window.
    document.addEventListener("scroll", onscroll, {
      passive: true,
      capture: true,
    });
    return () =>
      document.removeEventListener("scroll", onscroll, { capture: true });
  });
  $effect(() => {
    if (cube) return mountCube(cube);
  });
  const who = (wait: (typeof waits)[number]) =>
    claudeWait(wait)
      ? text("yourClaude")
      : wait.author === "ai"
        ? "@vibe"
        : wait.author_name || wait.author.split("@")[0] || "";
  const plainClick = (event: MouseEvent) =>
    !(event.ctrlKey || event.metaKey || event.shiftKey || event.altKey);
  let mounted = false,
    agentTimer: ReturnType<typeof setTimeout> | undefined,
    copyStatus = $state("");
  onDestroy(() => {
    onboarding.dispose();
  });
  onMount(() => {
    mounted = true;
    void personal.refresh();
    const poll = () => {
      if (!mounted) return;
      if (!$onboardingView.visible && !$account.agents?.agents.length)
        void personal.refreshAgents();
      agentTimer = setTimeout(poll, 15_000);
    };
    poll();
    return () => {
      mounted = false;
      clearTimeout(agentTimer);
    };
  });
  const setup = $derived(
    `Read ${location.origin}/llms.txt and set up deco.chat for this project.`,
  );
  async function copy() {
    try {
      if (!navigator.clipboard) throw Error("unavailable");
      await navigator.clipboard.writeText(setup);
      if (mounted) copyStatus = "copied";
    } catch {
      if (mounted) copyStatus = "copyFailed";
    }
  }
</script>

<!-- Connecting an agent, inline under the ask box: the agents' marks, the
     instruction itself and one click to copy it for Claude Code. -->
{#snippet connectAgent()}<div
    data-home-connect
    class="flex w-full flex-col gap-2.5 rounded-2xl bg-card p-3 text-left shadow-edge"
  >
    <div class="flex items-center gap-2.5">
      <span class="flex shrink-0 items-center -space-x-1.5"
        >{#each ["claude", "codex", "gemini"] as via (via)}<AgentMark
            {via}
            tint
            size="xs"
            class="rounded-full ring-2 ring-card"
          />{/each}</span
      >
      <b class="min-w-0 flex-1 truncate font-medium">{text("setup")}</b>
      <Button size="sm" class="shrink-0" onclick={copy}
        >{#if copyStatus === "copied"}<Icon icon="check" size={14} />{/if}<span
          class="max-md:hidden"
          >{text(copyStatus === "copied" ? "copied" : "deskCopyAgent")}</span
        ><span class="md:hidden"
          >{text(copyStatus === "copied" ? "copied" : "copy")}</span
        ></Button
      >
    </div>
    <code
      class="block rounded-control bg-muted px-3 py-2 font-mono text-xs leading-5 break-words text-foreground select-all"
      >{setup}</code
    >{#if !copyStatus}<p class="m-0 text-xs text-muted-foreground">
        {text("deskConnectHelp")}
      </p>{:else}<p
        role={copyStatus === "copyFailed" ? "alert" : "status"}
        class={[
          "m-0 text-xs",
          copyStatus === "copyFailed"
            ? "text-destructive"
            : "text-muted-foreground",
        ]}
      >
        {text(copyStatus === "copyFailed" ? "copyFailed" : "deskCopied")}
      </p>{/if}
  </div>{/snippet}

<svelte:head><title>{tabTitle("deco.chat", waits.length)}</title></svelte:head>
<!-- The first run is a dialog over this Home, not a page of its own (Valls). -->
<Onboarding owner={onboarding} {lang} />
{#if mobile.current && !$account.me && !$account.error}
  <!-- A phone while your account loads: the list's bar, title on the left (Gimenes #3878). -->
  <HomeSkeleton label={text("loading")} title={text("chatsTitle")} chats />
{:else if mobile.current && $account.me && chatList($account.me).length}
  <!-- A phone: the home is the list of conversations, like a chat app (Gimenes #3800).
       Someone with no conversation yet gets the desk below, with its way in.
       Like WhatsApp's chats screen: its own bar ("Conversas" / "Chats" and you; no inbox, Gimenes #4144),
       a search field, the Inbox tabs as filter chips, the list, and the ask box docked at the foot
       (its + makes a room or a message, where the floating + was).
       The shell hides the app's phone bar and the DM list under this layout. -->
  <main
    data-view="home"
    data-home-layout="chats"
    class="min-h-full bg-background px-2 pb-[calc(5.5rem+env(safe-area-inset-bottom))] font-sans text-base leading-6 text-foreground"
  >
    <header
      data-home-bar
      class="sticky top-0 z-40 -mx-2 flex h-14 items-center gap-2 bg-background pr-3 pl-4"
    >
      <!-- A 28px title (PO: WhatsApp's 34px was too big), its search field (44px, 17px type) and its rows (ChatList). -->
      <h1
        class="m-0 min-w-0 flex-1 truncate text-[1.75rem] leading-9 font-bold tracking-tight"
      >
        {text("chatsTitle")}
      </h1>
      <!-- Rooms open to your company that you did not join (2×2 grid): never in the list, join one from here. -->
      {#if $account.me && corporateDomain($account.me.email)}<CompanyRooms
          phone
          rooms={$company ?? []}
          {lang}
          onjoin={oncompany}
          onopen={oncompanyopen}
          onclose={oncompanyclose}
        />{/if}
      <!-- New: a DM (people from your rooms, or an email) or a room (Gui #4572), as WhatsApp's top-right action. -->
      {#if $account.me}<NewMessage
          me={$account.me}
          {lang}
          sheet
          {onconnect}
          {ondismiss}
          onroom={(trigger) => {
            if (trigger?.isConnected) onnew(trigger);
            else onnew();
          }}
          >{#snippet trigger({ props })}<Button
              {...props}
              variant="secondary"
              data-home-new
              aria-label={text("newMessage")}
              class="size-10 shrink-0 rounded-full p-0"
              ><Icon icon="plus" class="size-[22px]" /></Button
            >{/snippet}</NewMessage
        >{/if}
      <AccountRow
        me={$account.me}
        row={false}
        badge={{
          count: centerCount,
          label:
            centerCount === 1
              ? text("centerOne")
              : text("centerMany", { n: centerCount }),
        }}
      />
    </header>
    <div class="px-2 pb-2">
      <button
        type="button"
        data-home-search
        class="flex h-11 w-full cursor-pointer items-center gap-3 rounded-full border-0 bg-muted px-4 text-left font-sans text-lg text-muted-foreground outline-offset-2 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring"
        onclick={() => onsearch()}
        ><Icon icon="search-md" class="size-5 shrink-0" /><span
          class="min-w-0 truncate">{text("searchPlaceholder")}</span
        ></button
      >
    </div>
    <!-- The Inbox's tabs as WhatsApp's filter chips ("Todas · Não lidas 16 · …"): one row that scrolls
         sideways, the count after the label, the chosen one filled. -->
    {#if chips.length > 1}<div
        role="group"
        aria-label={appText("Caixa de entrada")}
        data-home-chips
        class="-mx-2 flex gap-2 overflow-x-auto overscroll-x-contain px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {#each chips as option (option.id)}<button
            type="button"
            data-home-chip={option.id}
            aria-pressed={chip === option.id}
            class={[
              "flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border-0 px-3.5 font-sans text-[15px] leading-5 font-medium whitespace-nowrap outline-offset-2 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring",
              chip === option.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground",
            ]}
            onclick={() => {
              chip = option.id;
              try {
                sessionStorage.setItem(CHIP_KEY, option.id);
              } catch {
                /* No storage: the chip resets when you come back. */
              }
              scrollTo({ top: 0 });
            }}
            >{option.label}{#if option.count}<span
                data-home-chip-count
                class="tabular-nums">{option.count}</span
              >{/if}</button
          >{/each}
      </div>{/if}
    <!-- The phone's user center (Gimenes, step 4): the desktop sidebar's rows, in its order, under the search. Each row
      goes when it is done; inside a room only their count shows, on ← (RoomHeader). This list draws only on a phone. -->
    {#if centerCount}<div class="mb-2 px-2">
        <UserCenter phone
          >{#if $account.updateAvailable}<UpdateRow {lang} />{/if}<InstallCard
            owner={pwa}
            {lang}
            row
          /><NotifyOffer owner={pwa} {lang} row /><Requests
            center
            invites={$account.me.invites ?? []}
            requests={$account.me.requests}
            {lang}
            {onjoin}
            {onanswer}
          /><AskRow
            waits={$account.me.waits}
            {lang}
            onopen={onnavigate}
            onanswered={() => {
              personal.invalidate();
              void personal.refresh();
            }}
          /></UserCenter
        >
      </div>{/if}
    {#if chip === "all"}<ChatList
        me={$account.me}
        seen={$account.seen}
        now={$account.now}
        {lang}
        {ago}
        {onnavigate}
        onmenu={onroommenu}
        mentioned={mentionRooms}
      />{:else if chipItems.length}{@const me = $account.me}
      <nav
        data-home-inbox-list={chip}
        aria-label={chips.find((option) => option.id === chip)?.label}
        class="w-full"
      >
        <ul class="m-0 list-none space-y-0.5 p-0">
          {#each chipItems as card (card.key)}{@const dm = dmEntry(
              me,
              card.book,
            )}
            <li data-home-inbox-item={card.kind}>
              <RoomRow
                href={targetHref(cardTarget(card))}
                label={cardLabel(card)}
                meta={cardMeta(card)}
                urgent={card.kind === "claude"}
                variant="chats"
                onopen={() => openCard(card)}
              >
                {#snippet leading()}<RoomAvatar
                    size="chat"
                    title={dm ? dm.name : card.room}
                    icon={card.summary ? roomIcon(card.summary) : undefined}
                    person={dm}
                    {lang}
                    surface="background"
                  />{/snippet}
                {#snippet trailing()}<ChatRowEnd
                    time={card.ts ? ago(card.ts) : null}
                    mention={mentionKeys.has(card.key)}
                    {lang}
                  />{/snippet}
              </RoomRow>
            </li>{/each}
        </ul>
      </nav>{:else if chip === "foryou" && $inboxView?.phase === "ready"}<div
        data-home-inbox-empty={chip}
        role="status"
        class="flex flex-col items-center gap-2 pb-6"
      >
        <InboxClear
          me={$account.me}
          now={$account.now}
          {lang}
          title={text("clearTitle")}
          {ago}
          layout="phone"
          onopen={(roomId) => onnavigate({ roomId })}
          ><AskStarters {lang} layout="chips" onstart={start} /></InboxClear
        >
      </div>{:else}<p
        data-home-inbox-empty={chip}
        role="status"
        class="m-0 px-4 py-10 text-center text-base text-muted-foreground"
      >
        {$inboxView?.phase === "ready" || $inboxView?.phase === "error"
          ? chipEmpty(chip)
          : text("loading")}
      </p>{/if}
    <!-- The home's ask box, docked where a chat's composer is (thumb reach): what you type goes to the room
         and thread it fits; where it goes opens above the field, over the list's foot. It rides above the
         on-screen keyboard (keyboardInset). -->
    <div
      use:keyboardInset
      data-home-dock
      class="fixed inset-x-0 bottom-0 z-30 bg-background px-4 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] data-keyboard:pb-2"
    >
      <div
        data-home-ask="dock"
        class="flex min-w-0 flex-col-reverse [&>:last-child:has(>*)]:mb-2"
      >
        <HomeAsk {personal} {lang} {onnavigate} {onnew} {onsearch} dock />
      </div>
    </div>
  </main>
{:else}
  <!-- The desk home: the agent's cube, one sentence on what waits on you, the
       ask box, and what waits as a hand of cards at the foot of the screen
       (scrolling deals them into a grid). Your rooms follow the cards. -->
  <main
    bind:this={home}
    data-view="home"
    data-home-layout="desk"
    data-home-dealt={dealt ? "" : undefined}
    class="relative min-h-full overflow-x-clip bg-background font-sans text-sm leading-6 text-foreground"
  >
    <!-- The first screen: everything down to the fan, which peeks at its foot. -->
    <div
      class={[
        "flex flex-col items-center px-4 pt-4 md:px-8",
        waits.length &&
          "min-h-[calc(100dvh-3.5rem)] md:min-h-[calc(100dvh-1rem)]",
      ]}
    >
      <div class="w-full max-w-xl">
        <div class="md:hidden"><NotifyOffer owner={pwa} {lang} /></div>
        <InstallCard owner={pwa} {lang} compact />
      </div>
      <section class="mt-[10vh] flex flex-col items-center max-md:mt-4">
        <canvas
          bind:this={cube}
          width="512"
          height="512"
          aria-hidden="true"
          class="size-[200px] max-md:size-[112px]"
        ></canvas>
        {#if $account.me}{@const first =
            $account.me.name?.split(" ")[0]}<Heading
            level={1}
            class="m-0 mt-1 text-center text-4xl font-medium tracking-tight text-balance tabular-nums max-md:text-[28px] max-md:leading-9"
            >{#if waits.length}{headline}{:else}<!-- Nothing waits: a greeting and a question, the ask box answers it. -->
              <span class="block"
                >{first
                  ? text("deskHello", { name: first })
                  : text("deskHelloAnon")}</span
              ><span class="block text-muted-foreground"
                >{text("deskQuestion")}</span
              >{/if}</Heading
          >{:else if $account.error}<Heading
            level={1}
            class="m-0 mt-1 text-center text-3xl font-medium tracking-tight text-balance"
            >{text("deskLoadFailed")}</Heading
          >
          <!-- A known issue gets its sentence; a raw server code stays out of the way. -->
          {#if homeIssue(lang, $account.error) !== $account.error}<p
              class="m-0 mt-2 text-muted-foreground"
              role="alert"
            >
              {homeIssue(lang, $account.error)}
            </p>{/if}
          <Button
            class="mt-5"
            variant="outline"
            disabled={$account.loading}
            aria-busy={$account.loading || undefined}
            onclick={(event) => {
              if (event.currentTarget.isConnected) void personal.refresh();
            }}
            >{#if $account.loading}<Spinner size="xs" />{/if}{text(
              "retry",
            )}</Button
          >{:else}<HomeSkeleton
            label={text("loading")}
            title={text("chatsTitle")}
          />{/if}
      </section>
      {#if $account.me}{@const me = $account.me}
        <div
          data-home-ask="desk"
          class="relative z-30 mt-7 flex w-full max-w-[640px] flex-col items-center gap-3 [&>[data-chat-field]]:w-full"
        >
          <HomeAsk {personal} {lang} {onnavigate} {onnew} {onsearch} />
          {#if !me.books.length}<!-- No rooms yet: one clear way in. -->
            <div
              data-home-first-room
              class="mt-6 flex flex-col items-center gap-3 text-center"
            >
              <Button
                size="lg"
                class="rounded-full px-6"
                onclick={(event) => {
                  if (event.currentTarget.isConnected)
                    onnew(event.currentTarget);
                }}>{text("deskFirstRoom")}</Button
              >
              <p class="m-0 max-w-sm text-balance text-muted-foreground">
                {text("deskFirstRoomHelp")}
              </p>
            </div>{/if}
          {#if $account.agents && !$account.agents.agents.length}{@render connectAgent()}{/if}
          {#if $account.loading}<p
              role="status"
              class="m-0 text-xs text-muted-foreground"
            >
              {text("refreshing")}
            </p>{/if}
          {#if $account.error}<p
              role="alert"
              class="m-0 text-xs break-words text-destructive"
            >
              {homeIssue(lang, $account.error)}
              <button
                type="button"
                class="cursor-pointer p-0 text-foreground underline underline-offset-4"
                onclick={() => void personal.refresh()}>{text("retry")}</button
              >
            </p>{/if}
        </div>
        {#if gridRooms.length}<nav
            aria-label={text("allRooms")}
            data-home-rooms
            class="mt-6 grid w-full max-w-[400px] grid-cols-4 gap-x-2 gap-y-4 md:hidden"
          >
            {#each gridShown as room (room.id)}<RoomTile
                {room}
                {lang}
                size="xl"
                now={$account.now}
                seen={$account.seen[room.id] ?? 0}
                waits={me.waits.filter((wait) => wait.book_id === room.id)}
                {onnavigate}
                onmenu={onroommenu}
              />{/each}
            {#if gridRooms.length > GRID}<button
                type="button"
                data-home-rooms-more
                class="flex min-w-0 cursor-pointer flex-col items-center gap-1.5 rounded-control border-0 bg-transparent p-1 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onclick={() => onsearch()}
                ><span
                  class="flex size-16 items-center justify-center rounded-[1.125rem] bg-muted text-muted-foreground"
                  ><Icon icon="dots-grid" size={24} /></span
                ><span class="w-full truncate text-center text-xs leading-4"
                  >{text("allRooms")}</span
                ></button
              >{/if}
          </nav>{/if}
        <!-- At the foot of the first screen: the fan peeks above the fold. -->
        <div class="min-h-6 flex-1 max-md:max-h-16" aria-hidden="true"></div>
        {#if waits.length > 1 && filters.length > 1}<div
            bind:this={filterBar}
            role="group"
            aria-label={text("deskWaits")}
            data-home-filters
            class="relative z-30 mb-4 flex max-w-full flex-wrap justify-center gap-1.5 px-1 py-1"
          >
            {#each filters as option (option.kind)}<Button
                size="sm"
                variant={filter === option.kind ? "default" : "outline"}
                aria-pressed={filter === option.kind}
                class="shrink-0 rounded-full"
                onclick={() => void pick(option.kind)}
                >{option.label}<span
                  class={[
                    "tabular-nums",
                    filter !== option.kind &&
                      (option.kind === "claude"
                        ? "text-destructive"
                        : "text-muted-foreground"),
                  ]}>{option.count}</span
                ></Button
              >{/each}
          </div>{/if}
        {#if waits.length}<nav
            bind:this={hand}
            aria-label={text("deskWaits")}
            data-home-hand
            class={dealt
              ? "grid min-h-[calc(100dvh-5rem)] w-full max-w-[1120px] content-start grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-4 max-md:grid-cols-1 max-md:gap-3"
              : "relative -mb-[148px] h-[380px] w-full shrink-0 max-md:-mb-[40px] max-md:h-[300px]"}
          >
            {#each shown as wait, i (wait.book_id + ":" + wait.ref)}{@const room =
                me.books.find((book) => book.id === wait.book_id)}{@const dm =
                dmEntry(me, wait.book_id)}{@const task =
                wait.ref.startsWith("t")}{@const front =
                i === 0}{@const reachable =
                dealt || inFan(i, shown.length, phone.current)}<a
                href={targetHref(waitTarget(wait))}
                data-home-card={wait.ref}
                data-wait-kind={claudeWait(wait)
                  ? "claude"
                  : task
                    ? "review"
                    : "ask"}
                tabindex={reachable ? 0 : -1}
                aria-hidden={reachable ? undefined : "true"}
                class={[
                  "group/card flex flex-col gap-2 overflow-hidden rounded-[22px] bg-card px-[18px] py-4 text-foreground no-underline shadow-[0_0_0_1px_var(--vb-hairline),0_1px_2px_rgb(0_0_0/.04),0_-6px_28px_-12px_rgb(0_0_0/.18)] outline-none transition-shadow duration-150 focus-visible:ring-2 focus-visible:ring-ring",
                  dealt
                    ? "relative min-h-[176px] max-md:min-h-0 hover:shadow-[0_0_0_1px_var(--vb-input),0_8px_24px_-8px_rgb(0_0_0/.25)]"
                    : [
                        "absolute top-0 right-0 left-0 mx-auto h-[320px] w-[340px] origin-bottom max-md:h-[210px] max-md:w-[min(340px,calc(100%-16px))]",
                        fanClasses(i, shown.length),
                      ],
                ]}
                onclick={(event) => {
                  if (
                    event.ctrlKey ||
                    event.metaKey ||
                    event.shiftKey ||
                    event.altKey
                  )
                    return;
                  event.preventDefault();
                  if (event.currentTarget.isConnected)
                    onnavigate(waitTarget(wait));
                }}
                ><span
                  class={[
                    "flex flex-col gap-2 transition-opacity duration-200",
                    !dealt && !front && "opacity-35",
                  ]}
                  ><span
                    class="flex min-w-0 items-center gap-2 text-xs leading-5 text-muted-foreground"
                    >{#if dm}<PersonAvatar
                        email={dm.email}
                        version={dm.version}
                        class="size-6"
                      />{:else if room && roomIcon(room)}<img
                        src={roomIcon(room)}
                        alt=""
                        loading="lazy"
                        class="size-6 shrink-0 rounded-md object-cover"
                      />{:else}<OrgAvatar
                        name={wait.room}
                        size="xs"
                      />{/if}<span class="min-w-0 truncate"
                      >{roomLabel(me, wait.book_id, wait.room, lang)}{wait.topic
                        ? ` › ${wait.topic}`
                        : ""}</span
                    ></span
                  ><span
                    class="flex min-w-0 items-center gap-2 text-xs leading-5 text-muted-foreground"
                    >{#if task}<Icon icon="check" size={14} /><span
                        class="min-w-0 flex-1 truncate">{text("deskTask")}</span
                      >{:else if claudeWait(wait)}<AgentMark
                        size="2xs"
                        class="text-[10px]"
                      /><span
                        class="min-w-0 flex-1 truncate font-medium text-destructive"
                        >{who(wait)} · {text("needsYou")}</span
                      >{:else if wait.author === "ai"}<VibeCube
                        size="2xs"
                        class="text-[10px]"
                      /><span class="min-w-0 flex-1 truncate">{who(wait)}</span
                      >{:else}<PersonAvatar
                        size="2xs"
                        email={wait.author}
                        version={personVersion(me, wait.author)}
                      /><span class="min-w-0 flex-1 truncate">{who(wait)}</span
                      >{/if}<span class="shrink-0 tabular-nums"
                      >{ago(wait.ts)}</span
                    ></span
                  ><b
                    class="line-clamp-4 text-[17px] leading-[1.3] font-medium tracking-[-0.01em] break-words"
                    >{homeWaitText(wait, lang)}</b
                  ></span
                ></a
              >{/each}
          </nav>{/if}
      {/if}
    </div>
    <div class="h-16" aria-hidden="true"></div>
  </main>
{/if}
