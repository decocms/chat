<script lang="ts">
  import { MOBILE_QUERY } from "../../lib/breakpoints";
  import { onMount, onDestroy, untrack, tick } from "svelte";
  import { MediaQuery } from "svelte/reactivity";
  import Button from "../../lib/studio/Button.svelte";
  import InstallCard from "../pwa/InstallCard.svelte";
  import Heading from "../../lib/ui/Heading.svelte";
  import Spinner from "../../lib/studio/Spinner.svelte";
  import ChatField from "../composer/ChatField.svelte";
  import { createApplicationCopy } from "../application/copy";
  import OrgAvatar from "../../lib/components/OrgAvatar.svelte";
  import type { HomeBridge } from "./types";
  import { createHomeSession } from "./session";
  import { homeText, homeIssue } from "./copy";
  import {
    destinations,
    roomIcon,
    targetHref,
    waitTarget,
    plainWaitText,
    claudeWait,
    personVersion,
    dmEntry,
    roomLabel,
    waitKind,
    type WaitKind,
  } from "./model";
  import Icon from "../../lib/studio/Icon.svelte";
  import { Check, Inbox01 } from "../../lib/studio/icons";
  import HomeSkeleton from "./HomeSkeleton.svelte";
  import AgentMark from "../../lib/components/AgentMark.svelte";
  import PersonAvatar from "../../lib/components/PersonAvatar.svelte";
  import { mountCube } from "./cube";
  import { byImportance, fanClasses, inFan } from "./deskHand";
  import Onboarding from "../onboarding/Onboarding.svelte";
  import { createOnboardingSession } from "../onboarding/session";
  let {
    pwa,
    personal,
    rooms,
    profile,
    creator,
    onlanguage,
    lang,
    ago,
    onnavigate,
    onhome,
    onarchived,
    onnew,
    onroomsettings,
    onsearch,
    oninbox,
  }: HomeBridge = $props();
  const account = $derived(personal.state),
    draft = $derived(personal.draft);
  const mobile = new MediaQuery(MOBILE_QUERY);
  const session = untrack(() => createHomeSession(personal, onnavigate)),
    view = session.state;
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
  const t = $derived(createApplicationCopy(lang));
  let sendButton = $state<HTMLElement | null>(null);
  const suggestion = $derived($view.result);
  // The desk home: what waits on you as a hand of cards, most important in the middle.
  const waits = $derived(byImportance($account.me?.waits ?? []));
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
  const place = (choice: ReturnType<typeof destinations>[number]) =>
    choice.book_id
      ? choice.book_title + (choice.epic_title ? " › " + choice.epic_title : "")
      : text("newDestination", { title: choice.book_title });
  const who = (wait: (typeof waits)[number]) =>
    claudeWait(wait)
      ? text("yourClaude")
      : wait.author === "ai"
        ? "@vibe"
        : wait.author_name || wait.author.split("@")[0] || "";
  const plainClick = (event: MouseEvent) =>
    !(event.ctrlKey || event.metaKey || event.shiftKey || event.altKey);
  $effect(() => {
    if (suggestion)
      void tick().then(() => {
        if (sendButton?.isConnected) sendButton.focus();
      });
  });
  let mounted = false,
    agentTimer: ReturnType<typeof setTimeout> | undefined,
    copyStatus = $state("");
  onDestroy(() => {
    onboarding.dispose();
    session.dispose();
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
      session.dispose();
    };
  });
  const setup = $derived(
    `Read ${location.origin}/llms.txt and set up vibebook for this project.`,
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
        >{#if copyStatus === "copied"}<Icon icon={Check} size={14} />{/if}<span
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

<!-- Where the ask goes: one line with the destination and its two buttons, the
     reason under it, and the other places as chips. -->
{#snippet suggestionCard()}{#if $view.result}{@const choices = destinations(
      $view.result,
    )}{@const selected = choices[$view.selected]!}
    <div
      data-home-suggestion
      class="flex flex-col gap-2 rounded-2xl bg-card p-3 pl-4 text-left shadow-edge"
    >
      <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p aria-live="polite" class="m-0 min-w-0 flex-1 basis-48 break-words">
          <span class="text-muted-foreground">{text("deskSendTo")}</span>
          <b class="font-medium">{place(selected)}</b>
        </p>
        <div class="flex shrink-0 gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            disabled={$view.busy === "send"}
            onclick={() => session.cancel()}>{text("cancel")}</Button
          ><Button
            size="sm"
            bind:ref={sendButton}
            aria-busy={$view.busy === "send" || undefined}
            disabled={$view.busy === "send"}
            onclick={() => session.send()}
            >{#if $view.busy === "send"}<Spinner size="xs" />{/if}{text(
              "send",
            )}</Button
          >
        </div>
      </div>
      {#if $view.selected === 0 && $view.result.pick && $view.result.reason}<p
          class="m-0 text-xs leading-5 text-muted-foreground"
        >
          {$view.result.reason}
        </p>{/if}
      {#if choices.length > 1}<div
          class="flex flex-wrap items-center gap-1.5 border-t border-border pt-2"
        >
          <span class="text-xs text-muted-foreground">{text("deskOr")}</span>
          {#each choices as choice, index}{#if index !== $view.selected}<Button
                size="sm"
                variant="outline"
                disabled={!!$view.busy}
                class="h-7 max-w-full rounded-full px-3 text-xs"
                onclick={() => {
                  session.select(index);
                  void tick().then(() => {
                    if (sendButton?.isConnected) sendButton.focus();
                  });
                }}><span class="truncate">{place(choice)}</span></Button
              >{/if}{/each}
        </div>{/if}
    </div>{/if}
  {#if $view.error}<p role="alert" class="m-0 break-words text-destructive">
      {homeIssue(lang, $view.error)}
    </p>{/if}{/snippet}

<svelte:head><title>vibebook</title></svelte:head>
{#if $onboardingView.visible}
  <Onboarding owner={onboarding} {lang} {onlanguage} />
{:else}
  <!-- The desk home: the agent's cube, one sentence on what waits on you, the
       ask box, and what waits as a hand of cards at the foot of the screen
       (scrolling deals them into a grid). Your rooms follow the cards. -->
  <main
    bind:this={home}
    data-vb-native="home"
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
          >{:else}<HomeSkeleton label={text("loading")} />{/if}
      </section>
      {#if $account.me}{@const me = $account.me}
        <div
          data-home-ask="desk"
          class="relative z-30 mt-7 flex w-full max-w-[640px] flex-col items-center gap-3 [&>[data-chat-field]]:w-full"
        >
          <!-- The room's chat box, as is. -->
          <div class="w-full">
            <ChatField
              id="home-ask"
              maxlength={2000}
              label={text("ask")}
              placeholder={mobile.current
                ? text("deskAskShort")
                : text("deskAsk")}
              value={$draft.ask}
              onedit={(value) => session.edit(value)}
              onsubmit={() => void session.suggest()}
              {t}
              locale={lang === "en" ? "en-US" : "pt-BR"}
              disabled={$view.busy === "send"}
              busy={!!$view.busy}
              pending={$view.busy === "route"}
              sendDisabled={!$draft.ask.trim()}
            >
              {#snippet menu(close, trigger)}<Button
                  variant="menu"
                  role="menuitem"
                  onclick={() => {
                    close();
                    onnew(trigger ?? undefined);
                  }}>{text("new")}</Button
                ><Button
                  variant="menu"
                  role="menuitem"
                  onclick={() => {
                    close();
                    onsearch();
                  }}>{text("search")} <small>⌘K</small></Button
                >{/snippet}
            </ChatField>
          </div>
          <div class="w-full">{@render suggestionCard()}</div>
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
                    >{#if task}<Icon icon={Check} size={14} /><span
                        class="min-w-0 flex-1 truncate">{text("deskTask")}</span
                      >{:else if claudeWait(wait)}<AgentMark
                        size="2xs"
                        class="text-[10px]"
                      /><span
                        class="min-w-0 flex-1 truncate font-medium text-destructive"
                        >{who(wait)} · {text("needsYou")}</span
                      >{:else if wait.author === "ai"}<AgentMark
                        mark="✦"
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
                    >{plainWaitText(wait.text)}</b
                  ></span
                ></a
              >{/each}
          </nav>{/if}
      {/if}
    </div>
    <div class="h-16" aria-hidden="true"></div>
  </main>
{/if}
